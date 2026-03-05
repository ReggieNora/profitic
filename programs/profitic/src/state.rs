use anchor_lang::prelude::*;

/// Global platform configuration, owned by the admin.
#[account]
#[derive(Default)]
pub struct Platform {
    /// Admin authority that can resolve markets and update config.
    pub admin: Pubkey,
    /// Treasury wallet that collects fees.
    pub treasury: Pubkey,
    /// Fee in lamports to create a new market.
    pub creation_fee_lamports: u64,
    /// Trading fee in basis points (e.g., 100 = 1%).
    pub trading_fee_bps: u16,
    /// Resolution fee in basis points taken from the winning pool.
    pub resolution_fee_bps: u16,
    /// Total number of markets ever created.
    pub market_count: u64,
    /// Bump seed for PDA derivation.
    pub bump: u8,
}

impl Platform {
    pub const SIZE: usize = 8  // discriminator
        + 32  // admin
        + 32  // treasury
        + 8   // creation_fee_lamports
        + 2   // trading_fee_bps
        + 2   // resolution_fee_bps
        + 8   // market_count
        + 1;  // bump
}

/// Represents a single binary prediction market.
#[account]
pub struct Market {
    /// Unique market ID (sequential).
    pub id: u64,
    /// Creator of the market.
    pub creator: Pubkey,
    /// The question being predicted.
    pub question: String,
    /// Description with additional context.
    pub description: String,
    /// Unix timestamp when the market can be resolved.
    pub resolution_timestamp: i64,
    /// Data source URL/description for resolution verification.
    pub data_source: String,
    /// Current market status.
    pub status: MarketStatus,
    /// SPL token mint for YES outcome tokens.
    pub yes_mint: Pubkey,
    /// SPL token mint for NO outcome tokens.
    pub no_mint: Pubkey,
    /// Total YES tokens in circulation.
    pub yes_supply: u64,
    /// Total NO tokens in circulation.
    pub no_supply: u64,
    /// Total SOL locked in the market pool (in lamports).
    pub pool_balance: u64,
    /// Winning outcome (0 = YES, 1 = NO), set after resolution.
    pub winning_outcome: Option<u8>,
    /// Evidence URL provided at resolution.
    pub evidence_url: String,
    /// Proposed outcome for AI-assisted resolution.
    pub proposed_outcome: Option<u8>,
    /// Proposed evidence URL.
    pub proposed_evidence_url: String,
    /// Proposed evidence snapshot data.
    pub proposed_evidence_snapshot: String,
    /// Timestamp when proposal was made, for dispute window.
    pub proposal_timestamp: Option<i64>,
    /// Total challenge stake against the proposal.
    pub challenge_stake: u64,
    /// Timestamp when the market was created.
    pub created_at: i64,
    /// Bump seed for PDA derivation.
    pub bump: u8,
    /// Bump seed for the pool vault PDA.
    pub vault_bump: u8,
}

impl Market {
    // Max string lengths for space calculation
    pub const MAX_QUESTION_LEN: usize = 256;
    pub const MAX_DESCRIPTION_LEN: usize = 512;
    pub const MAX_DATA_SOURCE_LEN: usize = 256;
    pub const MAX_EVIDENCE_LEN: usize = 256;
    pub const MAX_SNAPSHOT_LEN: usize = 512;

    pub const SIZE: usize = 8   // discriminator
        + 8   // id
        + 32  // creator
        + (4 + Self::MAX_QUESTION_LEN)
        + (4 + Self::MAX_DESCRIPTION_LEN)
        + 8   // resolution_timestamp
        + (4 + Self::MAX_DATA_SOURCE_LEN)
        + 1   // status (enum)
        + 32  // yes_mint
        + 32  // no_mint
        + 8   // yes_supply
        + 8   // no_supply
        + 8   // pool_balance
        + (1 + 1)  // winning_outcome Option<u8>
        + (4 + Self::MAX_EVIDENCE_LEN)
        + (1 + 1)  // proposed_outcome Option<u8>
        + (4 + Self::MAX_EVIDENCE_LEN)
        + (4 + Self::MAX_SNAPSHOT_LEN)
        + (1 + 8)  // proposal_timestamp Option<i64>
        + 8   // challenge_stake
        + 8   // created_at
        + 1   // bump
        + 1;  // vault_bump
}

/// User's position in a specific market.
#[account]
pub struct UserPosition {
    /// The market this position is for.
    pub market: Pubkey,
    /// The user who holds this position.
    pub user: Pubkey,
    /// Whether winnings have been claimed.
    pub claimed: bool,
    /// Bump seed.
    pub bump: u8,
}

impl UserPosition {
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 1;
}

/// Challenge record for disputed resolutions.
#[account]
pub struct Challenge {
    pub market: Pubkey,
    pub challenger: Pubkey,
    pub stake_amount: u64,
    pub counter_evidence_url: String,
    pub timestamp: i64,
    pub bump: u8,
}

impl Challenge {
    pub const MAX_EVIDENCE_LEN: usize = 256;
    pub const SIZE: usize = 8 + 32 + 32 + 8 + (4 + Self::MAX_EVIDENCE_LEN) + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    /// Market is open for trading.
    Active,
    /// Resolution has been proposed, in dispute window.
    ProposedResolution,
    /// Market has been resolved with a winning outcome.
    Resolved,
    /// Market was cancelled (funds returned).
    Cancelled,
}

impl Default for MarketStatus {
    fn default() -> Self {
        MarketStatus::Active
    }
}
