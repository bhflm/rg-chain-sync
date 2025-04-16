import { DataSource } from "../types/datasource";
import { DataEntry, RailgunEventType } from "../types/data-entry";

type BufferEntry = {
  entry: DataEntry;
  sourceIndex: number;
  iterator: AsyncIterableIterator<DataEntry>;
};


export class AggregatedSource implements DataSource {
  // Sources should be provided in priority order (e.g., [Subsquid, RPC, Snapshot])
  // Higher priority sources come earlier in the array.
  constructor(private sources: DataSource[]) {
      if (!sources || sources.length === 0) {
          console.warn("AggregatedSource initialized with no sources.");
      }
  }

  /**
   * The highest block number known across all underlying sources.
   */
  get head(): bigint {
      if (this.sources.length === 0) return 0n;
      // Calculate the maximum head from all sources
      // Use reduce to handle potential empty array safely, though constructor warns
      return this.sources.reduce((maxHead, source) =>
          source.head > maxHead ? source.head : maxHead
      , 0n); // Start with 0n
  }

  /**
   * True if any underlying source is still syncing.
   */
  get syncing(): boolean {
       if (this.sources.length === 0) return false;
      return this.sources.some(source => source.syncing);
  }

   /**
     * Reads data by merging underlying sources chronologically.
     * @param height The block number to start reading from.
     * @param eventTypes Optional filter for specific event types (passed to underlying sources).
   *
   * Ok some notes on why is AsyncIterableIterator rather than the other:
   * It just did not work with AsyncIterator, perhaps need to revisit, but did some findings and 
   * from source asyncIterableIterator implements both AsyncIterator<T> and AsyncIterable<T>. 
   * can be used directly in a for await...of loop, and also can call .next() if needed 
   * i just find not calling .next() better???? no se
   * https://developer.mozilla.org/en-US/search?q=AsyncIterableIterator
   *   
   
   */
   async read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>> {
    const numSources = this.sources.length;

    if (numSources === 0) {
        // return an empty iterator immediately if no sources
        return Promise.resolve({
            async next() { return { done: true, value: undefined }; },
            [Symbol.asyncIterator]() { return this; }
        });
    }

    // --- Iterator State ---
    let iterators: (AsyncIterableIterator<DataEntry> | null)[] = new Array(numSources).fill(null); // lots of typing complains typescript is horrible
    
    // Buffer holds the next available entry from each source, plus metadata
    let buffers: (BufferEntry | null)[] = new Array(numSources).fill(null);
    let initializationPromises: Promise<void>[] = [];
    // Keep track of yielded IDs to prevent duplicates ({txHash}-{logIndex})
    const yieldedIds = new Set<string>();

    // start both iterators
    for (let i = 0; i < numSources; i++) {
        const source = this.sources[i];
        initializationPromises.push(
          (async () => {
            try {
                console.log(`AggregatedSource: Initializing iterator for source ${i}...`);
                // THIS DOES NOT WORK BECAUSE TYPESCRIPT HATES PEOPLE BEING HAPPY AND LIVING A NORMAL LIFE
                // const iterator: AsyncIterableIterator<DataEntry> = await source.read(height, eventTypes);
                // tldr; 
                // but both sources return the same iterator
                // and for some reason typescript inference is crying like a b that both iterators are 
                // not the same ?? like dude it has the same implementation
                const iterator: AsyncIterableIterator<DataEntry> = {
                    ...(await source.read(height, eventTypes)),
                    [Symbol.asyncIterator]() {
                        return this;
                    }
                };
                // END OF HACK


                iterators[i] = iterator;
                const result = await iterator.next();
                 if (!result.done && result.value) {
                     console.log(`AggregatedSource: Initial buffer for source ${i} - Block ${result.value.blockNumber}`);
                     // stores the AsyncIterableIterator
                    buffers[i] = { entry: result.value, sourceIndex: i, iterator };
                } else {
                     console.log(`AggregatedSource: Source ${i} initially exhausted or empty.`);
                    iterators[i] = null; // Mark iterator slot as null if exhausted
                    buffers[i] = null;  // Clear buffer slot too
                }
            } catch (err) {
                console.error(`AggregatedSource: Error initializing source ${i}:`, err);
                iterators[i] = null; // Mark as exhausted on error
                buffers[i] = null;
            }
        })()
    );
    }

    await Promise.all(initializationPromises);
    console.log("AggregatedSource: All source iterators initialized.");

    //***
    // This is what it looks like the state of the read() up to here, we just have populated buffers
    // [
    //   { entry: <Subsquid Item @ Block 100>, sourceIndex: 0, iterator: subsquidSource }, // Slot 0 (Subsquid)
    //   { entry: <RPC Item @ Block 101>,      sourceIndex: 1, iterator: rpcSource },      // Slot 1 (RPC)
    // ]
    //  */

    // implement the merge iterator for all sources
    const mergingIterator: AsyncIterableIterator<DataEntry> = {
        async next(): Promise<IteratorResult<DataEntry>> {
            while (true) { 
                let bestEntry: BufferEntry | null = null;

                // ok, Q: what happens if we have the same entry from data (ie: same data on rpc and subsquid?)??? 
                // We need to define a "best entry"
                // 
                // best entry accounts for, in order of priority: lowest blocknumber first, then lowest logIndex (I really dont know), and later order of source priority
                for (let i = 0; i < numSources; i++) {
                    const currentBuffer = buffers[i];
                    if (!currentBuffer) continue;

                    if (!bestEntry) {
                        bestEntry = currentBuffer; // first available entry becomes the current best, ie: [subsquid, rpc] when you initialize the array, subsquid is the best entry
                    } else {
                        // compare block numbers
                        if (currentBuffer.entry.blockNumber < bestEntry.entry.blockNumber) {
                            bestEntry = currentBuffer;
                        } else if (currentBuffer.entry.blockNumber === bestEntry.entry.blockNumber) {
                            // Tie-break by log index (lower index first)
                            // Handle placeholder -1 carefully
                            const logIndexA = bestEntry.entry.logIndex;
                            const logIndexB = currentBuffer.entry.logIndex;

                            if (logIndexB !== -1 && (logIndexA === -1 || logIndexB < logIndexA)) {
                                bestEntry = currentBuffer;
                            } else if (logIndexA === -1 && logIndexB === -1) {
                                 // If both lack log index, compare by source priority (lower index = higher priority)
                                 // This also handles the case where log indices are identical
                                 if (currentBuffer.sourceIndex < bestEntry.sourceIndex) {
                                      bestEntry = currentBuffer;
                                 }
                                 // If source priority is also the same (shouldn't happen with distinct source indices), keep existing bestEntry
                            }
                            // If logIndexA is valid and <= logIndexB, keep existing bestEntry
                        }
                        // If current entry blockNumber > best entry blockNumber, keep existing bestEntry
                    }
                }

                if (!bestEntry) {
                    console.log("AggregatedSource: All sources appear exhausted.");
                    return { done: true, value: undefined };
                }

                // --- yield the best entry found ---
                const entryToYield = bestEntry.entry;
                const sourceIdx = bestEntry.sourceIndex;
                const iteratorToAdvance = bestEntry.iterator;

                 // Generate unique ID for deduplication
                 // Use -1 logIndex carefully in ID generation if necessary
                 const eventId = `${entryToYield.transactionHash}-${entryToYield.logIndex}`;

                // --- Fetch the next item from the source we are about to yield from ---
                let nextResult: IteratorResult<DataEntry>;
                try {
                     // console.log(`AggregatedSource: Fetching next for source ${sourceIdx}...`); // Verbose log
                    nextResult = await iteratorToAdvance.next();
                    if (!nextResult.done && nextResult.value) {
                        // Update buffer for this source
                        buffers[sourceIdx] = { entry: nextResult.value, sourceIndex: sourceIdx, iterator: iteratorToAdvance };
                    } else {
                         console.log(`AggregatedSource: Source ${sourceIdx} exhausted.`);
                        buffers[sourceIdx] = null; // Mark this source as exhausted
                    }
                } catch (err) {
                    console.error(`AggregatedSource: Error fetching next from source ${sourceIdx}:`, err);
                    buffers[sourceIdx] = null; // Mark as exhausted on error
                }


                // --- Deduplication Check ---
                if (yieldedIds.has(eventId)) {
                     console.log(`AggregatedSource: Duplicate skipped - ${eventId} (Block: ${entryToYield.blockNumber})`);
                    // Already yielded this tx/log index, loop again to find the *next* best entry
                    continue;
                } else {
                     // --- Yield the unique entry ---
                     yieldedIds.add(eventId);
                     // Clean up yieldedIds periodically if memory becomes an issue (e.g., keep only recent blocks)
                     return { done: false, value: entryToYield };
                }
            }
        },

        [Symbol.asyncIterator](): AsyncIterableIterator<DataEntry> {
            return this;
        }
    };

    return Promise.resolve(mergingIterator);
  }


  destroy(error?: Error): void {
    console.log(`AggregatedSource: Destroy called.${error ? ` Error: ${error.message}` : ''}`);
    for (const source of this.sources) {
        try {
            source.destroy(error);
        } catch (err) {
            console.error(`AggregatedSource: Error destroying source:`, err);
        }
    }
    // Clear sources array to prevent further use
    this.sources = [];
  }
}