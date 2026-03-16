/**
 * IDL for the Profitic on-chain program.
 * Must match the Anchor program at programs/profitic/src/lib.rs
 *
 * Program ID: F26VXCqa3qsQrwA9doQrcbykw38D8wqoUWCvVtGjrMKd
 */

export type Profitic = {
  version: "0.1.0";
  name: "profitic";
  instructions: [
    {
      name: "initializePlatform";
      accounts: [
        { name: "platform"; isMut: true; isSigner: false },
        { name: "admin"; isMut: true; isSigner: true },
        { name: "treasury"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "creationFeeLamports"; type: "u64" },
        { name: "tradingFeeBps"; type: "u16" },
        { name: "resolutionFeeBps"; type: "u16" }
      ];
    },
    {
      name: "createMarket";
      accounts: [
        { name: "platform"; isMut: true; isSigner: false },
        { name: "market"; isMut: true; isSigner: false },
        { name: "yesMint"; isMut: true; isSigner: false },
        { name: "noMint"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "treasury"; isMut: true; isSigner: false },
        { name: "creator"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "rent"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "question"; type: "string" },
        { name: "description"; type: "string" },
        { name: "resolutionTimestamp"; type: "i64" },
        { name: "dataSource"; type: "string" }
      ];
    },
    {
      name: "buyTokens";
      accounts: [
        { name: "platform"; isMut: false; isSigner: false },
        { name: "market"; isMut: true; isSigner: false },
        { name: "outcomeMint"; isMut: true; isSigner: false },
        { name: "userTokenAccount"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "treasury"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "buyer"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "outcome"; type: "u8" },
        { name: "amount"; type: "u64" },
        { name: "maxCost"; type: "u64" }
      ];
    },
    {
      name: "sellTokens";
      accounts: [
        { name: "platform"; isMut: false; isSigner: false },
        { name: "market"; isMut: true; isSigner: false },
        { name: "outcomeMint"; isMut: true; isSigner: false },
        { name: "userTokenAccount"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "treasury"; isMut: true; isSigner: false },
        { name: "seller"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "outcome"; type: "u8" },
        { name: "amount"; type: "u64" },
        { name: "minReturn"; type: "u64" }
      ];
    },
    {
      name: "resolveMarket";
      accounts: [
        { name: "platform"; isMut: false; isSigner: false },
        { name: "market"; isMut: true; isSigner: false },
        { name: "admin"; isMut: false; isSigner: true }
      ];
      args: [
        { name: "winningOutcome"; type: "u8" },
        { name: "evidenceUrl"; type: "string" }
      ];
    },
    {
      name: "claimWinnings";
      accounts: [
        { name: "platform"; isMut: false; isSigner: false },
        { name: "market"; isMut: true; isSigner: false },
        { name: "winningMint"; isMut: true; isSigner: false },
        { name: "userTokenAccount"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "treasury"; isMut: true; isSigner: false },
        { name: "claimer"; isMut: true; isSigner: true },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "Platform";
      type: {
        kind: "struct";
        fields: [
          { name: "admin"; type: "publicKey" },
          { name: "treasury"; type: "publicKey" },
          { name: "creationFeeLamports"; type: "u64" },
          { name: "tradingFeeBps"; type: "u16" },
          { name: "resolutionFeeBps"; type: "u16" },
          { name: "marketCount"; type: "u64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "Market";
      type: {
        kind: "struct";
        fields: [
          { name: "id"; type: "u64" },
          { name: "creator"; type: "publicKey" },
          { name: "question"; type: "string" },
          { name: "description"; type: "string" },
          { name: "resolutionTimestamp"; type: "i64" },
          { name: "dataSource"; type: "string" },
          { name: "status"; type: { defined: "MarketStatus" } },
          { name: "yesMint"; type: "publicKey" },
          { name: "noMint"; type: "publicKey" },
          { name: "yesSupply"; type: "u64" },
          { name: "noSupply"; type: "u64" },
          { name: "poolBalance"; type: "u64" },
          { name: "winningOutcome"; type: { option: "u8" } },
          { name: "evidenceUrl"; type: "string" },
          { name: "proposedOutcome"; type: { option: "u8" } },
          { name: "proposedEvidenceUrl"; type: "string" },
          { name: "proposedEvidenceSnapshot"; type: "string" },
          { name: "proposalTimestamp"; type: { option: "i64" } },
          { name: "challengeStake"; type: "u64" },
          { name: "createdAt"; type: "i64" },
          { name: "bump"; type: "u8" },
          { name: "vaultBump"; type: "u8" }
        ];
      };
    },
    {
      name: "UserPosition";
      type: {
        kind: "struct";
        fields: [
          { name: "market"; type: "publicKey" },
          { name: "user"; type: "publicKey" },
          { name: "claimed"; type: "bool" },
          { name: "bump"; type: "u8" }
        ];
      };
    }
  ];
  types: [
    {
      name: "MarketStatus";
      type: {
        kind: "enum";
        variants: [
          { name: "Active" },
          { name: "ProposedResolution" },
          { name: "Resolved" },
          { name: "Cancelled" }
        ];
      };
    }
  ];
};

export const IDL: Profitic = {
  version: "0.1.0",
  name: "profitic",
  instructions: [
    {
      name: "initializePlatform",
      accounts: [
        { name: "platform", isMut: true, isSigner: false },
        { name: "admin", isMut: true, isSigner: true },
        { name: "treasury", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "creationFeeLamports", type: "u64" },
        { name: "tradingFeeBps", type: "u16" },
        { name: "resolutionFeeBps", type: "u16" },
      ],
    },
    {
      name: "createMarket",
      accounts: [
        { name: "platform", isMut: true, isSigner: false },
        { name: "market", isMut: true, isSigner: false },
        { name: "yesMint", isMut: true, isSigner: false },
        { name: "noMint", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "creator", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "question", type: "string" },
        { name: "description", type: "string" },
        { name: "resolutionTimestamp", type: "i64" },
        { name: "dataSource", type: "string" },
      ],
    },
    {
      name: "buyTokens",
      accounts: [
        { name: "platform", isMut: false, isSigner: false },
        { name: "market", isMut: true, isSigner: false },
        { name: "outcomeMint", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "buyer", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "outcome", type: "u8" },
        { name: "amount", type: "u64" },
        { name: "maxCost", type: "u64" },
      ],
    },
    {
      name: "sellTokens",
      accounts: [
        { name: "platform", isMut: false, isSigner: false },
        { name: "market", isMut: true, isSigner: false },
        { name: "outcomeMint", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "seller", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "outcome", type: "u8" },
        { name: "amount", type: "u64" },
        { name: "minReturn", type: "u64" },
      ],
    },
    {
      name: "resolveMarket",
      accounts: [
        { name: "platform", isMut: false, isSigner: false },
        { name: "market", isMut: true, isSigner: false },
        { name: "admin", isMut: false, isSigner: true },
      ],
      args: [
        { name: "winningOutcome", type: "u8" },
        { name: "evidenceUrl", type: "string" },
      ],
    },
    {
      name: "claimWinnings",
      accounts: [
        { name: "platform", isMut: false, isSigner: false },
        { name: "market", isMut: true, isSigner: false },
        { name: "winningMint", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "claimer", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Platform",
      type: {
        kind: "struct",
        fields: [
          { name: "admin", type: "publicKey" },
          { name: "treasury", type: "publicKey" },
          { name: "creationFeeLamports", type: "u64" },
          { name: "tradingFeeBps", type: "u16" },
          { name: "resolutionFeeBps", type: "u16" },
          { name: "marketCount", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "creator", type: "publicKey" },
          { name: "question", type: "string" },
          { name: "description", type: "string" },
          { name: "resolutionTimestamp", type: "i64" },
          { name: "dataSource", type: "string" },
          { name: "status", type: { defined: "MarketStatus" } },
          { name: "yesMint", type: "publicKey" },
          { name: "noMint", type: "publicKey" },
          { name: "yesSupply", type: "u64" },
          { name: "noSupply", type: "u64" },
          { name: "poolBalance", type: "u64" },
          { name: "winningOutcome", type: { option: "u8" } },
          { name: "evidenceUrl", type: "string" },
          { name: "proposedOutcome", type: { option: "u8" } },
          { name: "proposedEvidenceUrl", type: "string" },
          { name: "proposedEvidenceSnapshot", type: "string" },
          { name: "proposalTimestamp", type: { option: "i64" } },
          { name: "challengeStake", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" },
          { name: "vaultBump", type: "u8" },
        ],
      },
    },
    {
      name: "UserPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "market", type: "publicKey" },
          { name: "user", type: "publicKey" },
          { name: "claimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "MarketStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Active" },
          { name: "ProposedResolution" },
          { name: "Resolved" },
          { name: "Cancelled" },
        ],
      },
    },
  ],
};
