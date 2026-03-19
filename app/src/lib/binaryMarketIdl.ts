// Binary Market IDL — generated from programs/binary_market/src/lib.rs
// After running `anchor build`, replace this with the generated IDL from target/idl/binary_market.json

export type BinaryMarketProgram = {
  version: "0.1.0";
  name: "binary_market";
  instructions: [
    {
      name: "initializeConfig";
      accounts: [
        { name: "config"; isMut: true; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true },
        { name: "treasury"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "feeBps"; type: "u16" }];
    },
    {
      name: "createRound";
      accounts: [
        { name: "round"; isMut: true; isSigner: false },
        { name: "config"; isMut: true; isSigner: false },
        { name: "payer"; isMut: true; isSigner: true },
        { name: "pythFeed"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "asset"; type: "string" },
        { name: "roundNumber"; type: "u64" },
        { name: "duration"; type: "i64" },
        { name: "lockBuffer"; type: "i64" },
        { name: "startPrice"; type: "u64" }
      ];
    },
    {
      name: "placeBet";
      accounts: [
        { name: "round"; isMut: true; isSigner: false },
        { name: "bet"; isMut: true; isSigner: false },
        { name: "user"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "side"; type: { defined: "BetSide" } },
        { name: "amount"; type: "u64" }
      ];
    },
    {
      name: "resolveRound";
      accounts: [
        { name: "round"; isMut: true; isSigner: false },
        { name: "config"; isMut: false; isSigner: false },
        { name: "pythFeed"; isMut: false; isSigner: false },
        { name: "cranker"; isMut: false; isSigner: true }
      ];
      args: [{ name: "endPrice"; type: "u64" }];
    },
    {
      name: "claimWinnings";
      accounts: [
        { name: "round"; isMut: true; isSigner: false },
        { name: "bet"; isMut: true; isSigner: false },
        { name: "user"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "BinaryConfig";
      type: {
        kind: "struct";
        fields: [
          { name: "authority"; type: "publicKey" },
          { name: "treasury"; type: "publicKey" },
          { name: "feeBps"; type: "u16" },
          { name: "totalRounds"; type: "u64" },
          { name: "totalVolume"; type: "u64" }
        ];
      };
    },
    {
      name: "BinaryRoundAccount";
      type: {
        kind: "struct";
        fields: [
          { name: "asset"; type: "string" },
          { name: "roundNumber"; type: "u64" },
          { name: "phase"; type: { defined: "RoundPhase" } },
          { name: "duration"; type: "i64" },
          { name: "lockBuffer"; type: "i64" },
          { name: "startTime"; type: "i64" },
          { name: "endTime"; type: "i64" },
          { name: "lockTime"; type: "i64" },
          { name: "pythFeed"; type: "publicKey" },
          { name: "startPrice"; type: "u64" },
          { name: "endPrice"; type: "u64" },
          { name: "upPool"; type: "u64" },
          { name: "downPool"; type: "u64" },
          { name: "totalBets"; type: "u32" },
          { name: "outcome"; type: { defined: "RoundOutcome" } },
          { name: "feeCollected"; type: "u64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "BinaryBetAccount";
      type: {
        kind: "struct";
        fields: [
          { name: "round"; type: "publicKey" },
          { name: "user"; type: "publicKey" },
          { name: "side"; type: { defined: "BetSide" } },
          { name: "amount"; type: "u64" },
          { name: "timestamp"; type: "i64" },
          { name: "claimed"; type: "bool" }
        ];
      };
    }
  ];
  types: [
    {
      name: "RoundPhase";
      type: {
        kind: "enum";
        variants: [
          { name: "Betting" },
          { name: "Locked" },
          { name: "Resolving" },
          { name: "Complete" }
        ];
      };
    },
    {
      name: "RoundOutcome";
      type: {
        kind: "enum";
        variants: [
          { name: "Pending" },
          { name: "Up" },
          { name: "Down" }
        ];
      };
    },
    {
      name: "BetSide";
      type: {
        kind: "enum";
        variants: [
          { name: "Up" },
          { name: "Down" }
        ];
      };
    }
  ];
  errors: [
    { code: 6000; name: "RoundNotBetting"; msg: "Round is not in betting phase" },
    { code: 6001; name: "BettingLocked"; msg: "Betting is locked for this round" },
    { code: 6002; name: "InvalidAmount"; msg: "Invalid bet amount" },
    { code: 6003; name: "RoundNotEnded"; msg: "Round has not ended yet" },
    { code: 6004; name: "AlreadyResolved"; msg: "Round already resolved" },
    { code: 6005; name: "RoundNotResolved"; msg: "Round not yet resolved" },
    { code: 6006; name: "AlreadyClaimed"; msg: "Winnings already claimed" },
    { code: 6007; name: "InvalidPythFeed"; msg: "Invalid Pyth price feed account" },
    { code: 6008; name: "PythPriceTooOld"; msg: "Pyth price is too stale" },
    { code: 6009; name: "PythPriceNegative"; msg: "Pyth price is negative or zero" },
    { code: 6010; name: "InsufficientFunds"; msg: "Insufficient funds in round escrow" }
  ];
};

export const BINARY_MARKET_IDL: BinaryMarketProgram = {
  version: "0.1.0",
  name: "binary_market",
  instructions: [
    {
      name: "initializeConfig",
      accounts: [
        { name: "config", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "treasury", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "feeBps", type: "u16" }],
    },
    {
      name: "createRound",
      accounts: [
        { name: "round", isMut: true, isSigner: false },
        { name: "config", isMut: true, isSigner: false },
        { name: "payer", isMut: true, isSigner: true },
        { name: "pythFeed", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "asset", type: "string" },
        { name: "roundNumber", type: "u64" },
        { name: "duration", type: "i64" },
        { name: "lockBuffer", type: "i64" },
        { name: "startPrice", type: "u64" },
      ],
    },
    {
      name: "placeBet",
      accounts: [
        { name: "round", isMut: true, isSigner: false },
        { name: "bet", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "side", type: { defined: "BetSide" } },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "resolveRound",
      accounts: [
        { name: "round", isMut: true, isSigner: false },
        { name: "config", isMut: false, isSigner: false },
        { name: "pythFeed", isMut: false, isSigner: false },
        { name: "cranker", isMut: false, isSigner: true },
      ],
      args: [{ name: "endPrice", type: "u64" }],
    },
    {
      name: "claimWinnings",
      accounts: [
        { name: "round", isMut: true, isSigner: false },
        { name: "bet", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "BinaryConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "treasury", type: "publicKey" },
          { name: "feeBps", type: "u16" },
          { name: "totalRounds", type: "u64" },
          { name: "totalVolume", type: "u64" },
        ],
      },
    },
    {
      name: "BinaryRoundAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "asset", type: "string" },
          { name: "roundNumber", type: "u64" },
          { name: "phase", type: { defined: "RoundPhase" } },
          { name: "duration", type: "i64" },
          { name: "lockBuffer", type: "i64" },
          { name: "startTime", type: "i64" },
          { name: "endTime", type: "i64" },
          { name: "lockTime", type: "i64" },
          { name: "pythFeed", type: "publicKey" },
          { name: "startPrice", type: "u64" },
          { name: "endPrice", type: "u64" },
          { name: "upPool", type: "u64" },
          { name: "downPool", type: "u64" },
          { name: "totalBets", type: "u32" },
          { name: "outcome", type: { defined: "RoundOutcome" } },
          { name: "feeCollected", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "BinaryBetAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "round", type: "publicKey" },
          { name: "user", type: "publicKey" },
          { name: "side", type: { defined: "BetSide" } },
          { name: "amount", type: "u64" },
          { name: "timestamp", type: "i64" },
          { name: "claimed", type: "bool" },
        ],
      },
    },
  ],
  types: [
    {
      name: "RoundPhase",
      type: {
        kind: "enum",
        variants: [
          { name: "Betting" },
          { name: "Locked" },
          { name: "Resolving" },
          { name: "Complete" },
        ],
      },
    },
    {
      name: "RoundOutcome",
      type: {
        kind: "enum",
        variants: [
          { name: "Pending" },
          { name: "Up" },
          { name: "Down" },
        ],
      },
    },
    {
      name: "BetSide",
      type: {
        kind: "enum",
        variants: [
          { name: "Up" },
          { name: "Down" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "RoundNotBetting", msg: "Round is not in betting phase" },
    { code: 6001, name: "BettingLocked", msg: "Betting is locked for this round" },
    { code: 6002, name: "InvalidAmount", msg: "Invalid bet amount" },
    { code: 6003, name: "RoundNotEnded", msg: "Round has not ended yet" },
    { code: 6004, name: "AlreadyResolved", msg: "Round already resolved" },
    { code: 6005, name: "RoundNotResolved", msg: "Round not yet resolved" },
    { code: 6006, name: "AlreadyClaimed", msg: "Winnings already claimed" },
    { code: 6007, name: "InvalidPythFeed", msg: "Invalid Pyth price feed account" },
    { code: 6008, name: "PythPriceTooOld", msg: "Pyth price is too stale" },
    { code: 6009, name: "PythPriceNegative", msg: "Pyth price is negative or zero" },
    { code: 6010, name: "InsufficientFunds", msg: "Insufficient funds in round escrow" },
  ],
};
