import { Hash, Hex, Address } from "viem";

import { DataCompleteness } from "../types/datasource";
import { DataEntry, RailgunEventType } from "../types/data-entry";
import {
  CommitmentBatchEventArgs,
  NullifiersEventArgs,
  UnshieldEventArgs,
  ShieldEventArgs,
} from "../types/rpc-events";
import { ByteUtils, ByteLength } from "../utils/bytes";

export function adaptParsedCommitmentBatch(
  log: any, // Keep 'any' for now, but assert inside
  timestamp: number,
): DataEntry {
  // Assert the structure of args based on the expected ABI for CommitmentBatch
  const args = log.args as CommitmentBatchEventArgs; // <--- TYPE ASSERTION @TODO: Remove this, find a clever way of infer the type as in subsquid

  // Check if assertion holds (optional runtime check)
  if (
    !args ||
    typeof args.treeNumber === "undefined" ||
    !Array.isArray(args.hash)
  ) {
    console.error("RPC Adapter: Invalid args for CommitmentBatch", log);
    throw new Error("Invalid CommitmentBatch event args");
  }

  const commitments = (args.hash || []).map((hash: Hash, index: number) => ({
    // Now args.hash is typed
    hash: hash,
    index: Number(args.startPosition) + index, // Now args.startPosition is typed
  }));

  return {
    type: RailgunEventType.CommitmentBatch,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber), // Now args.treeNumber is typed
      startPosition: Number(args.startPosition), // Now args.startPosition is typed
      commitments: commitments,
    },
  };
}

export function adaptParsedNullifiers(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry[] {
  const args = log.args as NullifiersEventArgs; // <--- TYPE ASSERTION @TODO: Remove this, find a clever way of infer the type as in subsquid

  if (
    !args ||
    typeof args.treeNumber === "undefined" ||
    !Array.isArray(args.nullifier)
  ) {
    console.error("RPC Adapter: Invalid args for Nullifiers", log);
    throw new Error("Invalid Nullifiers event args");
  }

  // Assuming V2 'Nullifiers' event has 'nullifier: bytes32[]'
  const nullifiers = args.nullifier || [];

  if (nullifiers.length === 0) {
    // Handle case where the array might be empty, though unlikely for this event
    return [];
  }

  const formattedNullifiers: Hex[] = nullifiers.map((n): Hex => {
    if (typeof n === "bigint") {
      return ByteUtils.nToHex(n, ByteLength.UINT_256) as Hex; // CAS T CAST CAST C A S S TT  TT TDSGJNSDJNKSDFJN
    } else if (typeof n === "string" && n.startsWith("0x")) {
      // It's likely a V2 nullifier (bytes32/Hash), ensure correct length (optional but good)
      // return ByteUtils.formatToByteLength(n, ByteLength.UINT_256); // Or just return n if always correct
      return n as Hash; // Already a Hex string
    } else {
      console.warn(`Unexpected nullifier type in adapter: ${typeof n}`, n);
      // Return a placeholder or throw an error, depending on desired strictness
      return ("0x" + "0".repeat(64)) as Hex; // Placeholder invalid nullifier
    }
  });

  return formattedNullifiers.map((formattedNullifier) => ({
    type: RailgunEventType.Nullifiers,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex, // All entries from this log share the same tx/logIndex
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber),
      nullifiers: [formattedNullifier], // Payload contains the single formatted hex string
    },
  }));
}

export function adaptParsedUnshield(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry {
  const args = log.args as UnshieldEventArgs; // <--- TYPE ASSERTION @TODO: Remove this, find a clever way of infer the type as in subsquid

  if (!args || !args.token || typeof args.amount === "undefined") {
    console.error("RPC Adapter: Invalid args for Unshield", log);
    throw new Error("Invalid Unshield event args");
  }

  return {
    type: RailgunEventType.Unshield,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      to: args.to,
      tokenAddress: args.token.tokenAddress,
      tokenType: args.token.tokenType,
      tokenSubID: args.token.tokenSubID,
      amount: args.amount,
      fee: args.fee,
    },
  };
}

export function adaptParsedShield(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry {
  const args = log.args as ShieldEventArgs; // <--- TYPE ASSERTION @TODO: Remove this, find a clever way of infer the type as in subsquid

  if (
    !args ||
    !Array.isArray(args.commitments) ||
    typeof args.startPosition === "undefined"
  ) {
    console.error("RPC Adapter: Invalid args for Shield", log);
    throw new Error("Invalid Shield event args");
  }

  const commitments = (args.commitments || []).map(
    (preimage, index: number) => {
      // TODO: Replace placeholder with actual hashing!
      const hash = ByteUtils.formatToByteLength(
        "0x" + Math.random().toString(16).slice(2),
        ByteLength.UINT_256,
      ) as Hash;

      return {
        hash: hash,
        index: Number(args.startPosition) + index,
        preimage: {
          npk: preimage.npk,
          token: {
            tokenType: preimage.token.tokenType,
            tokenAddress: preimage.token.tokenAddress,
            tokenSubID: preimage.token.tokenSubID,
          },
          value: preimage.value,
        },
      };
    },
  );

  return {
    type: RailgunEventType.Shield,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber),
      startPosition: Number(args.startPosition),
      commitments: commitments,
      fees: args.fees ? [...args.fees] : [],
    },
  };
}

