use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};
use crate::state::{Market, MarketStatus, Platform};
use crate::errors::ProfiticError;

/// Sell outcome tokens back to the pool using the bonding curve.
#[derive(Accounts)]
#[instruction(outcome: u8)]
pub struct SellTokens<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = market.status == MarketStatus::Active @ ProfiticError::MarketNotActive,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = (outcome == 0 && outcome_mint.key() == market.yes_mint)
            || (outcome == 1 && outcome_mint.key() == market.no_mint)
            @ ProfiticError::InvalidOutcome,
    )]
    pub outcome_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.mint == outcome_mint.key(),
        constraint = user_token_account.owner == seller.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: Vault PDA holding pool SOL.
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Treasury receives trading fees.
    #[account(
        mut,
        constraint = treasury.key() == platform.treasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Calculate return from selling tokens using the bonding curve (inverse of buy).
fn calculate_sell_return(current_supply: u64, amount: u64) -> Result<u64> {
    let base_price: u128 = 10_000;
    let slope: u128 = 10;
    let s = current_supply as u128;
    let a = amount as u128;

    require!(a <= s, ProfiticError::InsufficientBalance);

    // Integral of (base_price + slope * x) from (s-a) to s
    // = base_price * a + slope * (s^2 - (s-a)^2) / 2
    // = base_price * a + slope * a * (2s - a) / 2
    let return_amount = base_price
        .checked_mul(a)
        .and_then(|v| {
            let curve_part = slope
                .checked_mul(a)?
                .checked_mul(2u128.checked_mul(s)?.checked_sub(a)?)?
                .checked_div(2)?;
            v.checked_add(curve_part)
        })
        .ok_or(ProfiticError::Overflow)?;

    Ok(return_amount as u64)
}

pub fn handler(
    ctx: Context<SellTokens>,
    outcome: u8,
    amount: u64,
    min_return: u64,
) -> Result<()> {
    require!(outcome <= 1, ProfiticError::InvalidOutcome);
    require!(amount > 0, ProfiticError::ZeroAmount);

    let current_supply = if outcome == 0 {
        ctx.accounts.market.yes_supply
    } else {
        ctx.accounts.market.no_supply
    };

    let gross_return = calculate_sell_return(current_supply, amount)?;

    // Calculate trading fee
    let fee = (gross_return as u128)
        .checked_mul(ctx.accounts.platform.trading_fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(ProfiticError::Overflow)? as u64;

    let net_return = gross_return.checked_sub(fee).ok_or(ProfiticError::Overflow)?;
    require!(net_return >= min_return, ProfiticError::SlippageBelowMinimum);

    // Burn the outcome tokens
    let market = &ctx.accounts.market;
    let seeds = &[
        b"market",
        &market.id.to_le_bytes()[..],
        &[market.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.outcome_mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        amount,
    )?;

    // Transfer SOL from vault to seller
    let vault = &ctx.accounts.vault;
    **vault.to_account_info().try_borrow_mut_lamports()? -= net_return;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += net_return;

    // Transfer fee from vault to treasury
    if fee > 0 {
        **vault.to_account_info().try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;
    }

    // Update market state
    let market = &mut ctx.accounts.market;
    if outcome == 0 {
        market.yes_supply = market.yes_supply.checked_sub(amount).ok_or(ProfiticError::Overflow)?;
    } else {
        market.no_supply = market.no_supply.checked_sub(amount).ok_or(ProfiticError::Overflow)?;
    }
    market.pool_balance = market
        .pool_balance
        .checked_sub(gross_return)
        .ok_or(ProfiticError::Overflow)?;

    msg!(
        "Sold {} tokens for outcome {} returning {} lamports (fee: {})",
        amount,
        outcome,
        net_return,
        fee
    );
    Ok(())
}
