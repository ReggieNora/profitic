use anchor_lang::prelude::*;
use anchor_lang::system_program;

// Program ID — will be replaced after `anchor keys list`
declare_id!("EyAQAxKyjWbSbf991RftzpXHkcGqgaG2VDLjSUgjE1M6");

// ═══════════════════════════════════════════
// Seeds
// ═══════════════════════════════════════════

pub const FARM_CONFIG_SEED: &[u8] = b"farm_config";
pub const STAKE_VAULT_SEED: &[u8] = b"stake_vault";
pub const USER_STAKE_SEED: &[u8] = b"user_stake";

// ═══════════════════════════════════════════
// Constants (matching UI tier logic)
// ═══════════════════════════════════════════

/// Reward tiers: (min_stake_lamports, weekly_apy_bps)
/// Bronze: 1–10K $PROFIT → 0.50%/wk = 50 bps
/// Silver: 10K–50K $PROFIT → 0.35%/wk = 35 bps
/// Gold:   50K+ $PROFIT   → 0.25%/wk = 25 bps
pub const TIER_BRONZE_MIN: u64 = 1;
pub const TIER_SILVER_MIN: u64 = 10_000;
pub const TIER_GOLD_MIN: u64 = 50_000;

pub const TIER_BRONZE_WEEKLY_BPS: u64 = 50; // 0.50%
pub const TIER_SILVER_WEEKLY_BPS: u64 = 35; // 0.35%
pub const TIER_GOLD_WEEKLY_BPS: u64 = 25;   // 0.25%

/// Streak bonus: +5 bps (0.05%) weekly per 7-day streak multiplier
pub const STREAK_BONUS_BPS: u64 = 5;
/// Seconds in a day (for streak + reward calculation)
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_WEEK: i64 = 604_800;

#[program]
pub mod yield_farm {
    use super::*;

    // ═══════════════════════════════════════
    // 1. Initialize global farm config
    // ═══════════════════════════════════════

    pub fn initialize_farm(
        ctx: Context<InitializeFarm>,
        reward_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.farm_config;
        config.authority = ctx.accounts.authority.key();
        config.reward_authority = reward_authority;
        config.total_staked = 0;
        config.total_stakers = 0;
        config.total_rewards_distributed = 0;
        config.paused = false;

        msg!("Farm initialized by {}", config.authority);
        Ok(())
    }

