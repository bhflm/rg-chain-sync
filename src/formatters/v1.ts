import { Log } from 'viem';
import { ByteUtils, ByteLength } from '../utils/bytes';
import {
  CommitmentEvent,
  CommitmentType,
  LegacyEncryptedCommitment,
  LegacyGeneratedCommitment,
  Nullifier
} from '../types/events';

function formatLegacyCommitmentCiphertext(commitment: any) {
  const { ephemeralKeys, memo } = commitment;
  const ciphertext = commitment.ciphertext.map(
    (el: bigint) => ByteUtils.nToHex(el, ByteLength.UINT_256),
  );
  const ivTag = ciphertext[0];

  return {
    ciphertext: {
      iv: ivTag.substring(0, 32),
      tag: ivTag.substring(32),
      data: ciphertext.slice(1),
    },
    ephemeralKeys: ephemeralKeys.map(
      (key: bigint) => ByteUtils.nToHex(key, ByteLength.UINT_256),
    ),
    memo: (memo ?? []).map(
      (el: bigint) => ByteUtils.nToHex(el, ByteLength.UINT_256),
    ),
  };
}

export function formatLegacyCommitmentBatchCommitments(
  transactionHash: string,
  hash: bigint[],
  commitments: any[],
  blockNumber: number,
  utxoTree: number,
  utxoStartingIndex: number,
): LegacyEncryptedCommitment[] {
  return commitments.map((commitment, index) => {
    return {
      commitmentType: CommitmentType.LegacyEncryptedCommitment,
      hash: ByteUtils.nToHex(hash[index], ByteLength.UINT_256),
      txid: transactionHash,
      timestamp: undefined,
      blockNumber,
      ciphertext: formatLegacyCommitmentCiphertext(commitment),
      utxoTree,
      utxoIndex: utxoStartingIndex + index,
      // @ts-ignore
      railgunTxid: undefined,
    };
  });
}

export function formatLegacyCommitmentBatchEvent(
  args: any,
  transactionHash: string,
  blockNumber: number,
): CommitmentEvent {
  const { treeNumber, startPosition, hash, ciphertext } = args;
  if (treeNumber == null || startPosition == null || hash == null || ciphertext == null) {
    throw new Error('Invalid CommitmentBatchEventArgs');
  }

  const utxoTree = Number(treeNumber);
  const utxoStartingIndex = Number(startPosition);

  const formattedCommitments: LegacyEncryptedCommitment[] = formatLegacyCommitmentBatchCommitments(
    transactionHash,
    hash,
    ciphertext,
    blockNumber,
    utxoTree,
    utxoStartingIndex,
  );

  return {
    txid: ByteUtils.formatToByteLength(transactionHash, ByteLength.UINT_256),
    treeNumber: utxoTree,
    startPosition: utxoStartingIndex,
    commitments: formattedCommitments,
    blockNumber,
  };
}

// Helper function for formatting generated commitment batch
export function formatLegacyGeneratedCommitmentBatchCommitments(
  transactionHash: string,
  preImages: any[],
  encryptedRandoms: [bigint, bigint][],
  blockNumber: number,
  utxoTree: number,
  utxoStartingIndex: number,
): LegacyGeneratedCommitment[] {
  const randomFormatted: [string, string][] = encryptedRandoms.map((encryptedRandom) => [
    ByteUtils.nToHex(encryptedRandom[0], ByteLength.UINT_256),
    ByteUtils.nToHex(encryptedRandom[1], ByteLength.UINT_128),
  ]);

  return preImages.map((commitmentPreImage, index) => {
    const npk = ByteUtils.formatToByteLength(commitmentPreImage.npk.toString(), ByteLength.UINT_256);
    // Simplified for this example
    const preImage = npk;
    const noteHash = BigInt(npk);

    return {
      commitmentType: CommitmentType.LegacyGeneratedCommitment,
      hash: ByteUtils.nToHex(noteHash, ByteLength.UINT_256),
      txid: transactionHash,
      timestamp: undefined,
      blockNumber,
      preImage,
      encryptedRandom: randomFormatted[index],
      utxoTree,
      utxoIndex: utxoStartingIndex + index,
    };
  });
}

export function formatLegacyGeneratedCommitmentBatchEvent(
  args: any,
  transactionHash: string,
  blockNumber: number,
): CommitmentEvent {
  const { treeNumber, startPosition, commitments, encryptedRandom } = args;
  if (
    treeNumber == null ||
    startPosition == null ||
    commitments == null ||
    encryptedRandom == null
  ) {
    throw new Error('Invalid GeneratedCommitmentBatchEventArgs');
  }

  const utxoTree = Number(treeNumber);
  const utxoStartingIndex = Number(startPosition);

  const formattedCommitments: LegacyGeneratedCommitment[] =
    formatLegacyGeneratedCommitmentBatchCommitments(
      transactionHash,
      commitments,
      encryptedRandom,
      blockNumber,
      utxoTree,
      utxoStartingIndex,
    );

  return {
    txid: ByteUtils.formatToByteLength(transactionHash, ByteLength.UINT_256),
    treeNumber: utxoTree,
    startPosition: utxoStartingIndex,
    commitments: formattedCommitments,
    blockNumber,
  };
}

export function formatLegacyNullifierEvents(
  args: any,
  transactionHash: string,
  blockNumber: number,
): Nullifier[] {
  const nullifiers: Nullifier[] = [];

  for (const nullifier of args.nullifier) {
    nullifiers.push({
      txid: ByteUtils.formatToByteLength(transactionHash, ByteLength.UINT_256),
      nullifier: ByteUtils.nToHex(nullifier, ByteLength.UINT_256),
      treeNumber: Number(args.treeNumber),
      blockNumber,
    });
  }

  return nullifiers;
}