import { type Log, type Abi, parseEventLogs } from "viem";
import {
  RailgunScanner,
  type EventType,
  type ScannerVersion,
} from "../../services/scanner";
import { DataSource } from "../../types/datasource";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
import {
  adaptParsedCommitmentBatch,
  adaptParsedNullifiers,
  adaptParsedUnshield,
  adaptParsedShield,
  adaptParsedGeneratedCommitmentBatch,
  adaptParsedTransact,
  adaptParsedNullified,
} from "../../adapters/rpc-events";

// not so sure about this but idk
function mapScannerEventToRailgunEvent(
  scannerEvent: EventType,
  version: ScannerVersion,
): RailgunEventType | null {
  switch (scannerEvent) {
    case "CommitmentBatch":
      return RailgunEventType.CommitmentBatch;
    case "GeneratedCommitmentBatch":
      return RailgunEventType.GeneratedCommitmentBatch;
    case "Nullifiers":
      return RailgunEventType.Nullifiers;
    case "Nullified": // Map Nullified to the same event type as Nullifiers
      return RailgunEventType.Nullifiers;
    case "Shield":
      return RailgunEventType.Shield;
    case "Unshield":
      return RailgunEventType.Unshield;
    case "Transact":
      return RailgunEventType.Transact;
    // Add V1 specifics like V1_EVENTS.NULLIFIERS -> RailgunEventType.V1_Nullifiers if names differ
    default:
      console.warn(
        `Unsupported scanner event type for RpcSource mapping: ${scannerEvent} (version: ${version})`,
      );
      return null;
  }
}

export class RpcSource implements DataSource {
  private scanner: RailgunScanner;
  private currentAbi: Abi;
  private version: ScannerVersion;
  private batchSize: number;
  private blockTimeCache: Map<bigint, number> = new Map();

  head: bigint = 0n;
  syncing: boolean = true;

  constructor(
    scannerConfig: ConstructorParameters<typeof RailgunScanner>[0], // Pass scanner config directly
  ) {
    this.scanner = new RailgunScanner(scannerConfig);
    // @ts-ignore // TODO: Implement this as a public getter
    this.currentAbi = this.scanner.currentAbi!;
    // @ts-ignore // TODO: Implement this as a public getter
    this.version = this.scanner.version;
    // @ts-ignore // TODO: Implement this as a public getter
    this.batchSize = scannerConfig.batchSize ?? this.scanner.batchSize;
    this.updateHead();
  }

  private async updateHead() {
    try {
      const head = await this.scanner.getLatestBlockNumber();
      this.head = head;
      console.log(`RpcSource head updated to: ${this.head}`);
    } catch (error) {
      console.error("RpcSource: Failed to update head:", error);
      // TODO: Decide how to handle errors - retry? set syncing to false?
      this.syncing = false; // Stop syncing on error
    }
  }

