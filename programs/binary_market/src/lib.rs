// Profitic Binary Market Program — Solana/Anchor
// Resolves 5-minute binary rounds using Pyth Network on-chain oracle.
//
// Architecture:
// - Platform creates rolling BinaryRound accounts (BTC, ETH, SOL)
// - Users place bets (UP or DOWN) during the betting phase
// - When the round ends, a crank resolves the round by reading Pyth price
// - Winnings are distributed pro-rata to the winning side (minus 2% platform fee)
// - Next round starts automatically
//
// Accounts:
//   BinaryConfig  — global config (authority, fee_bps, treasury)
//   BinaryRound   — one per asset per round (start_price, end_price, pools, phase)
//   BinaryBet     — one per bet (user, side, amount, claimed)
//
// Instructions:
//   initialize_config(authority, treasury, fee_bps)
//   create_round(asset, round_number, duration, lock_buffer)
//   place_bet(side, amount)
//   resolve_round()           — reads Pyth oracle, determines outcome
//   claim_winnings()          — user claims payout
//   close_round()             — reclaims rent after all claims

use anchor_lang::prelude::*;
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("5YwWnHt7k3hriR4HkJUZMzoEoQ5Tsbo8RyNo6rHfpXAr");

pub const ROUND_SEED: &[u8] = b"binary_round";
pub const BET_SEED: &[u8] = b"binary_bet";
pub const CONFIG_SEED: &[u8] = b"binary_config";

/// Maximum staleness (seconds) for Pyth price at round creation.
const PYTH_MAX_STALENESS_CREATE: u64 = 3600;
/// Maximum staleness (seconds) for Pyth price at round resolution.
const PYTH_MAX_STALENESS_RESOLVE: u64 = 3600;

#[program]
pub mod binary_market {
    use super::*;

