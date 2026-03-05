use anchor_lang::prelude::*;

#[error_code]
pub enum ProfiticError {
    #[msg("Question text exceeds maximum length")]
    QuestionTooLong,
    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,
    #[msg("Data source exceeds maximum length")]
    DataSourceTooLong,
    #[msg("Evidence URL exceeds maximum length")]
    EvidenceTooLong,
    #[msg("Evidence snapshot exceeds maximum length")]
    SnapshotTooLong,
    #[msg("Resolution timestamp must be in the future")]
    ResolutionTimestampInPast,
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Market has not reached resolution time")]
    MarketNotResolvable,
    #[msg("Market is not in proposed resolution status")]
    MarketNotProposed,
    #[msg("Market is not resolved")]
    MarketNotResolved,
    #[msg("Invalid outcome: must be 0 (YES) or 1 (NO)")]
    InvalidOutcome,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Cost exceeds maximum specified")]
    SlippageExceeded,
    #[msg("Return is below minimum specified")]
    SlippageBelowMinimum,
    #[msg("Insufficient token balance for sale")]
    InsufficientBalance,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("No winnings to claim")]
    NoWinnings,
    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,
    #[msg("Trading fee basis points must be <= 1000 (10%)")]
    FeeTooHigh,
    #[msg("Resolution fee basis points must be <= 500 (5%)")]
    ResolutionFeeTooHigh,
    #[msg("Dispute window has not expired")]
    DisputeWindowActive,
    #[msg("Numerical overflow")]
    Overflow,
}
