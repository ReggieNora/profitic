use anchor_lang::prelude::*;
use crate::state::{Market, MarketStatus, Platform};
use crate::errors::ProfiticError;

/// Propose an AI-assisted resolution for a market.
/// This puts the market into a "ProposedResolution" state with a dispute window.
/// Only the admin (or AI agent wallet) can propose.
#[derive(Accounts)]
pub struct ProposeResolution<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        constraint = platform.admin == proposer.key() @ ProfiticError::Unauthorized,
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = market.status == MarketStatus::Active @ ProfiticError::MarketNotActive,
    )]
    pub market: Account<'info, Market>,

    pub proposer: Signer<'info>,
}

pub fn handler(
    ctx: Context<ProposeResolution>,
    proposed_outcome: u8,
    evidence_url: String,
    evidence_snapshot: String,
) -> Result<()> {
    require!(proposed_outcome <= 1, ProfiticError::InvalidOutcome);
    require!(evidence_url.len() <= Market::MAX_EVIDENCE_LEN, ProfiticError::EvidenceTooLong);
    require!(evidence_snapshot.len() <= Market::MAX_SNAPSHOT_LEN, ProfiticError::SnapshotTooLong);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.market.resolution_timestamp,
        ProfiticError::MarketNotResolvable
    );

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::ProposedResolution;
    market.proposed_outcome = Some(proposed_outcome);
    market.proposed_evidence_url = evidence_url;
    market.proposed_evidence_snapshot = evidence_snapshot;
    market.proposal_timestamp = Some(clock.unix_timestamp);
    market.challenge_stake = 0;

    msg!(
        "Resolution proposed for market {}: outcome {} ({})",
        market.id,
        proposed_outcome,
        if proposed_outcome == 0 { "YES" } else { "NO" }
    );
    Ok(())
}
