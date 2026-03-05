use anchor_lang::prelude::*;
use crate::state::{Market, MarketStatus, Platform};
use crate::errors::ProfiticError;

/// Admin resolves a market by specifying the winning outcome.
/// Can only be called after the resolution timestamp has passed.
#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
        constraint = platform.admin == admin.key() @ ProfiticError::Unauthorized,
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        mut,
        constraint = market.status == MarketStatus::Active
            || market.status == MarketStatus::ProposedResolution
            @ ProfiticError::MarketNotActive,
    )]
    pub market: Account<'info, Market>,

    pub admin: Signer<'info>,
}

pub fn handler(
    ctx: Context<ResolveMarket>,
    winning_outcome: u8,
    evidence_url: String,
) -> Result<()> {
    require!(winning_outcome <= 1, ProfiticError::InvalidOutcome);
    require!(
        evidence_url.len() <= Market::MAX_EVIDENCE_LEN,
        ProfiticError::EvidenceTooLong
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= ctx.accounts.market.resolution_timestamp,
        ProfiticError::MarketNotResolvable
    );

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.winning_outcome = Some(winning_outcome);
    market.evidence_url = evidence_url;

    msg!(
        "Market {} resolved. Winning outcome: {} ({})",
        market.id,
        winning_outcome,
        if winning_outcome == 0 { "YES" } else { "NO" }
    );
    Ok(())
}
