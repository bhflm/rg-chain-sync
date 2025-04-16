import { SubsquidClient } from "@railgun-reloaded/subsquid-client";
import { DataSource } from "../../types/datasource";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
import { adaptSubsquidNullifier, SubsquidNullifierData } from "../../adapters/subsquid-events";
import { buildEventQueries, hasQueries } from './utils'


interface SquidStatusResponse {
  squidStatus?: {
      height?: number | string;
  }
}
export class SubsquidSource implements DataSource {
  private subsquidClient: SubsquidClient;
  private network: string;
  private batchSize: number = 100;

  head: bigint = 0n;
  syncing: boolean = true;

  constructor(options: { network: string; batchSize?: number }) {
    this.network = options.network;
    this.batchSize = options.batchSize ?? this.batchSize;
    this.subsquidClient = new SubsquidClient({ network: this.network });
    this.updateHead().catch(err => {
        console.error("SubsquidSource: Initial head update failed:", err);
        this.syncing = false;
    });
  }

  private async updateHead(): Promise<void> {
      try {
          const result = await this.subsquidClient.request({
              query: `query SquidStatus { squidStatus { height } }` // TODO: Check for exposed query on this -this was faster heh-
          }) as SquidStatusResponse;

          const headStrOrNum = result?.squidStatus?.height; // yuck
          if (headStrOrNum !== undefined && headStrOrNum !== null) {
              const newHead = BigInt(headStrOrNum); // now I recall all my ghosts from thailand when we did mention bigInts for subsquid too much
              if (newHead > this.head) {
                this.head = newHead;
                console.log(`SubsquidSource head updated to: ${this.head}`);
              }
              this.syncing = true;
          } else {
              console.warn("SubsquidSource: Invalid height from squidStatus. Head not updated.");
              this.syncing = false;
          }
      } catch (error) {
          console.error("SubsquidSource: Failed to query squidStatus:", error);
          this.syncing = false;
      }
  }

  async read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>> {
    const self = this;
    await self.updateHead();

    let currentOffset = 0;
    let currentBatchEntries: DataEntry[] = [];
    let bufferIndex = 0;
    let done = false;
    let lastProcessedBlock = height - 1n;

    if (!hasQueries(eventTypes)) {
      console.warn("SubsquidSource: No relevant event types requested for read().");
      return Promise.resolve({
      async next() { return { done: true, value: undefined }; },
      [Symbol.asyncIterator]() { return this; }
      });
    }


    const capturedEventTypes = eventTypes;
    //////////

  const iterableIterator: AsyncIterableIterator<DataEntry> = {
    async next(): Promise<IteratorResult<DataEntry>> {
      while (true) {
        if (bufferIndex < currentBatchEntries.length) {
          const entry = currentBatchEntries[bufferIndex++];
          lastProcessedBlock = entry.blockNumber;
          return { done: false, value: entry };
        }

        if (done) {
          console.log(`SubsquidSource: Iteration complete for height >= ${height}.`);
          return { done: true, value: undefined };
        }

        console.log(`SubsquidSource: Fetching batch. Offset: ${currentOffset}, Height >= ${height}`);
        try {
          currentBatchEntries = [];
          bufferIndex = 0;

          const queries = buildEventQueries(capturedEventTypes!, {
            height: Number(height),
            batchSize: self.batchSize,
            offset: 0
          })

          console.log('QUERIES: ', queries);

          const result = await self.subsquidClient.query(queries);

          console.log('RESULT: ', result);

          // Extract nullifiers from result, handling potential undefined fields
          const fetchedNullifiers = ((result as any).nullifiers || []) as SubsquidNullifierData[]; // Use local type for safety
          // const fetchedCommitments = (result.commitments || []) as SubsquidCommitmentData[]; // example

          const itemsInThisFetch = fetchedNullifiers.length; // + fetchedCommitments.length // Adjust if querying multiple
          let anyDataFetched = itemsInThisFetch > 0;

          if (!anyDataFetched) {
              console.log(`SubsquidSource: No more data found at offset ${currentOffset} for height >= ${height}.`);
              done = true;
              continue; // Go back to top of loop (will terminate)
          }

          // Adapt Nullifiers
          for (const sqNullifier of fetchedNullifiers) {
              const adapted = adaptSubsquidNullifier(sqNullifier); // Pass the object typed as SubsquidNullifierData
              if (adapted) {
                  currentBatchEntries.push(adapted);
              }
          }

          // Sort (less critical if only one type fetched, but good practice)
          currentBatchEntries.sort((a, b) => {
              if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
              // Use logIndex placeholder or TX hash for secondary sort
              if (a.logIndex !== -1 && b.logIndex !== -1) return a.logIndex - b.logIndex;
              return a.transactionHash < b.transactionHash ? -1 : 1;
          });

          // --- Update Pagination State ---
          // CRITICAL: Offset should likely be based on the primary entity being iterated
          // If mixing types, a cursor-based approach (`first`/`after`) is generally better.
          // Sticking with offset based on nullifiers for this simplified example:
          currentOffset += fetchedNullifiers.length;

          // Check if the primary entity returned less than the limit
          if (fetchedNullifiers.length < self.batchSize) {
              console.log(`SubsquidSource: Fetched less than batch size (${fetchedNullifiers.length}/${self.batchSize}), likely reached end.`);
              done = true;
          }

        } catch (error) {
          console.error(`SubsquidSource: Error querying offset ${currentOffset}, height >= ${height}:`, error);
          done = true;
          // Handle error appropriately - maybe return the error?
          return { done: true, value: undefined }; // Terminate iteration on error
        }
      }
    },

    [Symbol.asyncIterator](): AsyncIterableIterator<DataEntry> {
        return this;
      }
    };

    return Promise.resolve(iterableIterator);
    } 

    destroy(error?: Error): void {
      console.log("SubsquidSource: Destroy called.", error ? `Error: ${error.message}` : '');
      this.syncing = false;
    }
}