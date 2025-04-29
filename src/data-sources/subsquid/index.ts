import { SubsquidClient } from "@railgun-reloaded/subsquid-client";
import { DataSource, DataCompleteness } from "../../types/datasource";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
import { type Hash } from 'viem';
import {
  adaptSubsquidNullifier,
  adaptSubsquidUnshield,
  adaptSubsquidCommitment,
  adaptSubsquidTransaction,
  AdaptedSubsquidTransaction,
} from "../../adapters/subsquid-events";
import { buildBlockRangeRawGQLQuery, hasQueries } from "./utils";

interface SquidStatusResponse {
  squidStatus?: {
    height?: number | string;
  };
}

export class SubsquidSource implements DataSource {
  private subsquidClient: SubsquidClient;
  private network: string;
  private batchSize: number = 100;
  private eventTypes?: RailgunEventType[];

  head: bigint = 0n;
  syncing: boolean = true;

  constructor(options: {
    network: string;
    batchSize?: number;
    eventTypes?: RailgunEventType[];
  }) {
    this.network = options.network;
    this.batchSize = options.batchSize ?? this.batchSize;
    this.eventTypes = options.eventTypes;
    this.subsquidClient = new SubsquidClient({ network: this.network });
    this.updateHead().catch((err) => {
      console.error("SubsquidSource: Initial head update failed:", err);
      this.syncing = false;
    });
  }

  private async updateHead(): Promise<void> {
    try {
      const result = (await this.subsquidClient.request({
        query: `query SquidStatus { squidStatus { height } }`,
      })) as SquidStatusResponse;

      const headStrOrNum = result?.squidStatus?.height;
      if (headStrOrNum !== undefined && headStrOrNum !== null) {
        const newHead = BigInt(headStrOrNum);
        if (newHead > this.head) {
          this.head = newHead;
          console.log(`SubsquidSource head updated to: ${this.head}`);
        }
        this.syncing = true;
      } else {
        console.warn(
          "SubsquidSource: Invalid height from squidStatus. Head not updated.",
        );
        this.syncing = false;
      }
    } catch (error) {
      console.error("SubsquidSource: Failed to query squidStatus:", error);
      this.syncing = false;
    }
  }

