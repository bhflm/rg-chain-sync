import { type Address, type Hash } from 'viem';
export interface CommitmentBatchEventArgs {
    treeNumber: bigint;
    startPosition: bigint;
    hash: readonly Hash[];
}
export interface NullifiersEventArgs {
    treeNumber: bigint;
    nullifier: readonly bigint[] | readonly Hash[];
}
export interface UnshieldEventArgs {
    to: Address;
    token: {
        tokenType: number;
        tokenAddress: Address;
        tokenSubID: bigint;
    };
    amount: bigint;
    fee: bigint;
}
export interface ShieldEventArgs {
    treeNumber: bigint;
    startPosition: bigint;
    commitments: readonly {
        npk: Hash;
        token: {
            tokenType: number;
            tokenAddress: Address;
            tokenSubID: bigint;
        };
        value: bigint;
    }[];
    shieldCiphertext: readonly {
        encryptedBundle: readonly [Hash, Hash, Hash];
        shieldKey: Hash;
    }[];
    fees: readonly bigint[];
}