    /// Initialize global config — called once by the platform deployer.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps; // e.g. 200 = 2%
        config.total_rounds = 0;
        config.total_volume = 0;
        Ok(())
    }

    /// Create a new round for a given asset. Permissionless — anyone can create
    /// and pay the rent. If `start_price` > 0 it is used directly (devnet mode);
    /// otherwise the Pyth feed is read on-chain for the start price.
    pub fn create_round(
        ctx: Context<CreateRound>,
        asset: String,         // "BTC", "ETH", "SOL"
        round_number: u64,
        duration: i64,         // seconds (e.g. 300)
        lock_buffer: i64,      // seconds before end to lock (e.g. 30)
        start_price: u64,      // 0 → read from Pyth; >0 → use directly (scaled 1e8)
    ) -> Result<()> {
        let clock = Clock::get()?;
        let round = &mut ctx.accounts.round;

        round.asset = asset;
        round.round_number = round_number;
        round.phase = RoundPhase::Betting;
        round.duration = duration;
        round.lock_buffer = lock_buffer;
        round.start_time = clock.unix_timestamp;
        round.end_time = clock.unix_timestamp + duration;
        round.lock_time = clock.unix_timestamp + duration - lock_buffer;
        round.pyth_feed = ctx.accounts.pyth_feed.key();

        if start_price > 0 {
            // Caller-provided price (devnet / off-chain oracle mode)
            round.start_price = start_price;
        } else {
            // Read Pyth oracle for start price
            let price_feed = load_price_feed_from_account_info(&ctx.accounts.pyth_feed)
                .map_err(|_| BinaryError::InvalidPythFeed)?;
            let price = price_feed
                .get_price_no_older_than(clock.unix_timestamp, PYTH_MAX_STALENESS_CREATE)
                .ok_or(BinaryError::PythPriceTooOld)?;
            require!(price.price > 0, BinaryError::PythPriceNegative);
            round.start_price = price.price as u64;
        }

        round.end_price = 0;
        round.up_pool = 0;
        round.down_pool = 0;
        round.total_bets = 0;
        round.outcome = RoundOutcome::Pending;
        round.fee_collected = 0;
        round.bump = ctx.bumps.round;

        let config = &mut ctx.accounts.config;
        config.total_rounds += 1;

        msg!(
            "Round created: asset={}, round={}, start_price={}",
            round.pyth_feed,
            round.round_number,
            round.start_price
        );

        Ok(())
    }

    /// Place a bet on the current round.
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: BetSide,
        amount: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Validate round state (immutable borrow first)
        require!(
            ctx.accounts.round.phase == RoundPhase::Betting,
            BinaryError::RoundNotBetting
        );
        require!(
            clock.unix_timestamp < ctx.accounts.round.lock_time,
            BinaryError::BettingLocked
        );
        require!(amount > 0, BinaryError::InvalidAmount);

        // Capture keys before mutable borrows
        let round_key = ctx.accounts.round.key();
        let user_key = ctx.accounts.user.key();

        // Transfer SOL from user to round escrow
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &user_key,
            &round_key,
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.round.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Record the bet
        let bet = &mut ctx.accounts.bet;
        bet.round = round_key;
        bet.user = user_key;
        bet.side = side;
        bet.amount = amount;
        bet.timestamp = clock.unix_timestamp;
        bet.claimed = false;

        // Update pool totals
        let round = &mut ctx.accounts.round;
        match side {
            BetSide::Up => round.up_pool += amount,
            BetSide::Down => round.down_pool += amount,
        }
        round.total_bets += 1;

        Ok(())
    }

    /// Resolve the round using Pyth oracle price or a caller-provided price.
    /// Callable by anyone (cranker) after round.end_time.
    /// If `end_price` > 0, use it directly (devnet mode); otherwise read Pyth.
    pub fn resolve_round(ctx: Context<ResolveRound>, end_price: u64) -> Result<()> {
        let clock = Clock::get()?;
        let round = &mut ctx.accounts.round;
        let config = &ctx.accounts.config;

        require!(
            clock.unix_timestamp >= round.end_time,
            BinaryError::RoundNotEnded
        );
        require!(
            round.outcome == RoundOutcome::Pending,
            BinaryError::AlreadyResolved
        );

        if end_price > 0 {
            // Caller-provided price (devnet / off-chain oracle mode)
            round.end_price = end_price;
        } else {
            // Read Pyth oracle for end price
            let price_feed = load_price_feed_from_account_info(&ctx.accounts.pyth_feed)
                .map_err(|_| BinaryError::InvalidPythFeed)?;
            let price = price_feed
                .get_price_no_older_than(clock.unix_timestamp, PYTH_MAX_STALENESS_RESOLVE)
                .ok_or(BinaryError::PythPriceTooOld)?;
            require!(price.price > 0, BinaryError::PythPriceNegative);
            round.end_price = price.price as u64;
        }

        // Determine outcome
        round.outcome = if round.end_price > round.start_price {
            RoundOutcome::Up
        } else if round.end_price < round.start_price {
            RoundOutcome::Down
        } else {
            // Exact tie — default to Up (extremely rare with 8-decimal Pyth prices)
            RoundOutcome::Up
        };
        round.phase = RoundPhase::Complete;

        // Calculate fee
        let total_pool = round.up_pool + round.down_pool;
        let fee = (total_pool as u128 * config.fee_bps as u128 / 10_000) as u64;
        round.fee_collected = fee;

        msg!(
            "Round resolved: end_price={}, outcome={:?}, fee={}",
            round.end_price,
            round.outcome,
            fee
        );

        Ok(())
    }

    /// User claims their winnings from a resolved round.
    /// Transfers SOL from the round PDA escrow to the winning user.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let round = &ctx.accounts.round;
        let bet = &mut ctx.accounts.bet;

        require!(
            round.phase == RoundPhase::Complete,
            BinaryError::RoundNotResolved
        );
        require!(!bet.claimed, BinaryError::AlreadyClaimed);

        // Check if user won
        let won = match round.outcome {
            RoundOutcome::Up => bet.side == BetSide::Up,
            RoundOutcome::Down => bet.side == BetSide::Down,
            _ => return err!(BinaryError::RoundNotResolved),
        };

        if won {
            let total_pool = round.up_pool + round.down_pool;
            let pool_after_fee = total_pool - round.fee_collected;
            let winning_pool = match bet.side {
                BetSide::Up => round.up_pool,
                BetSide::Down => round.down_pool,
            };

            // Pro-rata payout
            let payout = (pool_after_fee as u128 * bet.amount as u128
                / winning_pool as u128) as u64;

            // Transfer payout from round PDA escrow to user
            let round_info = ctx.accounts.round.to_account_info();
            let user_info = ctx.accounts.user.to_account_info();

            // Ensure sufficient lamports (round holds rent + pool; fee stays behind)
            let round_lamports = round_info.lamports();
            let rent = Rent::get()?.minimum_balance(round_info.data_len());
            let available = round_lamports.saturating_sub(rent);
            require!(payout <= available, BinaryError::InsufficientFunds);

            **round_info.try_borrow_mut_lamports()? -= payout;
            **user_info.try_borrow_mut_lamports()? += payout;

            bet.claimed = true;
            msg!("Payout: {} lamports to {}", payout, bet.user);
        } else {
            bet.claimed = true; // Mark as claimed (lost)
        }

        Ok(())
    }
}