  async read(height: bigint): Promise<AsyncIterableIterator<DataEntry>> {
    console.log('READ CALLED');
    const self = this;
    await self.updateHead();
    console.log('HEAD UPDATED');
    // Check if we should process any queries based on eventTypes
    if (this.eventTypes && !hasQueries(this.eventTypes)) {
      console.log("SubsquidSource: No supported event types requested, skipping queries");
      return emptyIterator();
    }

    let currentHeight = height;
    let currentBatchEntries: DataEntry[] = [];
    let bufferIndex = 0;

    // Create an async iterator to return DataEntry objects
    const iterableIterator: AsyncIterableIterator<DataEntry> = {
      async next(): Promise<IteratorResult<DataEntry>> {
        while (true) {
          // If there are items in the current batch, return the next one
          if (bufferIndex < currentBatchEntries.length) {
            const entry = currentBatchEntries[bufferIndex++];
            return { done: false, value: entry };
          }

          // Check if we've gone past the head
          if (currentHeight > self.head) {
            await self.updateHead();
            if (currentHeight > self.head) {
              self.syncing = false;
              return { done: true, value: undefined };
            }
          }

          try {
            // Determine block range for the next batch
            const fromBlock = currentHeight;
            const maxToBlock = fromBlock + BigInt(self.batchSize - 1);
            const toBlock = maxToBlock > self.head ? self.head : maxToBlock;

            // Edge case: if fromBlock > toBlock, we're done
            if (fromBlock > toBlock) {
              return { done: true, value: undefined };
            }

            console.log(`SubsquidSource: Fetching blocks ${fromBlock} to ${toBlock}`);

            // Build a raw GraphQL query for all event types and transactions in one batch
            const rawQuery = buildBlockRangeRawGQLQuery(fromBlock, toBlock, self.batchSize * 2);

            // Execute the raw GraphQL query using the request method
            const result = await self.subsquidClient.request({ query: rawQuery });

            // Process the results into DataEntry objects
            const adaptedEvents: DataEntry[] = [];

            // Extract transactions for railgunTxid correlation
            const transactionsMap = new Map<Hash, AdaptedSubsquidTransaction>();
            const transactions = ((result as any).transactions || []);

            for (const tx of transactions) {
              const adaptedTx = adaptSubsquidTransaction(tx);
              if (adaptedTx) {
                transactionsMap.set(adaptedTx.transactionHash, adaptedTx);
              }
            }

            // Process event data based on requested event types

            // Process nullifiers if requested
            if (!self.eventTypes || self.eventTypes.includes(RailgunEventType.Nullifiers)) {
              const nullifiers = ((result as any).nullifiers || []);
              for (const nullifier of nullifiers) {
                const railgunTx = transactionsMap.get(nullifier.transactionHash);
                const adaptedNullifier = adaptSubsquidNullifier(nullifier, railgunTx?.id);
                if (adaptedNullifier) {
                  adaptedEvents.push(adaptedNullifier);
                }
              }
            }

            // Process unshields if requested
            if (!self.eventTypes || self.eventTypes.includes(RailgunEventType.Unshield)) {
              const unshields = ((result as any).unshields || []);
              for (const unshield of unshields) {
                const railgunTx = transactionsMap.get(unshield.transactionHash);
                const adaptedUnshield = adaptSubsquidUnshield(unshield, railgunTx?.id);
                if (adaptedUnshield) {
                  adaptedEvents.push(adaptedUnshield);
                }
              }
            }

            // Process commitments if any commitment-related event types are requested
            const commitmentEventTypes = [
              RailgunEventType.Shield,
              RailgunEventType.Transact,
              RailgunEventType.CommitmentBatch,
              RailgunEventType.GeneratedCommitmentBatch
            ];

            if (!self.eventTypes ||
                self.eventTypes.some(type => commitmentEventTypes.includes(type))) {
              const commitments = ((result as any).commitments || []);
              for (const commitment of commitments) {
                // Filter by commitment type if specific event types are requested
                if (self.eventTypes) {
                  // Skip if this commitment type doesn't match any requested event type
                  const commitmentType = commitment.__typename;
                  const eventType = commitmentTypeToEventType(commitmentType);
                  if (eventType && !self.eventTypes.includes(eventType)) {
                    continue;
                  }
                }

                const railgunTx = transactionsMap.get(commitment.transactionHash);
                const adaptedCommitment = adaptSubsquidCommitment(commitment, railgunTx?.id);
                if (adaptedCommitment) {
                  adaptedEvents.push(adaptedCommitment);
                }
              }
            }

            // Sort the events by blockNumber and logIndex
            adaptedEvents.sort((a, b) => {
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

            // Update state for next iteration
            currentBatchEntries = adaptedEvents;
            bufferIndex = 0;

            // If no data was found, move to the next block range
            if (currentBatchEntries.length === 0) {
              currentHeight = toBlock + 1n;
              continue;
            }

            // Advance to the next block range for future iterations
            currentHeight = toBlock + 1n;

          } catch (error) {
            console.error(`SubsquidSource: Error fetching data for height ${currentHeight}:`, error);
            // Continue to the next block range on error
            currentHeight = currentHeight + BigInt(self.batchSize);
            continue;
          }
        }
      },

      [Symbol.asyncIterator](): AsyncIterableIterator<DataEntry> {
        return this;
      },
    };

    return Promise.resolve(iterableIterator);
  }

  destroy(error?: Error): void {
    console.log(
      "SubsquidSource: Destroy called.",
      error ? `Error: ${error.message}` : "",
    );
    this.syncing = false;
  }
}

// Helper to create an empty iterator
function emptyIterator(): AsyncIterableIterator<DataEntry> {
  return {
    async next(): Promise<IteratorResult<DataEntry>> {
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator](): AsyncIterableIterator<DataEntry> {
      return this;
    },
  };
}

// Helper to convert commitment type to event type
function commitmentTypeToEventType(commitmentType: string): RailgunEventType | null {
  switch (commitmentType) {
    case 'LegacyGeneratedCommitment':
      return RailgunEventType.GeneratedCommitmentBatch;
    case 'LegacyEncryptedCommitment':
      return RailgunEventType.CommitmentBatch;
    case 'ShieldCommitment':
      return RailgunEventType.Shield;
    case 'TransactCommitment':
      return RailgunEventType.Transact;
    default:
      return null;
  }
}
