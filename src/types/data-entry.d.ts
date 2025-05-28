import { type Address, type Hash, type Hex } from 'viem';
export declare enum RailgunEventType {
    V1_GeneratedCommitmentBatch = "GeneratedCommitmentBatch_V1",
    V1_CommitmentBatch = "CommitmentBatch_V1",
    V1_Nullifiers = "Nullifiers_V1",
    CommitmentBatch = "CommitmentBatch",
    GeneratedCommitmentBatch = "GeneratedCommitmentBatch",// V2/V2-Legacy (if args match)
    Nullifiers = "Nullifiers",// V2/V2-Legacy (if args match) - NOTE: V1/V2 names clash! Renamed V1 above.
    Shield = "Shield",
    Unshield = "Unshield",
    Transact = "Transact"
}
interface CommitmentBatchPayload {
    treeNumber: number;
    startPosition: number;
    commitments: {
        hash: Hex;
        index: number;
        ciphertext?: {
            ephemeralKeys: Hash[];
            memo: string;
            data: Hash[];
            iv: Hash;
            tag: Hash;
        };
    }[];
}
interface GeneratedCommitmentBatchPayload {
    treeNumber: number;
    startPosition: number;
    commitments: {
        hash: Hex;
        index: number;
        preimage: {
            npk: Hex;
            token: {
                tokenType: number;
                tokenAddress: Address;
                tokenSubID: bigint;
            };
            value: bigint;
        };
        encryptedRandom: Hash[] | [Hash, Hash] | bigint[];
    }[];
}
interface NullifiersPayload {
    treeNumber: number;
    nullifiers: Hex[];
}
interface UnshieldPayload {
    to: Address;
    tokenAddress: Address;
    tokenType: number;
    tokenSubID: bigint;
    amount: bigint;
    fee: bigint;
}
interface ShieldPayload {
    treeNumber: number;
    startPosition: number;
    commitments: {
        hash: Hex;
        index: number;
        preimage: {
            npk: Hex;
            token: {
                tokenType: number;
                tokenAddress: Address;
                tokenSubID: bigint;
            };
            value: bigint;
        };
        encryptedBundle?: Hash[];
        shieldKey?: Hash;
    }[];
    fees: bigint[];
}
interface TransactPayload {
    treeNumber: number;
    startPosition: number;
    commitments: {
        hash: Hex;
        index: number;
        ciphertext?: {
            data: Hash[] | readonly Hash[];
            blindedSenderViewingKey: Hash;
            blindedReceiverViewingKey: Hash;
            annotationData: string;
            memo: string;
        };
    }[];
}
interface BaseDataEntry {
    /** Identifier for the data source ('rpc', 'subsquid', 'snapshot') */
    source: string;
    /** Blockchain block number */
    blockNumber: bigint;
    /** Hash of the Ethereum transaction */
    transactionHash: Hash;
    /** Log index within the block */
    logIndex: number;
    /** Block timestamp (seconds since epoch) - Crucial for ordering */
    blockTimestamp: number;
    /** Optional: RAILGUN transaction ID (often only from Subsquid/processed data) */
    railgunTxid?: string;
}
/***
 * this is where the meat is, explanation further below
 *
 * some context:
 * among the very begginig I've tackled this like RpcSource<OneSource>
 * later did realise we might not want to RpcSource<CommitmentData> or RpcSource<NullifierData> because
 * it implies several rpc calls (just for this source) for the same block, and then, probably, for the same block, we would query
 * one rpc call eth_getLogs for CommitemntData, and another for NullifierData
 * which using client.getLogs from viem sounds nice and all, and less heavy on client side
 *
 *
 * later on did realise we can sacrifice this _performance_ and move it client side for parsing it here, but we'd be able
 * to get a raw logs from an entire block, and parse it for several different entities (nullifierData, commitmentdata, commitmentBatch data)
 * etc
 *
 *
 * since handling several iterators for different sources (commitments from rpc, nullifiers from subsquid, nullifiers from rpc, etc)
 * sounds like a big big mess, merging all of them increases the need for mantaining and making a tailored iterator for each source
 *
 *
 * narrowing down this data entry a little bit, iterators can return AsyncIterator<DataEntry>, its a single stream, it has mixed entities
 * it provides type safety
 *
 * also, its better since we just do ONE instance of RpcProvider, and we can use it for all the data sources
 *
 * tldr; instead of saying "give me a source that only produces Commitments",
 * the abstraction says "give me a source that produces all relevant events for this configuration,
 * and I'll deal with the different types as they come out".
 * The DataEntry discriminated union below is the mechanism that allows the single stream to carry different types of data
 *
 */
export type DataEntry = BaseDataEntry & {
    type: RailgunEventType.CommitmentBatch;
    payload: CommitmentBatchPayload;
} | BaseDataEntry & {
    type: RailgunEventType.Nullifiers;
    payload: NullifiersPayload;
} | BaseDataEntry & {
    type: RailgunEventType.Unshield;
    payload: UnshieldPayload;
} | BaseDataEntry & {
    type: RailgunEventType.Shield;
    payload: ShieldPayload;
} | BaseDataEntry & {
    type: RailgunEventType.Transact;
    payload: TransactPayload;
} | BaseDataEntry & {
    type: RailgunEventType.GeneratedCommitmentBatch;
    payload: GeneratedCommitmentBatchPayload;
};
export declare function isCommitmentBatchEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.CommitmentBatch;
    payload: CommitmentBatchPayload;
};
export declare function isNullifiersEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.Nullifiers;
    payload: NullifiersPayload;
};
export declare function isUnshieldEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.Unshield;
    payload: UnshieldPayload;
};
export declare function isShieldEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.Shield;
    payload: ShieldPayload;
};
export declare function isTransactEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.Transact;
    payload: TransactPayload;
};
export declare function isGeneratedCommitmentBatchEntry(entry: DataEntry): entry is BaseDataEntry & {
    type: RailgunEventType.GeneratedCommitmentBatch;
    payload: GeneratedCommitmentBatchPayload;
};
export {};
