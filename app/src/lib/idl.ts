export type Profitic = {
  version: "0.1.0";
  name: "profitic";
  instructions: [
    {
      name: "createMarket";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "creator"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "question"; type: "string" },
        { name: "description"; type: "string" },
        { name: "resolutionDate"; type: "i64" },
        { name: "dataSourceUrl"; type: "string" }
      ];
    },
    {
      name: "buyShares";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "buyer"; isMut: true; isSigner: true },
        { name: "marketVault"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "outcome"; type: { defined: "Outcome" } },
        { name: "amount"; type: "u64" },
        { name: "maxCost"; type: "u64" }
      ];
    },
    {
      name: "sellShares";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "seller"; isMut: true; isSigner: true },
        { name: "marketVault"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "outcome"; type: { defined: "Outcome" } },
        { name: "amount"; type: "u64" },
        { name: "minReturn"; type: "u64" }
      ];
    },
    {
      name: "resolveMarket";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "resolver"; isMut: true; isSigner: true }
      ];
      args: [
        { name: "outcome"; type: { defined: "Outcome" } },
        { name: "evidenceUrl"; type: "string" }
      ];
    },
    {
      name: "claimWinnings";
      accounts: [
        { name: "market"; isMut: true; isSigner: false },
        { name: "claimer"; isMut: true; isSigner: true },
        { name: "marketVault"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "Market";
      type: {
        kind: "struct";
        fields: [
          { name: "creator"; type: "publicKey" },
          { name: "question"; type: "string" },
          { name: "description"; type: "string" },
          { name: "resolutionDate"; type: "i64" },
          { name: "dataSourceUrl"; type: "string" },
          { name: "yesShares"; type: "u64" },
          { name: "noShares"; type: "u64" },
          { name: "totalVolume"; type: "u64" },
          { name: "liquidityPool"; type: "u64" },
          { name: "resolved"; type: "bool" },
          { name: "outcome"; type: { defined: "Outcome" } },
          { name: "evidenceUrl"; type: "string" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "UserPosition";
      type: {
        kind: "struct";
        fields: [
          { name: "owner"; type: "publicKey" },
          { name: "market"; type: "publicKey" },
          { name: "yesShares"; type: "u64" },
          { name: "noShares"; type: "u64" },
          { name: "totalDeposited"; type: "u64" },
          { name: "claimed"; type: "bool" },
          { name: "bump"; type: "u8" }
        ];
      };
    }
  ];
  types: [
    {
      name: "Outcome";
      type: {
        kind: "enum";
        variants: [
          { name: "Unresolved" },
          { name: "Yes" },
          { name: "No" },
          { name: "Invalid" }
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
      name: "createMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "creator", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "question", type: "string" },
        { name: "description", type: "string" },
        { name: "resolutionDate", type: "i64" },
        { name: "dataSourceUrl", type: "string" },
      ],
    },
    {
      name: "buyShares",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "buyer", isMut: true, isSigner: true },
        { name: "marketVault", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "outcome", type: { defined: "Outcome" } },
        { name: "amount", type: "u64" },
        { name: "maxCost", type: "u64" },
      ],
    },
    {
      name: "sellShares",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "seller", isMut: true, isSigner: true },
        { name: "marketVault", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "outcome", type: { defined: "Outcome" } },
        { name: "amount", type: "u64" },
        { name: "minReturn", type: "u64" },
      ],
    },
    {
      name: "resolveMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "resolver", isMut: true, isSigner: true },
      ],
      args: [
        { name: "outcome", type: { defined: "Outcome" } },
        { name: "evidenceUrl", type: "string" },
      ],
    },
    {
      name: "claimWinnings",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "claimer", isMut: true, isSigner: true },
        { name: "marketVault", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "publicKey" },
          { name: "question", type: "string" },
          { name: "description", type: "string" },
          { name: "resolutionDate", type: "i64" },
          { name: "dataSourceUrl", type: "string" },
          { name: "yesShares", type: "u64" },
          { name: "noShares", type: "u64" },
          { name: "totalVolume", type: "u64" },
          { name: "liquidityPool", type: "u64" },
          { name: "resolved", type: "bool" },
          { name: "outcome", type: { defined: "Outcome" } },
          { name: "evidenceUrl", type: "string" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "UserPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "market", type: "publicKey" },
          { name: "yesShares", type: "u64" },
          { name: "noShares", type: "u64" },
          { name: "totalDeposited", type: "u64" },
          { name: "claimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "Outcome",
      type: {
        kind: "enum",
        variants: [
          { name: "Unresolved" },
          { name: "Yes" },
          { name: "No" },
          { name: "Invalid" },
        ],
      },
    },
  ],
};
