use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("BHrdakmSddvoLJ3zNYRnXzBGqo2ZGCbUpWCJiftoUisz");

#[program]
pub mod profitic {
    use super::*;

    /// Initialize the platform with admin settings and fee configuration.
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        creation_fee_lamports: u64,
        trading_fee_bps: u16,
        resolution_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_platform::handler(
            ctx,
            creation_fee_lamports,
            trading_fee_bps,
            resolution_fee_bps,
        )
    }

    /// Create a new binary prediction market (YES/NO).
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        description: String,
        resolution_timestamp: i64,
        data_source: String,
    ) -> Result<()> {
        instructions::create_market::handler(
            ctx,
            question,
            description,
            resolution_timestamp,
            data_source,
        )
    }

    /// Buy outcome tokens using a bonding curve.
    /// `outcome` = 0 for YES, 1 for NO.
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        outcome: u8,
        amount: u64,
        max_cost: u64,
    ) -> Result<()> {
        instructions::buy_tokens::handler(ctx, outcome, amount, max_cost)
    }

    /// Sell outcome tokens back to the pool.
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        outcome: u8,
        amount: u64,
        min_return: u64,
    ) -> Result<()> {
        instructions::sell_tokens::handler(ctx, outcome, amount, min_return)
    }

    /// Admin resolves a market. `winning_outcome` = 0 for YES, 1 for NO.
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        winning_outcome: u8,
        evidence_url: String,
    ) -> Result<()> {
        instructions::resolve_market::handler(ctx, winning_outcome, evidence_url)
    }

    /// Propose AI-assisted resolution (optional feature).
    pub fn propose_resolution(
        ctx: Context<ProposeResolution>,
        proposed_outcome: u8,
        evidence_url: String,
        evidence_snapshot: String,
    ) -> Result<()> {
        instructions::propose_resolution::handler(
            ctx,
            proposed_outcome,
            evidence_url,
            evidence_snapshot,
        )
    }

    /// Challenge a proposed resolution by staking tokens.
    pub fn challenge_resolution(
        ctx: Context<ChallengeResolution>,
        stake_amount: u64,
        counter_evidence_url: String,
    ) -> Result<()> {
        instructions::challenge_resolution::handler(ctx, stake_amount, counter_evidence_url)
    }

    /// Claim winnings from a resolved market.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }
}
