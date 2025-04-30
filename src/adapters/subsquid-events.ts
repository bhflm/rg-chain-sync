import { type Hash, type Hex, type Address } from 'viem';
import { DataEntry, RailgunEventType } from '../types/data-entry';
import { CommitmentType } from '../types/events';

// Define interface types for Subsquid data structures
// These match the GraphQL schema's structure and types

export interface SubsquidNullifierData {
    id: string;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: Hash;
    treeNumber: number;
    nullifier: Hash;
}

export interface SubsquidTokenData {
    id: string;
    tokenType: number;
    tokenAddress: Address;
    tokenSubID: string;
}

export interface SubsquidUnshieldData {
    id: string;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: Hash;
    to: Address;
    token: SubsquidTokenData;
    amount: string;
    fee: string;
    eventLogIndex: string;
}

export interface SubsquidCiphertextData {
    id: string;
    iv: Hash;
    tag: Hash;
    data: Hash[];
}

export interface SubsquidLegacyCommitmentCiphertextData {
    id: string;
    ephemeralKeys: Hash[];
    legacyMemo: string; // Aliased field
    legacyCiphertextData: SubsquidCiphertextData; // Aliased field
}

export interface SubsquidCommitmentCiphertextData {
    id: string;
    blindedSenderViewingKey: Hash;
    blindedReceiverViewingKey: Hash;
    annotationData: string;
    transactMemo: string; // Aliased field
    transactCiphertextData: SubsquidCiphertextData; // Aliased field
}

export interface SubsquidPreimageData {
    id: string;
    npk: Hash;
    value: string;
    token: SubsquidTokenData;
}

// Base interface for all commitment types
export interface BaseSubsquidCommitmentData {
    id: string;
    blockNumber: string;
    blockTimestamp: string;
    transactionHash: Hash;
    treeNumber: number;
    batchStartTreePosition: number;
    treePosition: number;
    commitmentType: string; // Enum value as string
    hash: string; // BigInt as string
    __typename: string; // Discriminator field for polymorphic results
}

// LegacyGeneratedCommitment type
export interface SubsquidLegacyGeneratedCommitmentData extends BaseSubsquidCommitmentData {
    __typename: 'LegacyGeneratedCommitment';
    preimage: SubsquidPreimageData;
    encryptedRandom: Hash[];
}

// LegacyEncryptedCommitment type
export interface SubsquidLegacyEncryptedCommitmentData extends BaseSubsquidCommitmentData {
    __typename: 'LegacyEncryptedCommitment';
    legacyCiphertext: SubsquidLegacyCommitmentCiphertextData; // Aliased field
}

// ShieldCommitment type
export interface SubsquidShieldCommitmentData extends BaseSubsquidCommitmentData {
    __typename: 'ShieldCommitment';
    preimage: SubsquidPreimageData;
    encryptedBundle: Hash[];
    shieldKey: Hash;
    fee: string | null; // Can be null
}

// TransactCommitment type
export interface SubsquidTransactCommitmentData extends BaseSubsquidCommitmentData {
    __typename: 'TransactCommitment';
    transactCiphertext: SubsquidCommitmentCiphertextData; // Aliased field
}

// Union type for all commitment node types
export type SubsquidCommitmentNode = 
    | SubsquidLegacyGeneratedCommitmentData
    | SubsquidLegacyEncryptedCommitmentData
    | SubsquidShieldCommitmentData
    | SubsquidTransactCommitmentData;

// Transaction data for TXID correlation
export interface SubsquidTransactionData {
    id: string; // This is the Railgun TXID
    blockNumber: string;
    transactionHash: Hash;
}

// Adapted transaction type for internal mapping
export interface AdaptedSubsquidTransaction {
    id: string; // Railgun TXID
    blockNumber: bigint;
    transactionHash: Hash;
}

/**
 * Adapts Subsquid nullifier data to the standard DataEntry format
 */
