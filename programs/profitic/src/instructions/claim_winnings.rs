use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};
use crate::state::{Market, MarketStatus, Platform, UserPosition};
use crate::errors::ProfiticError;

/// Claim winnings from a resolved market.
/// Winners burn their winning outcome tokens and receive proportional SOL
/// from the pool minus the resolution fee.
#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = market.status == MarketStatus::Resolved @ ProfiticError::MarketNotResolved,
    )]
    pub market: Account<'info, Market>,

    /// The winning outcome's mint.
    #[account(
        mut,
        constraint = {
            let wo = market.winning_outcome.ok_or(ProfiticError::MarketNotResolved)?;
            if wo == 0 { winning_mint.key() == market.yes_mint }
            else { winning_mint.key() == market.no_mint }
        },
    )]
    pub winning_mint: Account<'info, Mint>,

    /// User's token account for the winning outcome.
    #[account(
        mut,
        constraint = user_token_account.mint == winning_mint.key(),
        constraint = user_token_account.owner == claimer.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), claimer.key().as_ref()],
        bump = user_position.bump,
        constraint = !user_position.claimed @ ProfiticError::AlreadyClaimed,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// CHECK: Vault PDA holding pool SOL.
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Treasury receives resolution fee.
    #[account(
        mut,
        constraint = treasury.key() == platform.treasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let user_balance = ctx.accounts.user_token_account.amount;
    require!(user_balance > 0, ProfiticError::NoWinnings);

    let market = &ctx.accounts.market;
    let winning_outcome = market.winning_outcome.ok_or(ProfiticError::MarketNotResolved)?;

    // Calculate winning supply and user's share of the pool
    let winning_supply = if winning_outcome == 0 {
        market.yes_supply
    } else {
        market.no_supply
    };

    // User's share = (user_balance / winning_supply) * pool_balance
    let payout = (market.pool_balance as u128)
        .checked_mul(user_balance as u128)
        .and_then(|v| v.checked_div(winning_supply as u128))
        .ok_or(ProfiticError::Overflow)? as u64;

    // Calculate resolution fee
    let fee = (payout as u128)
        .checked_mul(ctx.accounts.platform.resolution_fee_bps as u128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(ProfiticError::Overflow)? as u64;

    let net_payout = payout.checked_sub(fee).ok_or(ProfiticError::Overflow)?;

    // Burn winning tokens
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.winning_mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.claimer.to_account_info(),
            },
        ),
        user_balance,
    )?;

    // Transfer payout from vault to claimer
    let vault = &ctx.accounts.vault;
    **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.claimer.to_account_info().try_borrow_mut_lamports()? += net_payout;

    // Transfer fee to treasury
    if fee > 0 {
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;
    }

    // Update market supplies
    let market = &mut ctx.accounts.market;
    if winning_outcome == 0 {
        market.yes_supply = market.yes_supply.checked_sub(user_balance).ok_or(ProfiticError::Overflow)?;
    } else {
        market.no_supply = market.no_supply.checked_sub(user_balance).ok_or(ProfiticError::Overflow)?;
    }
    market.pool_balance = market.pool_balance.checked_sub(payout).ok_or(ProfiticError::Overflow)?;

    // Mark position as claimed
    ctx.accounts.user_position.claimed = true;

    msg!(
        "Claimed {} lamports (fee: {}) for {} winning tokens",
        net_payout,
        fee,
        user_balance
    );
    Ok(())
}