    // ═══════════════════════════════════════
    // 2. Stake $PROFIT (SOL for now)
    // ═══════════════════════════════════════

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, FarmError::ZeroAmount);

        let config = &ctx.accounts.farm_config;
        require!(!config.paused, FarmError::FarmPaused);

        let clock = Clock::get()?;
        let user_stake = &mut ctx.accounts.user_stake;
        let is_new = user_stake.staked_amount == 0;

        // Accrue any pending rewards before changing stake
        if user_stake.staked_amount > 0 {
            let accrued = calculate_pending_rewards(user_stake, clock.unix_timestamp)?;
            user_stake.pending_rewards = user_stake
                .pending_rewards
                .checked_add(accrued)
                .ok_or(FarmError::Overflow)?;
        }

        // Transfer SOL from user to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update user stake
        user_stake.user = ctx.accounts.user.key();
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_add(amount)
            .ok_or(FarmError::Overflow)?;
        user_stake.last_stake_ts = clock.unix_timestamp;
        user_stake.last_claim_ts = clock.unix_timestamp;

        // Initialize streak tracking on first stake
        if is_new {
            user_stake.streak_start_ts = clock.unix_timestamp;
        }

        // Update global config
        let config = &mut ctx.accounts.farm_config;
        config.total_staked = config
            .total_staked
            .checked_add(amount)
            .ok_or(FarmError::Overflow)?;
        if is_new {
            config.total_stakers = config
                .total_stakers
                .checked_add(1)
                .ok_or(FarmError::Overflow)?;
        }

        msg!(
            "User {} staked {} lamports (total: {})",
            ctx.accounts.user.key(),
            amount,
            user_stake.staked_amount,
        );
        Ok(())
    }

    // ═══════════════════════════════════════
    // 3. Unstake (withdraw)
    // ═══════════════════════════════════════

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, FarmError::ZeroAmount);

        let user_stake = &mut ctx.accounts.user_stake;
        require!(
            amount <= user_stake.staked_amount,
            FarmError::InsufficientStake
        );

        let clock = Clock::get()?;

        // Accrue pending rewards before withdrawal
        let accrued = calculate_pending_rewards(user_stake, clock.unix_timestamp)?;
        user_stake.pending_rewards = user_stake
            .pending_rewards
            .checked_add(accrued)
            .ok_or(FarmError::Overflow)?;
        user_stake.last_claim_ts = clock.unix_timestamp;

        // Transfer SOL from vault back to user
        let vault = &ctx.accounts.stake_vault;
        let vault_lamports = vault.lamports();
        require!(amount <= vault_lamports, FarmError::InsufficientVaultFunds);

        // PDA signer seeds for vault
        let bump = ctx.bumps.stake_vault;
        let seeds: &[&[u8]] = &[STAKE_VAULT_SEED, &[bump]];
        let _signer_seeds = &[seeds];

        // Transfer from vault to user via system program
        **ctx
            .accounts
            .stake_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        // Update user stake
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_sub(amount)
            .ok_or(FarmError::Overflow)?;

        let fully_unstaked = user_stake.staked_amount == 0;

        // Reset streak if fully unstaked
        if fully_unstaked {
            user_stake.streak_start_ts = 0;
        }

        // Update global config
        let config = &mut ctx.accounts.farm_config;
        config.total_staked = config
            .total_staked
            .checked_sub(amount)
            .ok_or(FarmError::Overflow)?;
        if fully_unstaked {
            config.total_stakers = config
                .total_stakers
                .checked_sub(1)
                .ok_or(FarmError::Overflow)?;
        }

        msg!(
            "User {} unstaked {} lamports (remaining: {})",
            ctx.accounts.user.key(),
            amount,
            user_stake.staked_amount,
        );
        Ok(())
    }

    // ═══════════════════════════════════════
    // 4. Claim accrued rewards
    // ═══════════════════════════════════════

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let clock = Clock::get()?;
        let user_stake = &mut ctx.accounts.user_stake;

        require!(user_stake.staked_amount > 0, FarmError::NothingStaked);

        // Calculate newly accrued rewards
        let accrued = calculate_pending_rewards(user_stake, clock.unix_timestamp)?;
        let total_claimable = user_stake
            .pending_rewards
            .checked_add(accrued)
            .ok_or(FarmError::Overflow)?;

        require!(total_claimable > 0, FarmError::NothingToClaim);

        // Transfer rewards from vault to user
        let vault = &ctx.accounts.stake_vault;
        require!(
            total_claimable <= vault.lamports(),
            FarmError::InsufficientVaultFunds
        );

        **ctx
            .accounts
            .stake_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= total_claimable;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += total_claimable;

        // Update state
        user_stake.pending_rewards = 0;
        user_stake.total_claimed = user_stake
            .total_claimed
            .checked_add(total_claimable)
            .ok_or(FarmError::Overflow)?;
        user_stake.last_claim_ts = clock.unix_timestamp;

        // Update global stats
        let config = &mut ctx.accounts.farm_config;
        config.total_rewards_distributed = config
            .total_rewards_distributed
            .checked_add(total_claimable)
            .ok_or(FarmError::Overflow)?;

        msg!(
            "User {} claimed {} lamports in rewards",
            ctx.accounts.user.key(),
            total_claimable,
        );
        Ok(())
    }

    // ═══════════════════════════════════════
    // 5. Fund reward vault (admin/authority)
    // ═══════════════════════════════════════

    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        require!(amount > 0, FarmError::ZeroAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Vault funded with {} lamports by {}", amount, ctx.accounts.funder.key());
        Ok(())
    }

    // ═══════════════════════════════════════
    // 6. Pause / unpause farm (admin)
    // ═══════════════════════════════════════

    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.farm_config.paused = paused;
        msg!("Farm paused = {}", paused);
        Ok(())
    }
}

// ═══════════════════════════════════════════
// Reward Calculation (pure logic)
// ═══════════════════════════════════════════

/// Get weekly APY in basis points for a given stake amount.
fn get_tier_weekly_bps(staked_amount: u64) -> u64 {
    if staked_amount >= TIER_GOLD_MIN {
        TIER_GOLD_WEEKLY_BPS
    } else if staked_amount >= TIER_SILVER_MIN {
        TIER_SILVER_WEEKLY_BPS
    } else {
        TIER_BRONZE_WEEKLY_BPS
    }
}

/// Calculate streak multiplier: number of full 7-day periods.
fn get_streak_multiplier(streak_start_ts: i64, now: i64) -> u64 {
    if streak_start_ts == 0 || now <= streak_start_ts {
        return 0;
    }
    let elapsed = now.saturating_sub(streak_start_ts);
    let days = elapsed / SECONDS_PER_DAY;
    (days / 7) as u64
}

/// Calculate pending rewards since last claim.
/// reward = staked_amount * (base_rate + streak_bonus) * elapsed_seconds / seconds_per_week
fn calculate_pending_rewards(
    user_stake: &UserStake,
    now: i64,
) -> Result<u64> {
    if user_stake.staked_amount == 0 || now <= user_stake.last_claim_ts {
        return Ok(0);
    }

    let elapsed = (now - user_stake.last_claim_ts) as u64;
    let base_bps = get_tier_weekly_bps(user_stake.staked_amount);
    let streak_mult = get_streak_multiplier(user_stake.streak_start_ts, now);
    let streak_bps = STREAK_BONUS_BPS.checked_mul(streak_mult).unwrap_or(0);
    let total_bps = base_bps.checked_add(streak_bps).unwrap_or(base_bps);

    // reward = staked_amount * total_bps / 10_000 * elapsed / SECONDS_PER_WEEK
    // Use u128 to avoid overflow on large stakes
    let reward = (user_stake.staked_amount as u128)
        .checked_mul(total_bps as u128)
        .ok_or(FarmError::Overflow)?
        .checked_mul(elapsed as u128)
        .ok_or(FarmError::Overflow)?
        .checked_div(10_000u128 * SECONDS_PER_WEEK as u128)
        .ok_or(FarmError::Overflow)?;

    Ok(reward as u64)
}