export function adaptSubsquidNullifier(
    sqNullifierData: SubsquidNullifierData,
    railgunTxid?: string
): DataEntry | null {
    try {
        const blockNumber = BigInt(sqNullifierData.blockNumber);
        const blockTimestamp = parseInt(sqNullifierData.blockTimestamp, 10);
        const transactionHash = sqNullifierData.transactionHash;
        const nullifierHex = sqNullifierData.nullifier;
        const treeNumber = sqNullifierData.treeNumber;

        if (!nullifierHex || !nullifierHex.startsWith('0x') || nullifierHex.length !== 66) {
            console.warn(`Subsquid Adapter: Invalid nullifier hex format: ${nullifierHex} in ID: ${sqNullifierData.id}`);
            return null;
        }
        if (isNaN(blockTimestamp)) {
            console.warn(`Subsquid Adapter: Invalid block timestamp: ${sqNullifierData.blockTimestamp} in ID: ${sqNullifierData.id}`);
            return null;
        }

        const logIndex = -1; // Subsquid doesn't provide log index for nullifiers

        return {
            type: RailgunEventType.Nullifiers,
            source: 'subsquid',
            blockNumber: blockNumber,
            transactionHash: transactionHash,
            logIndex: logIndex,
            blockTimestamp: blockTimestamp,
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

/**
 * Adapts Subsquid unshield data to the standard DataEntry format
 */
export function adaptSubsquidUnshield(
    sqUnshieldData: SubsquidUnshieldData,
    railgunTxid?: string
): DataEntry | null {
    try {
        const blockNumber = BigInt(sqUnshieldData.blockNumber);
        const blockTimestamp = parseInt(sqUnshieldData.blockTimestamp, 10);
        const transactionHash = sqUnshieldData.transactionHash;
        const to = sqUnshieldData.to;
        const tokenAddress = sqUnshieldData.token.tokenAddress;
        const tokenType = sqUnshieldData.token.tokenType;
        const tokenSubID = BigInt(sqUnshieldData.token.tokenSubID);
        const amount = BigInt(sqUnshieldData.amount);
        const fee = BigInt(sqUnshieldData.fee);
        const logIndex = parseInt(sqUnshieldData.eventLogIndex, 10);

        if (isNaN(blockTimestamp)) {
            console.warn(`Subsquid Adapter: Invalid block timestamp: ${sqUnshieldData.blockTimestamp} in ID: ${sqUnshieldData.id}`);
            return null;
        }

        if (isNaN(logIndex)) {
            console.warn(`Subsquid Adapter: Invalid event log index: ${sqUnshieldData.eventLogIndex} in ID: ${sqUnshieldData.id}`);
            // We'll use -1 as a fallback if the log index is invalid
        }

        return {
            type: RailgunEventType.Unshield,
            source: 'subsquid',
            blockNumber: blockNumber,
            transactionHash: transactionHash,
            logIndex: isNaN(logIndex) ? -1 : logIndex,
            blockTimestamp: blockTimestamp,
            railgunTxid: railgunTxid,
            payload: {
                to: to,
                tokenAddress: tokenAddress,
                tokenType: tokenType,
                tokenSubID: tokenSubID,
                amount: amount,
                fee: fee,
            },
        };
    } catch (error) {
        console.error(`Subsquid Adapter: Error adapting unshield id ${sqUnshieldData?.id}:`, error);
        return null;
    }
}

/**
 * Adapts Subsquid commitment data to the standard DataEntry format
 * Handles different commitment types based on the __typename property
 */
export function adaptSubsquidCommitment(
    sqCommitmentData: SubsquidCommitmentNode,
    railgunTxid?: string
): DataEntry | null {
    try {
        // Common data extraction and conversion for all commitment types
        const blockNumber = BigInt(sqCommitmentData.blockNumber);
        const blockTimestamp = parseInt(sqCommitmentData.blockTimestamp, 10);
        const transactionHash = sqCommitmentData.transactionHash;
        const treeNumber = sqCommitmentData.treeNumber;
        const batchStartPosition = sqCommitmentData.batchStartTreePosition;
        const treePosition = sqCommitmentData.treePosition;
        
        // Safely convert hash string to normalized hex format
        let commitmentHash: Hex;
        try {
            // If it's already a hex string (starts with 0x), use it directly
            if (typeof sqCommitmentData.hash === 'string' && sqCommitmentData.hash.startsWith('0x') && sqCommitmentData.hash.length === 66) {
                commitmentHash = sqCommitmentData.hash as Hex;
            } else {
                // Otherwise, convert from BigInt string format
                commitmentHash = `0x${BigInt(sqCommitmentData.hash).toString(16).padStart(64, '0')}` as Hex;
            }
        } catch (error) {
            console.error(`Subsquid Adapter: Failed to parse commitment hash: ${sqCommitmentData.hash}`, error);
            return null;
        }

        // Base DataEntry properties common to all commitment types
        const baseEntry = {
            source: 'subsquid',
            blockNumber,
            transactionHash,
            logIndex: -1, // Commitments don't typically have log index in Subsquid
            blockTimestamp,
            railgunTxid,
        };

        // Handle different commitment types based on __typename
        switch (sqCommitmentData.__typename) {
            case 'LegacyGeneratedCommitment': {
                const commitment = sqCommitmentData as SubsquidLegacyGeneratedCommitmentData;
                
                // Convert token data
                const tokenSubID = BigInt(commitment.preimage.token.tokenSubID);
                const value = BigInt(commitment.preimage.value);
                
                return {
                    ...baseEntry,
                    type: RailgunEventType.GeneratedCommitmentBatch,
                    payload: {
                        treeNumber,
                        startPosition: batchStartPosition,
                        commitments: [{
                            hash: commitmentHash,
                            index: treePosition,
                            preimage: {
                                npk: commitment.preimage.npk,
                                token: {
                                    tokenType: commitment.preimage.token.tokenType,
                                    tokenAddress: commitment.preimage.token.tokenAddress,
                                    tokenSubID: tokenSubID
                                },
                                value: value
                            },
                            encryptedRandom: commitment.encryptedRandom
                        }]
                    }
                };
            }
            
            case 'LegacyEncryptedCommitment': {
                const commitment = sqCommitmentData as SubsquidLegacyEncryptedCommitmentData;
                
                return {
                    ...baseEntry,
                    type: RailgunEventType.CommitmentBatch,
                    payload: {
                        treeNumber,
                        startPosition: batchStartPosition,
                        commitments: [{
                            hash: commitmentHash,
                            index: treePosition,
                            ciphertext: {
                                ephemeralKeys: commitment.legacyCiphertext.ephemeralKeys,
                                memo: commitment.legacyCiphertext.legacyMemo, // Use aliased field
                                data: commitment.legacyCiphertext.legacyCiphertextData.data, // Use aliased field
                                iv: commitment.legacyCiphertext.legacyCiphertextData.iv, // Use aliased field
                                tag: commitment.legacyCiphertext.legacyCiphertextData.tag // Use aliased field
                            }
                        }]
                    }
                };
            }
            
            case 'ShieldCommitment': {
                const commitment = sqCommitmentData as SubsquidShieldCommitmentData;
                
                // Convert token data
                const tokenSubID = BigInt(commitment.preimage.token.tokenSubID);
                const value = BigInt(commitment.preimage.value);
                const fee = commitment.fee ? BigInt(commitment.fee) : 0n;
                
                return {
                    ...baseEntry,
                    type: RailgunEventType.Shield,
                    payload: {
                        treeNumber,
                        startPosition: batchStartPosition,
                        commitments: [{
                            hash: commitmentHash,
                            index: treePosition,
                            preimage: {
                                npk: commitment.preimage.npk,
                                token: {
                                    tokenType: commitment.preimage.token.tokenType,
                                    tokenAddress: commitment.preimage.token.tokenAddress,
                                    tokenSubID: tokenSubID
                                },
                                value: value
                            },
                            encryptedBundle: commitment.encryptedBundle,
                            shieldKey: commitment.shieldKey
                        }],
                        fees: [fee]
                    }
                };
            }
            
            case 'TransactCommitment': {
                const commitment = sqCommitmentData as SubsquidTransactCommitmentData;
                
                return {
                    ...baseEntry,
                    type: RailgunEventType.Transact,
                    payload: {
                        treeNumber,
                        startPosition: batchStartPosition,
                        commitments: [{
                            hash: commitmentHash,
                            index: treePosition,
                            ciphertext: {
                                data: commitment.transactCiphertext.transactCiphertextData.data, // Use aliased field
                                blindedSenderViewingKey: commitment.transactCiphertext.blindedSenderViewingKey,
                                blindedReceiverViewingKey: commitment.transactCiphertext.blindedReceiverViewingKey,
                                annotationData: commitment.transactCiphertext.annotationData,
                                memo: commitment.transactCiphertext.transactMemo // Use aliased field
                            }
                        }]
                    }
                };
            }
            
            default:
                // Safe access to properties on potentially unknown types
                const typeName = sqCommitmentData && '__typename' in sqCommitmentData ? 
                    (sqCommitmentData as any).__typename : 'unknown';
                const id = sqCommitmentData && 'id' in sqCommitmentData ? 
                    (sqCommitmentData as any).id : 'unknown';
                console.warn(`Subsquid Adapter: Unknown commitment type: ${typeName} in ID: ${id}`);
                return null;
        }
    } catch (error) {
        console.error(`Subsquid Adapter: Error adapting commitment id ${sqCommitmentData?.id}:`, error);
        return null;
    }
}

/**
 * Adapts Subsquid transaction data for internal use in correlating railgunTxid
 */
export function adaptSubsquidTransaction(
    sqTransactionData: SubsquidTransactionData
): AdaptedSubsquidTransaction | null {
    try {
        return {
            id: sqTransactionData.id, // This is the railgunTxid
            blockNumber: BigInt(sqTransactionData.blockNumber),
            transactionHash: sqTransactionData.transactionHash
        };
    } catch (error) {
        console.error(`Subsquid Adapter: Error adapting transaction id ${sqTransactionData?.id}:`, error);
        return null;
    }
}