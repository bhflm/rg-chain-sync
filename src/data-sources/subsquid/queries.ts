// this is not ideal and should be replaced in favor of using .query() once we fix https://github.com/railgun-reloaded/subsquid-client/pull/21
export const buildBlockRangeRawGQLQuery = (fromBlock: bigint, toBlock: bigint, batchSize: number): string => {
  const fromBlockStr = fromBlock.toString();
  const toBlockStr = toBlock.toString();
  const limit = batchSize.toString();

  return `
query RailgunEvents {
  # Transactions for TXID correlation
  transactions(
    where: {blockNumber_gte: "${fromBlockStr}", blockNumber_lte: "${toBlockStr}"}
    orderBy: [blockNumber_ASC, transactionHash_ASC]
    limit: ${limit}
  ) {
    id
    blockNumber
    transactionHash
  }

  # Nullifiers
  nullifiers(
    where: {blockNumber_gte: "${fromBlockStr}", blockNumber_lte: "${toBlockStr}"}
    orderBy: [blockNumber_ASC, transactionHash_ASC]
    limit: ${limit}
  ) {
    id
    blockNumber
    blockTimestamp
    transactionHash
    treeNumber
    nullifier
  }

  # Unshields
  unshields(
    where: {blockNumber_gte: "${fromBlockStr}", blockNumber_lte: "${toBlockStr}"}
    orderBy: [blockNumber_ASC, transactionHash_ASC, eventLogIndex_ASC]
    limit: ${limit}
  ) {
    id
    blockNumber
    blockTimestamp
    transactionHash
    to
    token {
      id
      tokenType
      tokenAddress
      tokenSubID
    }
    amount
    fee
    eventLogIndex
  }

  # All commitment types
  commitments(
    where: {blockNumber_gte: "${fromBlockStr}", blockNumber_lte: "${toBlockStr}"}
    orderBy: [blockNumber_ASC, transactionHash_ASC, treePosition_ASC]
    limit: ${limit}
  ) {
    id
    blockNumber
    blockTimestamp
    transactionHash
    treeNumber
    batchStartTreePosition
    treePosition
    commitmentType
    hash
    __typename

    # Fields for different commitment types
    ... on LegacyGeneratedCommitment {
      preimage {
        id
        npk
        value
        token {
          id
          tokenType
          tokenAddress
          tokenSubID
        }
      }
      encryptedRandom
    }

    ... on LegacyEncryptedCommitment {
      legacyCiphertext: ciphertext {
        id
        ephemeralKeys
        legacyMemo: memo
        legacyCiphertextData: ciphertext {
          id
          iv
          tag
          data
        }
      }
    }

    ... on ShieldCommitment {
      preimage {
        id
        npk
        value
        token {
          id
          tokenType
          tokenAddress
          tokenSubID
        }
      }
      encryptedBundle
      shieldKey
      fee
    }

    ... on TransactCommitment {
      transactCiphertext: ciphertext {
        id
        blindedSenderViewingKey
        blindedReceiverViewingKey
        annotationData
        transactMemo: memo
        transactCiphertextData: ciphertext {
          id
          iv
          tag
          data
        }
      }
    }
  }
}
`;
};
