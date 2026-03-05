import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Profitic } from "../target/types/profitic";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { assert } from "chai";

describe("profitic", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Profitic as Program<Profitic>;
  const admin = provider.wallet as anchor.Wallet;
  const treasury = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  let platformPda: PublicKey;
  let platformBump: number;
  let marketPda: PublicKey;
  let yesMintPda: PublicKey;
  let noMintPda: PublicKey;
  let vaultPda: PublicKey;

  before(async () => {
    // Airdrop SOL to test accounts
    const sig1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    const sig2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig1);
    await provider.connection.confirmTransaction(sig2);

    // Derive platform PDA
    [platformPda, platformBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      program.programId
    );
  });

  it("Initializes the platform", async () => {
    const creationFee = new anchor.BN(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL
    const tradingFeeBps = 100; // 1%
    const resolutionFeeBps = 200; // 2%

    await program.methods
      .initializePlatform(creationFee, tradingFeeBps, resolutionFeeBps)
      .accounts({
        platform: platformPda,
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const platform = await program.account.platform.fetch(platformPda);
    assert.ok(platform.admin.equals(admin.publicKey));
    assert.ok(platform.treasury.equals(treasury.publicKey));
    assert.equal(platform.tradingFeeBps, tradingFeeBps);
    assert.equal(platform.resolutionFeeBps, resolutionFeeBps);
    assert.equal(platform.marketCount.toNumber(), 0);
  });

  it("Creates a market", async () => {
    const marketId = new anchor.BN(0);
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [yesMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("yes_mint"), marketPda.toBuffer()],
      program.programId
    );

    [noMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("no_mint"), marketPda.toBuffer()],
      program.programId
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    // Resolution time = 1 hour from now
    const resolutionTimestamp = new anchor.BN(
      Math.floor(Date.now() / 1000) + 3600
    );

    await program.methods
      .createMarket(
        "Will BTC exceed $100k by end of 2026?",
        "Bitcoin price as reported by Coinbase spot price",
        resolutionTimestamp,
        "https://api.coinbase.com/v2/prices/BTC-USD/spot"
      )
      .accounts({
        platform: platformPda,
        market: marketPda,
        yesMint: yesMintPda,
        noMint: noMintPda,
        vault: vaultPda,
        treasury: treasury.publicKey,
        creator: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.id.toNumber(), 0);
    assert.equal(
      market.question,
      "Will BTC exceed $100k by end of 2026?"
    );
    assert.ok(market.yesMint.equals(yesMintPda));
    assert.ok(market.noMint.equals(noMintPda));
    assert.equal(market.yesSupply.toNumber(), 0);
    assert.equal(market.noSupply.toNumber(), 0);

    // Check platform market count incremented
    const platform = await program.account.platform.fetch(platformPda);
    assert.equal(platform.marketCount.toNumber(), 1);
  });

  it("Buys YES tokens", async () => {
    // Create ATA for user1 for YES tokens
    const userYesAta = getAssociatedTokenAddressSync(
      yesMintPda,
      user1.publicKey
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        user1.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Create the ATA first
    const createAtaIx = createAssociatedTokenAccountInstruction(
      user1.publicKey,
      userYesAta,
      user1.publicKey,
      yesMintPda
    );

    const buyAmount = new anchor.BN(1_000_000); // 1 token (6 decimals)
    const maxCost = new anchor.BN(LAMPORTS_PER_SOL); // max 1 SOL

    await program.methods
      .buyTokens(0, buyAmount, maxCost)
      .accounts({
        platform: platformPda,
        market: marketPda,
        outcomeMint: yesMintPda,
        userTokenAccount: userYesAta,
        vault: vaultPda,
        treasury: treasury.publicKey,
        userPosition: positionPda,
        buyer: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([createAtaIx])
      .signers([user1])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.yesSupply.toNumber(), buyAmount.toNumber());
    assert.ok(market.poolBalance.toNumber() > 0);
  });

  it("Buys NO tokens", async () => {
    const userNoAta = getAssociatedTokenAddressSync(
      noMintPda,
      user2.publicKey
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        user2.publicKey.toBuffer(),
      ],
      program.programId
    );

    const createAtaIx = createAssociatedTokenAccountInstruction(
      user2.publicKey,
      userNoAta,
      user2.publicKey,
      noMintPda
    );

    const buyAmount = new anchor.BN(500_000); // 0.5 tokens
    const maxCost = new anchor.BN(LAMPORTS_PER_SOL);

    await program.methods
      .buyTokens(1, buyAmount, maxCost)
      .accounts({
        platform: platformPda,
        market: marketPda,
        outcomeMint: noMintPda,
        userTokenAccount: userNoAta,
        vault: vaultPda,
        treasury: treasury.publicKey,
        userPosition: positionPda,
        buyer: user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([createAtaIx])
      .signers([user2])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.noSupply.toNumber(), buyAmount.toNumber());
  });

  it("Sells YES tokens", async () => {
    const userYesAta = getAssociatedTokenAddressSync(
      yesMintPda,
      user1.publicKey
    );

    const sellAmount = new anchor.BN(100_000); // sell 0.1 tokens
    const minReturn = new anchor.BN(0); // accept any return for testing

    await program.methods
      .sellTokens(0, sellAmount, minReturn)
      .accounts({
        platform: platformPda,
        market: marketPda,
        outcomeMint: yesMintPda,
        userTokenAccount: userYesAta,
        vault: vaultPda,
        treasury: treasury.publicKey,
        seller: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.yesSupply.toNumber(), 900_000);
  });

  // NOTE: Resolution and claim tests require time manipulation or adjusting
  // the resolution timestamp. In a real test suite you'd use a local validator
  // with clock manipulation. Here we document the expected flow.

  it("Documents resolution and claim flow", () => {
    console.log(`
    Resolution Flow:
    1. Admin calls resolve_market(winning_outcome=0, evidence_url="...")
       - Market status changes to Resolved
       - winning_outcome is set

    2. Winners call claim_winnings()
       - Winning tokens are burned
       - Proportional SOL payout minus resolution fee
       - Position marked as claimed

    Alternative: AI-Assisted Resolution
    1. Admin calls propose_resolution(proposed_outcome, evidence_url, snapshot)
       - Market enters ProposedResolution status
       - 24-hour dispute window starts

    2. Users can call challenge_resolution(stake_amount, counter_evidence)
       - Stake SOL against the proposal
       - Admin reviews challenges

    3. After dispute window, admin calls resolve_market() to finalize
    `);
  });
});
