use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use crate::state::{Market, MarketStatus, Platform, UserPosition};
use crate::errors::ProfiticError;

/// Buy outcome tokens using a simple bonding curve.
///
/// Bonding curve formula (linear):
///   cost = base_price * amount + slope * amount^2 / 2
///   where base_price = 0.01 SOL (10_000_000 lamports per token)
///   and slope adjusts based on supply.
///
/// This gives increasing prices as more tokens of one outcome are bought,
/// naturally creating a probability market.
#[derive(Accounts)]
#[instruction(outcome: u8)]
pub struct BuyTokens<'info> {
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

    /// The mint for the chosen outcome (YES=0, NO=1).
    #[account(
        mut,
        constraint = (outcome == 0 && outcome_mint.key() == market.yes_mint)
            || (outcome == 1 && outcome_mint.key() == market.no_mint)
            @ ProfiticError::InvalidOutcome,
    )]
    pub outcome_mint: Account<'info, Mint>,

    /// User's token account for the outcome token.
    #[account(
        mut,
        constraint = user_token_account.mint == outcome_mint.key(),
        constraint = user_token_account.owner == buyer.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault PDA holding the pool's SOL.
    /// CHECK: Validated by seeds.
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

    /// User's position tracker for this market.
    #[account(
        init_if_needed,
        payer = buyer,
        space = UserPosition::SIZE,
        seeds = [b"position", market.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Simple linear bonding curve: cost = amount * (base_price + slope * current_supply)
/// base_price = 10_000 lamports per token-unit (0.00001 SOL per micro-token)
/// slope = 10 lamports per token-unit of supply
fn calculate_buy_cost(current_supply: u64, amount: u64) -> Result<u64> {
    let base_price: u128 = 10_000;
    let slope: u128 = 10;
    let s = current_supply as u128;
    let a = amount as u128;

    // Integral of (base_price + slope * x) from s to s+a
    // = base_price * a + slope * ((s+a)^2 - s^2) / 2
    // = base_price * a + slope * a * (2s + a) / 2
    let cost = base_price
        .checked_mul(a)
        .and_then(|v| {
            let curve_part = slope
                .checked_mul(a)?
                .checked_mul(2u128.checked_mul(s)?.checked_add(a)?)?
                .checked_div(2)?;
            v.checked_add(curve_part)
        })
        .ok_or(ProfiticError::Overflow)?;

    Ok(cost as u64)
}

pub fn handler(ctx: Context<BuyTokens>, outcome: u8, amount: u64, max_cost: u64) -> Result<()> {
    require!(outcome <= 1, ProfiticError::InvalidOutcome);
    require!(amount > 0, ProfiticError::ZeroAmount);

    let current_supply = if outcome == 0 {
        ctx.accounts.market.yes_supply
    } else {
        ctx.accounts.market.no_supply
    };

    let cost = calculate_buy_cost(current_supply, amount)?;

    // Calculate trading fee
    let fee = (cost as u128)
        .checked_mul(ctx.accounts.platform.trading_fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(ProfiticError::Overflow)? as u64;

    let total_cost = cost.checked_add(fee).ok_or(ProfiticError::Overflow)?;
    require!(total_cost <= max_cost, ProfiticError::SlippageExceeded);

    // Transfer SOL to vault (pool)
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        cost,
    )?;

    // Transfer fee to treasury
    if fee > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // Mint outcome tokens to user
    let market_key = ctx.accounts.market.key();
    let market = &ctx.accounts.market;
    let seeds = &[
        b"market",
        &market.id.to_le_bytes()[..],
        &[market.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.outcome_mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update market state
    let market = &mut ctx.accounts.market;
    if outcome == 0 {
        market.yes_supply = market.yes_supply.checked_add(amount).ok_or(ProfiticError::Overflow)?;
    } else {
        market.no_supply = market.no_supply.checked_add(amount).ok_or(ProfiticError::Overflow)?;
    }
    market.pool_balance = market.pool_balance.checked_add(cost).ok_or(ProfiticError::Overflow)?;

    // Initialize user position if new
    let position = &mut ctx.accounts.user_position;
    if position.market == Pubkey::default() {
        position.market = ctx.accounts.market.key();
        position.user = ctx.accounts.buyer.key();
        position.claimed = false;
        position.bump = ctx.bumps.user_position;
    }

    msg!(
        "Bought {} tokens for outcome {} at cost {} lamports (fee: {})",
        amount,
        outcome,
        cost,
        fee
    );
    Ok(())
}
