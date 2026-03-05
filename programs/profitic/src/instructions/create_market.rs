use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token};
use crate::state::{Market, MarketStatus, Platform};
use crate::errors::ProfiticError;

/// Create a new binary (YES/NO) prediction market.
/// The creator pays a creation fee, and two SPL token mints are initialized
/// for YES and NO outcome tokens.
#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,

    #[account(
        init,
        payer = creator,
        space = Market::SIZE,
        seeds = [b"market", platform.market_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// YES outcome token mint, authority is the market PDA.
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market,
        seeds = [b"yes_mint", market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO outcome token mint, authority is the market PDA.
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = market,
        seeds = [b"no_mint", market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    /// Vault PDA that holds the pool's SOL.
    /// CHECK: This is a PDA used as a SOL vault, validated by seeds.
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Treasury receives the creation fee.
    #[account(
        mut,
        constraint = treasury.key() == platform.treasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateMarket>,
    question: String,
    description: String,
    resolution_timestamp: i64,
    data_source: String,
) -> Result<()> {
    // Validate input lengths
    require!(question.len() <= Market::MAX_QUESTION_LEN, ProfiticError::QuestionTooLong);
    require!(description.len() <= Market::MAX_DESCRIPTION_LEN, ProfiticError::DescriptionTooLong);
    require!(data_source.len() <= Market::MAX_DATA_SOURCE_LEN, ProfiticError::DataSourceTooLong);

    // Validate resolution timestamp is in the future
    let clock = Clock::get()?;
    require!(
        resolution_timestamp > clock.unix_timestamp,
        ProfiticError::ResolutionTimestampInPast
    );

    // Transfer creation fee to treasury
    let platform = &ctx.accounts.platform;
    if platform.creation_fee_lamports > 0 {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            platform.creation_fee_lamports,
        )?;
    }

    // Initialize the market account
    let market = &mut ctx.accounts.market;
    market.id = ctx.accounts.platform.market_count;
    market.creator = ctx.accounts.creator.key();
    market.question = question;
    market.description = description;
    market.resolution_timestamp = resolution_timestamp;
    market.data_source = data_source;
    market.status = MarketStatus::Active;
    market.yes_mint = ctx.accounts.yes_mint.key();
    market.no_mint = ctx.accounts.no_mint.key();
    market.yes_supply = 0;
    market.no_supply = 0;
    market.pool_balance = 0;
    market.winning_outcome = None;
    market.evidence_url = String::new();
    market.proposed_outcome = None;
    market.proposed_evidence_url = String::new();
    market.proposed_evidence_snapshot = String::new();
    market.proposal_timestamp = None;
    market.challenge_stake = 0;
    market.created_at = clock.unix_timestamp;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;

    // Increment market counter
    let platform = &mut ctx.accounts.platform;
    platform.market_count = platform.market_count.checked_add(1).ok_or(ProfiticError::Overflow)?;

    msg!("Market created: ID={}, question={}", market.id, market.question);
    Ok(())
}
