use anchor_lang::prelude::*;
use crate::state::Platform;
use crate::errors::ProfiticError;

/// Initialize the global platform configuration.
/// This should be called once by the admin after deploying the program.
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = Platform::SIZE,
        seeds = [b"platform"],
        bump,
    )]
    pub platform: Account<'info, Platform>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury wallet to receive fees.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializePlatform>,
    creation_fee_lamports: u64,
    trading_fee_bps: u16,
    resolution_fee_bps: u16,
) -> Result<()> {
    require!(trading_fee_bps <= 1000, ProfiticError::FeeTooHigh);
    require!(resolution_fee_bps <= 500, ProfiticError::ResolutionFeeTooHigh);

    let platform = &mut ctx.accounts.platform;
    platform.admin = ctx.accounts.admin.key();
    platform.treasury = ctx.accounts.treasury.key();
    platform.creation_fee_lamports = creation_fee_lamports;
    platform.trading_fee_bps = trading_fee_bps;
    platform.resolution_fee_bps = resolution_fee_bps;
    platform.market_count = 0;
    platform.bump = ctx.bumps.platform;

    msg!("Platform initialized. Admin: {}", platform.admin);
    Ok(())
}
