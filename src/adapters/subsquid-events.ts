// src/adapters/subsquid-events.ts (New file or add to existing adapters)

import { type Hash, type Hex } from 'viem';
import { DataEntry, RailgunEventType } from '../types/data-entry';
import { DataCompleteness } from '../types/datasource';

// mimics subsquid graphql.schema, we might need to revisit that ??
export interface SubsquidNullifierData {
    id: string;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: Hash;
    treeNumber: number;
    nullifier: Hash;
}


export function adaptSubsquidNullifier(
    // Use the locally defined interface here
    sqNullifierData: SubsquidNullifierData
): DataEntry | null {

    try {
        const blockNumber = BigInt(sqNullifierData.blockNumber);
        const blockTimestamp = parseInt(sqNullifierData.blockTimestamp, 10); // Or BigInt if needed downstream
        const transactionHash = sqNullifierData.transactionHash;
        const nullifierHex = sqNullifierData.nullifier; // Use the dedicated field
        const treeNumber = sqNullifierData.treeNumber;

        if (!nullifierHex || !nullifierHex.startsWith('0x') || nullifierHex.length !== 66) {
             console.warn(`Subsquid Adapter: Invalid nullifier hex format: ${nullifierHex} in ID: ${sqNullifierData.id}`);
             return null;
        }
         if (isNaN(blockTimestamp)) {
             console.warn(`Subsquid Adapter: Invalid block timestamp: ${sqNullifierData.blockTimestamp} in ID: ${sqNullifierData.id}`);
             return null; // or use a default, but null indicates bad data
         }
         

        const logIndex = -1; // @@todo: what
        const railgunTxid = undefined; // Q: How do we get this from subsquid source nowadays? with current is not possible yet

        return {
            type: RailgunEventType.Nullifiers,
            source: 'subsquid',
            blockNumber: blockNumber,
            transactionHash: transactionHash,
            logIndex: logIndex,
            blockTimestamp: blockTimestamp,
            completeness: DataCompleteness.COMPLETE,
            railgunTxid: railgunTxid,
            payload: {
                treeNumber: treeNumber,
                nullifiers: [nullifierHex],
            },
        };
    } catch (error) {
        console.error(`Subsquid Adapter: Error adapting nullifier id ${sqNullifierData?.id}:`, error);
        return null;
    }
}

// add adapters for other Subsquid event types (CommitmentBatch, etc.) ---
// export function adaptSubsquidCommitmentBatch(...)
// export function adaptSubsquidShield(...)
// export function adaptSubsquidUnshield(...)