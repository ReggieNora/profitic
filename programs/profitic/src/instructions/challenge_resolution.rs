use anchor_lang::prelude::*;
use crate::state::{Challenge, Market, MarketStatus};
use crate::errors::ProfiticError;

/// Challenge a proposed resolution by staking SOL.
/// The dispute window is 24 hours from the proposal timestamp.
#[derive(Accounts)]
pub struct ChallengeResolution<'info> {
    #[account(
        mut,
        constraint = market.status == MarketStatus::ProposedResolution
            @ ProfiticError::MarketNotProposed,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = challenger,
        space = Challenge::SIZE,
        seeds = [b"challenge", market.key().as_ref(), challenger.key().as_ref()],
        bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: Vault PDA to hold challenge stake.
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub challenger: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ChallengeResolution>,
    stake_amount: u64,
    counter_evidence_url: String,
) -> Result<()> {
    require!(stake_amount > 0, ProfiticError::ZeroAmount);
    require!(
        counter_evidence_url.len() <= Challenge::MAX_EVIDENCE_LEN,
        ProfiticError::EvidenceTooLong
    );

    // Verify dispute window is still active (24 hours)
    let clock = Clock::get()?;
    let proposal_ts = ctx.accounts.market.proposal_timestamp
        .ok_or(ProfiticError::MarketNotProposed)?;
    let dispute_window = 24 * 60 * 60; // 24 hours in seconds
    require!(
        clock.unix_timestamp <= proposal_ts + dispute_window,
        ProfiticError::DisputeWindowActive
    );

    // Transfer stake to vault
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    // Record challenge
    let challenge = &mut ctx.accounts.challenge;
    challenge.market = ctx.accounts.market.key();
    challenge.challenger = ctx.accounts.challenger.key();
    challenge.stake_amount = stake_amount;
    challenge.counter_evidence_url = counter_evidence_url;
    challenge.timestamp = clock.unix_timestamp;
    challenge.bump = ctx.bumps.challenge;

    // Update market challenge stake total
    let market = &mut ctx.accounts.market;
    market.challenge_stake = market
        .challenge_stake
        .checked_add(stake_amount)
        .ok_or(ProfiticError::Overflow)?;

    msg!(
        "Challenge submitted for market {} with stake {} lamports",
        market.id,
        stake_amount
    );
    Ok(())
}
