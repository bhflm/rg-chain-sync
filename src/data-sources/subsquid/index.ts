import { SubsquidClient } from "@railgun-reloaded/subsquid-client";
import { DataSource } from "../../types/datasource";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
import { buildBlockRangeRawGQLQuery } from "./queries";
import { mapEventToDataEntries, sortDataEntries } from "./mapper";

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

    let currentHeight = height;
    let currentBatchEntries: DataEntry[] = [];
    let bufferIndex = 0;

    // Create an async iterator to return DataEntry objects
    const iterableIterator: AsyncIterableIterator<DataEntry> = {
      async next(): Promise<IteratorResult<DataEntry>> {
        console.log('NEXT');
        while (true) {
          console.log('Iterable true', currentHeight);
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
            const adaptedEvents = mapEventToDataEntries(result, self.eventTypes);
            
            // Sort the events
            currentBatchEntries = sortDataEntries(adaptedEvents);
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