// ── Account Structs ──

#[account]
pub struct BinaryConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub total_rounds: u64,
    pub total_volume: u64,
}

#[account]
pub struct BinaryRoundAccount {
    pub asset: String,          // "BTC", "ETH", "SOL"
    pub round_number: u64,
    pub phase: RoundPhase,
    pub duration: i64,
    pub lock_buffer: i64,
    pub start_time: i64,
    pub end_time: i64,
    pub lock_time: i64,
    pub pyth_feed: Pubkey,
    pub start_price: u64,       // from Pyth oracle at round start (raw, expo=-8)
    pub end_price: u64,         // from Pyth oracle at round end (raw, expo=-8)
    pub up_pool: u64,           // total lamports bet UP
    pub down_pool: u64,         // total lamports bet DOWN
    pub total_bets: u32,
    pub outcome: RoundOutcome,
    pub fee_collected: u64,
    pub bump: u8,               // PDA bump seed
}

#[account]
pub struct BinaryBetAccount {
    pub round: Pubkey,
    pub user: Pubkey,
    pub side: BetSide,
    pub amount: u64,
    pub timestamp: i64,
    pub claimed: bool,
}

// ── Enums ──

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RoundPhase {
    Betting,
    Locked,
    Resolving,
    Complete,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RoundOutcome {
    Pending,
    Up,
    Down,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetSide {
    Up,
    Down,
}

// ── Error Codes ──

#[error_code]
pub enum BinaryError {
    #[msg("Round is not in betting phase")]
    RoundNotBetting,
    #[msg("Betting is locked for this round")]
    BettingLocked,
    #[msg("Invalid bet amount")]
    InvalidAmount,
    #[msg("Round has not ended yet")]
    RoundNotEnded,
    #[msg("Round already resolved")]
    AlreadyResolved,
    #[msg("Round not yet resolved")]
    RoundNotResolved,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Invalid Pyth price feed account")]
    InvalidPythFeed,
    #[msg("Pyth price is too stale")]
    PythPriceTooOld,
    #[msg("Pyth price is negative or zero")]
    PythPriceNegative,
    #[msg("Insufficient funds in round escrow")]
    InsufficientFunds,
}

// ── Contexts ──

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 2 + 8 + 8,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, BinaryConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Treasury wallet
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(asset: String, round_number: u64)]
pub struct CreateRound<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 16 + 8 + 1 + 8 + 8 + 8 + 8 + 8 + 32 + 8 + 8 + 8 + 8 + 4 + 1 + 8 + 1,
        seeds = [ROUND_SEED, asset.as_bytes(), &round_number.to_le_bytes()],
        bump,
    )]
    pub round: Account<'info, BinaryRoundAccount>,
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, BinaryConfig>,
    /// Permissionless: any signer can create a round and pay the rent.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Pyth price feed account — validated by pyth-sdk-solana deserialization.
    pub pyth_feed: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub round: Account<'info, BinaryRoundAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 1,
        seeds = [BET_SEED, round.key().as_ref(), user.key().as_ref(), &round.total_bets.to_le_bytes()],
        bump,
    )]
    pub bet: Account<'info, BinaryBetAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    #[account(mut)]
    pub round: Account<'info, BinaryRoundAccount>,
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, BinaryConfig>,
    /// CHECK: Pyth price feed account — must match the feed stored at round creation.
    #[account(constraint = pyth_feed.key() == round.pyth_feed @ BinaryError::InvalidPythFeed)]
    pub pyth_feed: AccountInfo<'info>,
    pub cranker: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub round: Account<'info, BinaryRoundAccount>,
    #[account(
        mut,
        constraint = bet.user == user.key(),
        constraint = bet.round == round.key(),
    )]
    pub bet: Account<'info, BinaryBetAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
