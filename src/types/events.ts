export enum CommitmentType {
  // V1
  LegacyEncryptedCommitment = 'LegacyEncryptedCommitment',
  LegacyGeneratedCommitment = 'LegacyGeneratedCommitment',
  // V2
  ShieldCommitment = 'ShieldCommitment',
  TransactCommitmentV2 = 'TransactCommitmentV2',
  // V3
  TransactCommitmentV3 = 'TransactCommitmentV3',
}

export type LegacyCommitmentCiphertext = {
  ciphertext: {
    iv: string;
    tag: string;
    data: string[];
  };
  ephemeralKeys: string[];
  memo: string[];
};

export type LegacyEncryptedCommitment = {
  commitmentType: CommitmentType.LegacyEncryptedCommitment;
  hash: string;
  txid: string;
  timestamp?: number;
  blockNumber: number;
  ciphertext: LegacyCommitmentCiphertext;
  utxoTree: number;
  utxoIndex: number;
  railgunTxid?: string;
};

export type LegacyGeneratedCommitment = {
  commitmentType: CommitmentType.LegacyGeneratedCommitment;
  hash: string;
  txid: string;
  timestamp?: number;
  blockNumber: number;
  preImage: string;
  encryptedRandom: [string, string];
  utxoTree: number;
  utxoIndex: number;
};

export type Commitment = LegacyEncryptedCommitment | LegacyGeneratedCommitment;

export type Nullifier = {
  txid: string;
  nullifier: string;
  treeNumber: number;
  blockNumber: number;
};

export type CommitmentEvent = {
  txid: string;
  treeNumber: number;
  startPosition: number;
  commitments: Commitment[];
  blockNumber: number;
};

export type EventsCommitmentListener = (events: CommitmentEvent[]) => Promise<void>;
export type EventsNullifierListener = (nullifiers: Nullifier[]) => Promise<void>;
