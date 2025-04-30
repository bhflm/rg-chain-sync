import { DataEntry, RailgunEventType } from "../../types/data-entry";
import {
  adaptSubsquidNullifier,
  adaptSubsquidUnshield,
  adaptSubsquidCommitment,
  adaptSubsquidTransaction,
  AdaptedSubsquidTransaction,
} from "../../adapters/subsquid-events";
import { Hash } from "viem";

/**
 * Maps raw Subsquid query results to DataEntry objects
 * If eventTypes is provided, only events of those types will be included
 */
export function mapEventToDataEntries(
  result: any,
  eventTypes?: RailgunEventType[]
): DataEntry[] {
  const adaptedEvents: DataEntry[] = [];

  // Extract transactions for railgunTxid correlation
  const transactionsMap = new Map<Hash, AdaptedSubsquidTransaction>();
  const transactions = result.transactions || [];

  for (const tx of transactions) {
    const adaptedTx = adaptSubsquidTransaction(tx);
    if (adaptedTx) {
      transactionsMap.set(adaptedTx.transactionHash, adaptedTx);
    }
  }

  // Process nullifiers
  const nullifiers = result.nullifiers || [];
  for (const nullifier of nullifiers) {
    const railgunTx = transactionsMap.get(nullifier.transactionHash);
    const adaptedNullifier = adaptSubsquidNullifier(nullifier, railgunTx?.id);
    
    if (adaptedNullifier && (!eventTypes || eventTypes.includes(RailgunEventType.Nullifiers))) {
      adaptedEvents.push(adaptedNullifier);
    }
  }

  // Process unshields
  const unshields = result.unshields || [];
  for (const unshield of unshields) {
    const railgunTx = transactionsMap.get(unshield.transactionHash);
    const adaptedUnshield = adaptSubsquidUnshield(unshield, railgunTx?.id);
    
    if (adaptedUnshield && (!eventTypes || eventTypes.includes(RailgunEventType.Unshield))) {
      adaptedEvents.push(adaptedUnshield);
    }
  }

  // Process all commitments
  const commitments = result.commitments || [];
  for (const commitment of commitments) {
    const railgunTx = transactionsMap.get(commitment.transactionHash);
    const adaptedCommitment = adaptSubsquidCommitment(commitment, railgunTx?.id);
    
    if (adaptedCommitment) {
      // Only include the commitment if it matches the requested event types
      if (!eventTypes || eventTypes.includes(adaptedCommitment.type)) {
        adaptedEvents.push(adaptedCommitment);
      }
    }
  }

  return adaptedEvents;
}

/**
 * Sorts DataEntry objects by blockNumber, logIndex, and transactionHash
 */
export function sortDataEntries(entries: DataEntry[]): DataEntry[] {
  return [...entries].sort((a, b) => {
    // First sort by block number
    if (a.blockNumber !== b.blockNumber) {
      return Number(a.blockNumber - b.blockNumber);
    }

    // Then by log index if both have valid indices
    if (a.logIndex !== -1 && b.logIndex !== -1) {
      return a.logIndex - b.logIndex;
    }

    // Otherwise sort by transaction hash for stable ordering
    return a.transactionHash < b.transactionHash ? -1 : 1;
  });
}