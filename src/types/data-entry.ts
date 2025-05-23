// src/types/data-entry.ts

import { type Address, type Hash, type Hex } from 'viem';


export enum RailgunEventType {
  V1_GeneratedCommitmentBatch = 'GeneratedCommitmentBatch_V1',
  V1_CommitmentBatch = 'CommitmentBatch_V1',
  V1_Nullifiers = 'Nullifiers_V1',
  CommitmentBatch = 'CommitmentBatch', 
  GeneratedCommitmentBatch = 'GeneratedCommitmentBatch', // V2/V2-Legacy (if args match)
  Nullifiers = 'Nullifiers',             // V2/V2-Legacy (if args match) - NOTE: V1/V2 names clash! Renamed V1 above.
  Shield = 'Shield',
  Unshield = 'Unshield',
  Transact = 'Transact', // V2/V2-Legacy
}

interface CommitmentBatchPayload {
  treeNumber: number;
  startPosition: number;
  commitments: {
    hash: Hex;
    index: number; // Global index within the tree
    // For LegacyEncryptedCommitment
    ciphertext?: {
      ephemeralKeys: Hash[];
      memo: string;
      data: Hash[];
      iv: Hash;
      tag: Hash;
    };
  }[];
}

// Updated payload for GeneratedCommitmentBatch to include preimage and encryptedRandom
interface GeneratedCommitmentBatchPayload {
  treeNumber: number;
  startPosition: number;
  commitments: {
    hash: Hex;
    index: number; // Global index within the tree
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

// Example: Nullifiers (Note: V1 emitted uint256[], V2 emits bytes32[])
interface NullifiersPayload {
  treeNumber: number;
  nullifiers: Hex[]; // Standardize to Hex strings
}

// Example: Unshield
interface UnshieldPayload {
  to: Address;
  tokenAddress: Address;
  tokenType: number; // Assuming number based on ABI enum
  tokenSubID: bigint;
  amount: bigint;
  fee: bigint;
  // From which transaction was this unshielded? Often part of the parent Transact event.
  // We might need more context from the AggregatedSource later.
}

// Example: Shield
interface ShieldPayload {
  treeNumber: number;
  startPosition: number;
  commitments: {
    hash: Hex; // The hash derived from preimage
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
    // For ShieldCommitment - these are optional to allow for both RPC and Subsquid adapters
    encryptedBundle?: Hash[];
    shieldKey?: Hash;
  }[];
  fees: bigint[]; // Array of fees matching commitments
}

// Interface for Transact event payload
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


// base entry shared across all data sources ??
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
  railgunTxid?: string; // Usually undefined for raw RPC
  // have logs ???
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

export type DataEntry =
  | BaseDataEntry & {
      type: RailgunEventType.CommitmentBatch; // Use the enum value
      payload: CommitmentBatchPayload;
    }
  | BaseDataEntry & {
      type: RailgunEventType.Nullifiers;
      payload: NullifiersPayload;
    }
   | BaseDataEntry & {
      type: RailgunEventType.Unshield;
      payload: UnshieldPayload;
    }
   | BaseDataEntry & {
      type: RailgunEventType.Shield;
      payload: ShieldPayload;
    }
   | BaseDataEntry & {
      type: RailgunEventType.Transact;
      payload: TransactPayload;
    }
   | BaseDataEntry & {
      type: RailgunEventType.GeneratedCommitmentBatch;
      payload: GeneratedCommitmentBatchPayload; // Use the new dedicated payload type
    }
    // blablabla
  // | BaseDataEntry & { type: RailgunEventType.V1_CommitmentBatch; payload: V1CommitmentBatchPayload; }
  // ... etc.
;

// some guards (optional, not really needed but meh)
export function isCommitmentBatchEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.CommitmentBatch; payload: CommitmentBatchPayload } {
    return entry.type === RailgunEventType.CommitmentBatch;
}

export function isNullifiersEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.Nullifiers; payload: NullifiersPayload } {
    return entry.type === RailgunEventType.Nullifiers;
}

export function isUnshieldEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.Unshield; payload: UnshieldPayload } {
    return entry.type === RailgunEventType.Unshield;
}

export function isShieldEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.Shield; payload: ShieldPayload } {
    return entry.type === RailgunEventType.Shield;
}

export function isTransactEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.Transact; payload: TransactPayload } {
    return entry.type === RailgunEventType.Transact;
}

export function isGeneratedCommitmentBatchEntry(entry: DataEntry): entry is BaseDataEntry & { type: RailgunEventType.GeneratedCommitmentBatch; payload: GeneratedCommitmentBatchPayload } {
    return entry.type === RailgunEventType.GeneratedCommitmentBatch;
}