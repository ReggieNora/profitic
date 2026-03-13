export type YieldFarmProgram = {
  "version": "0.1.0",
  "name": "yield_farm",
  "instructions": [
    {
      "name": "initializeFarm",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "rewardAuthority", "type": "publicKey" }]
    },
    {
      "name": "stake",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "unstake",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "claimRewards",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "fundVault",
      "accounts": [
        { "name": "farmConfig", "isMut": false, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "funder", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "setPaused",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": [{ "name": "paused", "type": "bool" }]
    }
  ],
  "accounts": [
    {
      "name": "farmConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "rewardAuthority", "type": "publicKey" },
          { "name": "totalStaked", "type": "u64" },
          { "name": "totalStakers", "type": "u64" },
          { "name": "totalRewardsDistributed", "type": "u64" },
          { "name": "paused", "type": "bool" }
        ]
      }
    },
    {
      "name": "userStake",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "user", "type": "publicKey" },
          { "name": "stakedAmount", "type": "u64" },
          { "name": "lastStakeTs", "type": "i64" },
          { "name": "lastClaimTs", "type": "i64" },
          { "name": "pendingRewards", "type": "u64" },
          { "name": "totalClaimed", "type": "u64" },
          { "name": "streakStartTs", "type": "i64" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "ZeroAmount", "msg": "Amount must be greater than zero." },
    { "code": 6001, "name": "InsufficientStake", "msg": "Insufficient staked balance." },
    { "code": 6002, "name": "NothingStaked", "msg": "Nothing staked." },
    { "code": 6003, "name": "NothingToClaim", "msg": "No rewards to claim." },
    { "code": 6004, "name": "InsufficientVaultFunds", "msg": "Insufficient funds in vault." },
    { "code": 6005, "name": "FarmPaused", "msg": "Farm is currently paused." },
    { "code": 6006, "name": "Overflow", "msg": "Arithmetic overflow." },
    { "code": 6007, "name": "Unauthorized", "msg": "Unauthorized." }
  ]
};

export const YIELD_FARM_IDL: YieldFarmProgram = {
  "version": "0.1.0",
  "name": "yield_farm",
  "instructions": [
    {
      "name": "initializeFarm",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "rewardAuthority", "type": "publicKey" }]
    },
    {
      "name": "stake",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "unstake",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "claimRewards",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "userStake", "isMut": true, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "fundVault",
      "accounts": [
        { "name": "farmConfig", "isMut": false, "isSigner": false },
        { "name": "stakeVault", "isMut": true, "isSigner": false },
        { "name": "funder", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "setPaused",
      "accounts": [
        { "name": "farmConfig", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": [{ "name": "paused", "type": "bool" }]
    }
  ],
  "accounts": [
    {
      "name": "farmConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "rewardAuthority", "type": "publicKey" },
          { "name": "totalStaked", "type": "u64" },
          { "name": "totalStakers", "type": "u64" },
          { "name": "totalRewardsDistributed", "type": "u64" },
          { "name": "paused", "type": "bool" }
        ]
      }
    },
    {
      "name": "userStake",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "user", "type": "publicKey" },
          { "name": "stakedAmount", "type": "u64" },
          { "name": "lastStakeTs", "type": "i64" },
          { "name": "lastClaimTs", "type": "i64" },
          { "name": "pendingRewards", "type": "u64" },
          { "name": "totalClaimed", "type": "u64" },
          { "name": "streakStartTs", "type": "i64" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "ZeroAmount", "msg": "Amount must be greater than zero." },
    { "code": 6001, "name": "InsufficientStake", "msg": "Insufficient staked balance." },
    { "code": 6002, "name": "NothingStaked", "msg": "Nothing staked." },
    { "code": 6003, "name": "NothingToClaim", "msg": "No rewards to claim." },
    { "code": 6004, "name": "InsufficientVaultFunds", "msg": "Insufficient funds in vault." },
    { "code": 6005, "name": "FarmPaused", "msg": "Farm is currently paused." },
    { "code": 6006, "name": "Overflow", "msg": "Arithmetic overflow." },
    { "code": 6007, "name": "Unauthorized", "msg": "Unauthorized." }
  ]
};
