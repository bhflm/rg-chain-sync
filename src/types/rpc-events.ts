import { type Address, type Hash, type Hex } from 'viem';

export interface CommitmentBatchEventArgs {
  treeNumber: bigint;
  startPosition: bigint;
  hash: readonly Hash[]; // Array of bytes32
  // Add 'ciphertext' if needed by the adapter later
}

export interface NullifiersEventArgs {
  treeNumber: bigint;
  nullifier: readonly bigint[] | readonly Hash[]; // Array of bytes32
}

export interface UnshieldEventArgs {
  to: Address;
  token: { // Assuming structure based on V2 ABI
      tokenType: number; // uint8
      tokenAddress: Address;
      tokenSubID: bigint;
  };
  amount: bigint;
  fee: bigint;
}

export interface ShieldEventArgs {
  treeNumber: bigint;
  startPosition: bigint;
  commitments: readonly { // Array of CommitmentPreimage structs
      npk: Hash; // bytes32
      token: {
          tokenType: number;
          tokenAddress: Address;
          tokenSubID: bigint;
      };
      value: bigint; // uint120
  }[];
  shieldCiphertext: readonly { // Array of ShieldCiphertext structs
       encryptedBundle: readonly [Hash, Hash, Hash]; // bytes32[3]
       shieldKey: Hash; // bytes32
  }[];
  fees: readonly bigint[];
}