  private async getBlockTimestamp(blockNumber: bigint): Promise<number> {
    if (this.blockTimeCache.has(blockNumber)) {
      return this.blockTimeCache.get(blockNumber)!;
    }
    try {
      // @ts-ignore // TODO: Implement this as a public getter
      const block = await this.scanner.client.getBlock({ blockNumber });
      const timestamp = Number(block.timestamp);
      this.blockTimeCache.set(blockNumber, timestamp);

      // keep the size of the cache considerably low
      if (this.blockTimeCache.size > this.batchSize * 2) {
        const oldestKey = this.blockTimeCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.blockTimeCache.delete(oldestKey);
        }
      }
      return timestamp;
    } catch (err) {
      console.error(
        `RpcSource: Failed to get timestamp for block ${blockNumber}:`,
        err,
      );
      // Return 0 or throw, depending on desired handling. Returning 0 might mess up ordering.
      return 0; // Or throw error
    }
  }

  async read(
    height: bigint,
    eventTypes?: RailgunEventType[],
  ): Promise<AsyncIterableIterator<DataEntry>> {
    const self = this;
    await this.updateHead();

    let currentHeight = height;
    let currentBatchEntries: DataEntry[] = [];
    let bufferIndex = 0;

    const iterableIterator = {
      async next(): Promise<IteratorResult<DataEntry>> {
        // loop indefinitely until we return a value or signal completion
        while (true) {
          // 1. Yield from buffer if available
          if (bufferIndex < currentBatchEntries.length) {
            // We have buffered data, return the next item
            return { done: false, value: currentBatchEntries[bufferIndex++] };
          }

          // 2. Buffer is empty. Check if we need to fetch a new batch.
          // Stop if we've scanned past the current known head.
          if (currentHeight > self.head) {
            //  live syncing scenarios might need to update this head somewhere here ??
            await self.updateHead();
            if (currentHeight > self.head) {
              // past the head, we are truly done
              console.log(
                `RpcSource: Reached head ${self.head}, stopping iterator.`,
              );
              // wait for new blocks, logic goes here.
              // For now, signal completion.
              self.syncing = false; // Mark as not actively syncing new blocks currently
              return { done: true, value: undefined };
            }
            // If head advanced, loop continues to fetch the new range
          }

          // 3. Determine the block range for the next batch fetch
          const fromBlock = currentHeight;
          // Ensure toBlock doesn't exceed the current head
          const toBlock =
            fromBlock + BigInt(self.batchSize - 1) > self.head
              ? self.head
              : fromBlock + BigInt(self.batchSize - 1);

          // Sanity check: If fromBlock somehow exceeds toBlock (e.g., head didn't advance much)
          if (fromBlock > toBlock) {
            console.log(
              `RpcSource: fromBlock (${fromBlock}) > toBlock (${toBlock}), likely caught up to head. Waiting or stopping.`,
            );
            // Implement waiting logic or stop if not live syncing
            await new Promise((resolve) => setTimeout(resolve, 5000)); // wait just in case
            continue;
          }

          console.log(
            `RpcSource: Fetching new batch: blocks ${fromBlock} to ${toBlock}`,
          );

          // 4. Fetch and Process the Batch
          try {
            currentBatchEntries = []; // Reset buffer for this new batch
            bufferIndex = 0; // Reset buffer index

            // Fetch all raw logs for the contract in this range
            // @ts-ignore - @@TODO: rework and make this public function too
            const rawLogs: Log[] = await self.scanner.client.getLogs({
              address: self.scanner.getContractAddress(), // Use the getter
              fromBlock,
              toBlock,
            });

            if (rawLogs.length > 0) {
              // Parse all logs using the ABI for the scanner's version
              const parsedLogs = parseEventLogs({
                abi: self.currentAbi,
                logs: rawLogs,
                strict: false, // Be lenient: allows ABI to have more events than logs found
              });

              // fetch timestamps for all unique blocks in this batch
              const blockNumbersInBatch = [
                ...new Set(
                  parsedLogs
                    .map((log) => log.blockNumber)
                    .filter((bn) => bn !== null),
                ),
              ] as bigint[];
              const timestampPromises = blockNumbersInBatch.map((bn) =>
                self.getBlockTimestamp(bn),
              );
              await Promise.all(timestampPromises); // Pre-fetch/cache timestamps concurrently

              // Adapt each parsed log into our standard DataEntry format
              for (const parsedLog of parsedLogs) {
                // just check we're not doing silly things just IN CASE
                if (
                  parsedLog.blockNumber === null ||
                  parsedLog.logIndex === null ||
                  parsedLog.transactionHash === null
                ) {
                  console.warn(
                    "RpcSource: Encountered log with null block/tx/log index, skipping:",
                    parsedLog,
                  );
                  continue;
                }

                const timestamp =
                  self.blockTimeCache.get(parsedLog.blockNumber) ?? 0;
                if (timestamp === 0) {
                  console.warn(
                    `RpcSource: Could not get timestamp for block ${parsedLog.blockNumber}, skipping log.`,
                  );
                  continue;
                }

                if (!parsedLog.eventName) {
                  console.warn(
                    "RpcSource: Encountered parsed log without event name, skipping:",
                    parsedLog,
                  );
                  continue; //
                }

                // Map the scanner's event name to our standardized RailgunEventType
                const railgunType = mapScannerEventToRailgunEvent(
                  parsedLog.eventName as EventType,
                  self.version,
                );
                if (!railgunType) {
                  // console.log(`RpcSource: Skipping unmapped event type: ${parsedLog.eventName}`);
                  continue; // Skip events we don't have a mapping/adapter for
                }

                // Call the specific adapter function based on the event type
                let adaptedEntries: DataEntry | DataEntry[] | null = null;
                try {
                  switch (parsedLog.eventName) {
                    case "CommitmentBatch":
                      adaptedEntries = adaptParsedCommitmentBatch(
                        parsedLog,
                        timestamp,
                      );
                      break;
                    case "Nullifiers":
                      adaptedEntries = adaptParsedNullifiers(
                        parsedLog,
                        timestamp,
                      );
                      break;
                    case "Unshield":
                      adaptedEntries = adaptParsedUnshield(
                        parsedLog,
                        timestamp,
                      );
                      break;
                    case "Shield":
                      adaptedEntries = adaptParsedShield(parsedLog, timestamp);
                      break;
                    // --- ADD CASES FOR ALL OTHER MAPPED EVENTS ---
                    case "GeneratedCommitmentBatch":
                      adaptedEntries = adaptParsedGeneratedCommitmentBatch(
                        parsedLog,
                        timestamp,
                      );
                      break;
                    case "Transact":
                      adaptedEntries = adaptParsedTransact(parsedLog, timestamp);
                      break;
                    case "Nullified":
                      adaptedEntries = adaptParsedNullified(parsedLog, timestamp);
                      break;
                    // case V1_EVENTS.COMMITMENT_BATCH: // handle V1 specific if needed
                    default:
                      // console.warn(`RpcSource: No adapter implemented for event type ${parsedLog.eventName}`);
                      break;
                  }
                } catch (adaptError) {
                  console.error(
                    `RpcSource: Error adapting ${parsedLog.eventName} log at block ${parsedLog.blockNumber}, tx ${parsedLog.transactionHash}:`,
                    adaptError,
                    parsedLog,
                  );
                  // skip this specific log, but continue processing the batch
                  continue;
                }

                // add the adapted entry (or entries) to the current batch buffer
                if (adaptedEntries) {
                  if (Array.isArray(adaptedEntries)) {
                    currentBatchEntries.push(...adaptedEntries);
                  } else {
                    currentBatchEntries.push(adaptedEntries);
                  }
                }
              } // end of loop through parsedLogs

              // sort the collected batch entries chronologically
              currentBatchEntries.sort((a, b) => {
                if (a.blockNumber !== b.blockNumber) {
                  // Convert bigint to number for safe subtraction if range is reasonable, otherwise use comparison
                  return a.blockNumber < b.blockNumber ? -1 : 1;
                }
                // If block numbers are the same, sort by log index
                return a.logIndex - b.logIndex;
              });
            } else {
              // No logs found in this range
              console.log(
                `RpcSource: No relevant logs found in blocks ${fromBlock}-${toBlock}`,
              );
            }

            // 5. Advance height for the next iteration's fetch
            currentHeight = toBlock + 1n;

            // 6. Loop will now re-evaluate.
            // - If currentBatchEntries was populated, the first item will be returned at the top of the loop.
            // - If currentBatchEntries is still empty (no events in the scanned range), the loop continues to fetch the *next* block range.
          } catch (error) {
            console.error(
              `RpcSource: Error processing blocks ${fromBlock}-${toBlock}:`,
              error,
            );
            // Strategy: Skip this batch and try the next one. Could implement retry logic here.
            currentHeight = toBlock + 1n;
            // Loop continues, will attempt to fetch the next batch.
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
      "RpcSource: Destroy called.",
      error ? `Error: ${error.message}` : "",
    );
    this.syncing = false;
    this.blockTimeCache.clear();
    // If scanner needs cleanup, call it here.
  }
}
