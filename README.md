# Profitic — Solana Prediction Market MVP

A crypto-native prediction market where users create and trade tokenized predictions on measurable events, built on Solana.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│  Connect Wallet │ Browse Markets │ Trade │ Create │ Admin│
└────────────────────────┬────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────┐
│                  Backend Indexer (Node.js)               │
│  Event Listener │ REST API │ WebSocket Server            │
└────────────────────────┬────────────────────────────────┘
                         │ RPC / Logs
┌────────────────────────▼────────────────────────────────┐
│               Solana Program (Anchor/Rust)               │
│  Markets │ Bonding Curve │ Resolution │ Payouts          │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
profitic/
├── programs/profitic/src/     # Anchor smart contracts
│   ├── lib.rs                 # Program entrypoint
│   ├── state.rs               # Account structures
│   ├── errors.rs              # Custom errors
│   └── instructions/          # Instruction handlers
│       ├── initialize_platform.rs
│       ├── create_market.rs
│       ├── buy_tokens.rs
│       ├── sell_tokens.rs
│       ├── resolve_market.rs
│       ├── propose_resolution.rs
│       ├── challenge_resolution.rs
│       └── claim_winnings.rs
├── app/                       # Next.js frontend
├── backend/                   # Node.js indexer + API
├── migrations/                # Postgres schema
└── tests/                     # Anchor integration tests
```

## Prerequisites

- Rust 1.70+ with `rustup`
- Solana CLI 1.17+
- Anchor CLI 0.29+
- Node.js 18+
- PostgreSQL 14+

## Quick Start

### 1. Install Dependencies

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.29.0 && avm use 0.29.0

# Install project dependencies
npm install
cd app && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Configure Solana

```bash
# Generate a new keypair (or use existing)
solana-keygen new -o ~/.config/solana/id.json

# Set cluster to devnet
solana config set --url devnet

# Airdrop devnet SOL
solana airdrop 5
```

### 3. Build & Deploy Smart Contracts

```bash
# Build the program
anchor build

# Get program ID
solana address -k target/deploy/profitic-keypair.json

# Update the program ID in:
#   - Anchor.toml
#   - programs/profitic/src/lib.rs (declare_id!)
#   - app/.env (NEXT_PUBLIC_PROGRAM_ID)
#   - backend/.env (PROGRAM_ID)

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests (requires local validator)
anchor test
```

### 4. Set Up Database

```bash
# Create database
createdb profitic

# Run migrations
psql profitic < migrations/001_initial.sql
```

### 5. Start Backend Indexer

```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and Solana RPC

npm run dev
```

### 6. Start Frontend

```bash
cd app
cp .env.example .env
# Edit .env with your program ID and API URL

npm run dev
# Open http://localhost:3000
```

## Smart Contract Instructions

| Instruction | Description | Who Can Call |
|---|---|---|
| `initialize_platform` | Set up platform with fee config | Admin (once) |
| `create_market` | Create a YES/NO prediction market | Anyone |
| `buy_tokens` | Buy outcome tokens via bonding curve | Anyone |
| `sell_tokens` | Sell tokens back to the pool | Token holders |
| `resolve_market` | Resolve with winning outcome | Admin |
| `propose_resolution` | AI-proposed resolution with dispute window | Admin |
| `challenge_resolution` | Stake against a proposed resolution | Anyone |
| `claim_winnings` | Claim SOL payout from resolved market | Winners |

## Bonding Curve

The market uses a linear bonding curve for pricing:

```
cost = base_price × amount + slope × amount × (2 × supply + amount) / 2
```

- **base_price**: 10,000 lamports per token-unit
- **slope**: 10 lamports per token-unit of supply

This creates natural price discovery — as more people buy one outcome, its price increases, reflecting higher probability.

## Revenue Model

| Fee Type | Default | Configurable |
|---|---|---|
| Market creation | 0.01 SOL | Yes |
| Trading fee | 1% (100 bps) | Yes, max 10% |
| Resolution fee | 2% (200 bps) | Yes, max 5% |

## API Endpoints

### Markets
- `GET /api/markets` — List all markets with stats
- `GET /api/markets/:id` — Single market details
- `GET /api/markets/:id/trades` — Trade history

### Users
- `GET /api/users/:address/positions` — User's active positions
- `GET /api/users/:address/history` — User's market history

### WebSocket
- `ws://localhost:4000` — Real-time trade and price updates

## Resolution Flow

### Admin Resolution (MVP)
1. Market reaches resolution timestamp
2. Admin reviews data source
3. Admin calls `resolve_market` with winning outcome and evidence URL
4. Winners claim payouts

### AI-Assisted Resolution (Optional)
1. AI agent scans data source
2. Admin/AI calls `propose_resolution` with evidence
3. 24-hour dispute window opens
4. Users can `challenge_resolution` by staking SOL
5. Admin reviews challenges and finalizes with `resolve_market`

## Scaling Considerations

- **Indexer**: Replace polling with Helius webhooks or Geyser plugin for production
- **Database**: Add read replicas and connection pooling (PgBouncer)
- **Frontend**: Deploy on Vercel with edge functions
- **Program**: Consider upgradeability via Anchor's upgrade mechanism
- **Multi-outcome**: Extend `MarketStatus` and token mints for N outcomes

## License

MIT