// ═══════════════════════════════════════════
// Account State
// ═══════════════════════════════════════════

#[account]
pub struct FarmConfig {
    /// Admin who can pause/unpause and update config
    pub authority: Pubkey,        // 32
    /// Authority that can fund the reward vault
    pub reward_authority: Pubkey, // 32
    /// Total lamports staked across all users
    pub total_staked: u64,        // 8
    /// Number of active stakers
    pub total_stakers: u64,       // 8
    /// Total rewards distributed (lifetime)
    pub total_rewards_distributed: u64, // 8
    /// Whether new stakes are paused
    pub paused: bool,             // 1
}

// Space: 8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 1 = 97
impl FarmConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct UserStake {
    /// The user's wallet
    pub user: Pubkey,            // 32
    /// Amount currently staked (lamports)
    pub staked_amount: u64,      // 8
    /// Unix timestamp of last stake action
    pub last_stake_ts: i64,      // 8
    /// Unix timestamp of last reward claim
    pub last_claim_ts: i64,      // 8
    /// Unclaimed accrued rewards (lamports)
    pub pending_rewards: u64,    // 8
    /// Lifetime claimed rewards (lamports)
    pub total_claimed: u64,      // 8
    /// Unix timestamp when consecutive staking started (0 if not staking)
    pub streak_start_ts: i64,    // 8
}

// Space: 8 (discriminator) + 32 + 8 + 8 + 8 + 8 + 8 + 8 = 88
impl UserStake {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8;
}

// ═══════════════════════════════════════════
// Errors
// ═══════════════════════════════════════════

#[error_code]
pub enum FarmError {
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Insufficient staked balance.")]
    InsufficientStake,
    #[msg("Nothing staked.")]
    NothingStaked,
    #[msg("No rewards to claim.")]
    NothingToClaim,
    #[msg("Insufficient funds in vault.")]
    InsufficientVaultFunds,
    #[msg("Farm is currently paused.")]
    FarmPaused,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Unauthorized.")]
    Unauthorized,
}

// ═══════════════════════════════════════════
// Instruction Contexts
// ═══════════════════════════════════════════

#[derive(Accounts)]
pub struct InitializeFarm<'info> {
    #[account(
        init,
        payer = authority,
        space = FarmConfig::SIZE,
        seeds = [FARM_CONFIG_SEED],
        bump,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    /// CHECK: Vault PDA that holds all staked SOL + reward funds.
    #[account(
        mut,
        seeds = [STAKE_VAULT_SEED],
        bump,
    )]
    pub stake_vault: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [FARM_CONFIG_SEED],
        bump,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserStake::SIZE,
        seeds = [USER_STAKE_SEED, user.key().as_ref()],
        bump,
    )]
    pub user_stake: Account<'info, UserStake>,

    /// CHECK: Vault PDA that holds staked SOL.
    #[account(
        mut,
        seeds = [STAKE_VAULT_SEED],
        bump,
    )]
    pub stake_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        mut,
        seeds = [FARM_CONFIG_SEED],
        bump,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    #[account(
        mut,
        seeds = [USER_STAKE_SEED, user.key().as_ref()],
        bump,
        constraint = user_stake.user == user.key() @ FarmError::Unauthorized,
    )]
    pub user_stake: Account<'info, UserStake>,

    /// CHECK: Vault PDA that holds staked SOL.
    #[account(
        mut,
        seeds = [STAKE_VAULT_SEED],
        bump,
    )]
    pub stake_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [FARM_CONFIG_SEED],
        bump,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    #[account(
        mut,
        seeds = [USER_STAKE_SEED, user.key().as_ref()],
        bump,
        constraint = user_stake.user == user.key() @ FarmError::Unauthorized,
    )]
    pub user_stake: Account<'info, UserStake>,

    /// CHECK: Vault PDA that holds staked SOL.
    #[account(
        mut,
        seeds = [STAKE_VAULT_SEED],
        bump,
    )]
    pub stake_vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(
        seeds = [FARM_CONFIG_SEED],
        bump,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    /// CHECK: Vault PDA.
    #[account(
        mut,
        seeds = [STAKE_VAULT_SEED],
        bump,
    )]
    pub stake_vault: AccountInfo<'info>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        seeds = [FARM_CONFIG_SEED],
        bump,
        constraint = farm_config.authority == authority.key() @ FarmError::Unauthorized,
    )]
    pub farm_config: Account<'info, FarmConfig>,

    pub authority: Signer<'info>,
}