export function adaptParsedGeneratedCommitmentBatch(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry {
  // Define the event args interface specifically for this adapter
  interface GeneratedCommitmentBatchEventArgs {
    treeNumber: bigint;
    startPosition: bigint;
    commitments: readonly {
      npk: bigint | Hash;
      token: {
        tokenType: number;
        tokenAddress: Address;
        tokenSubID: bigint;
      };
      value: bigint;
    }[];
    encryptedRandom: readonly [Hash, Hash][] | readonly bigint[][];
  }

  const args = log.args as GeneratedCommitmentBatchEventArgs;

  if (
    !args ||
    typeof args.treeNumber === "undefined" ||
    typeof args.startPosition === "undefined" ||
    !Array.isArray(args.commitments) ||
    !Array.isArray(args.encryptedRandom)
  ) {
    console.error("RPC Adapter: Invalid args for GeneratedCommitmentBatch", log);
    throw new Error("Invalid GeneratedCommitmentBatch event args");
  }

  const commitments = (args.commitments || []).map((commitment, index: number) => {
    // Create hash from the commitment preimage 
    // In a real implementation, this would hash the commitment preimage
    // For now, we'll use a placeholder hash
    const hash = ByteUtils.formatToByteLength(
      "0x" + Math.random().toString(16).slice(2),
      ByteLength.UINT_256,
    ) as Hash;

    return {
      hash: hash,
      index: Number(args.startPosition) + index,
      preimage: {
        npk: typeof commitment.npk === "bigint" 
          ? ByteUtils.nToHex(commitment.npk, ByteLength.UINT_256) as Hash
          : commitment.npk as Hash,
        token: {
          tokenType: commitment.token.tokenType,
          tokenAddress: commitment.token.tokenAddress,
          tokenSubID: commitment.token.tokenSubID,
        },
        value: commitment.value,
      },
      encryptedRandom: args.encryptedRandom[index] || [
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash,
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash,
      ],
    };
  });

  return {
    type: RailgunEventType.GeneratedCommitmentBatch,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber),
      startPosition: Number(args.startPosition),
      commitments: commitments,
    },
  };
}

// The Nullified event is essentially similar to Nullifiers but with a different event name
export function adaptParsedNullified(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry[] {
  interface NullifiedEventArgs {
    treeNumber: bigint;
    nullifier: readonly bigint[] | readonly Hash[]; // Array of bytes32
  }

  const args = log.args as NullifiedEventArgs;

  if (
    !args ||
    typeof args.treeNumber === "undefined" ||
    !Array.isArray(args.nullifier)
  ) {
    console.error("RPC Adapter: Invalid args for Nullified", log);
    throw new Error("Invalid Nullified event args");
  }

  // Process nullifiers
  const nullifiers = args.nullifier || [];

  if (nullifiers.length === 0) {
    return [];
  }

  const formattedNullifiers: Hex[] = nullifiers.map((n): Hex => {
    if (typeof n === "bigint") {
      return ByteUtils.nToHex(n, ByteLength.UINT_256) as Hex;
    } else if (typeof n === "string" && n.startsWith("0x")) {
      return n as Hash;
    } else {
      console.warn(`Unexpected nullifier type in adapter: ${typeof n}`, n);
      return ("0x" + "0".repeat(64)) as Hex; // Placeholder invalid nullifier
    }
  });

  return formattedNullifiers.map((formattedNullifier) => ({
    type: RailgunEventType.Nullifiers, // Note: We map to the same type as Nullifiers
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber),
      nullifiers: [formattedNullifier],
    },
  }));
}

// Adapter for the Transact event
export function adaptParsedTransact(
  log: any, // Keep 'any' for now, assert inside
  timestamp: number,
): DataEntry {
  interface TransactEventArgs {
    treeNumber: bigint;
    startPosition: bigint;
    hash: readonly Hash[]; // Array of bytes32
    ciphertext: readonly {
      ciphertext: readonly Hash[];
      blindedSenderViewingKey: Hash;
      blindedReceiverViewingKey: Hash;
      annotationData: string;
      memo: string;
    }[];
  }

  const args = log.args as TransactEventArgs;

  if (
    !args ||
    typeof args.treeNumber === "undefined" ||
    typeof args.startPosition === "undefined" ||
    !Array.isArray(args.hash) ||
    !Array.isArray(args.ciphertext)
  ) {
    console.error("RPC Adapter: Invalid args for Transact", log);
    throw new Error("Invalid Transact event args");
  }

  const commitments = (args.hash || []).map((hash: Hash, index: number) => ({
    hash: hash,
    index: Number(args.startPosition) + index,
    ciphertext: args.ciphertext[index] ? {
      data: args.ciphertext[index].ciphertext,
      blindedSenderViewingKey: args.ciphertext[index].blindedSenderViewingKey,
      blindedReceiverViewingKey: args.ciphertext[index].blindedReceiverViewingKey,
      annotationData: args.ciphertext[index].annotationData,
      memo: args.ciphertext[index].memo,
    } : undefined,
  }));

  return {
    type: RailgunEventType.Transact,
    source: "rpc",
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: timestamp,
    completeness: DataCompleteness.BASIC,
    railgunTxid: undefined,
    payload: {
      treeNumber: Number(args.treeNumber),
      startPosition: Number(args.startPosition),
      commitments: commitments,
    },
  };
}
