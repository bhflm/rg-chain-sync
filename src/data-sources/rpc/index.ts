import { ReadableStream } from "node:stream/web";
import { parseEventLogs, type Abi, type Log } from "viem";
import {
  adaptParsedCommitmentBatch,
  adaptParsedNullifiers,
  adaptParsedShield,
  adaptParsedUnshield,
} from "../../adapters/rpc-events";
import {
  RailgunScanner,
  type EventType,
  type ScannerVersion,
} from "../../services/scanner";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
import { DataSource } from "../../types/datasource";

function mapScannerEventToRailgunEvent(
  scannerEvent: EventType,
  version: ScannerVersion,
): RailgunEventType | null {
  switch (scannerEvent) {
    case "CommitmentBatch":
      return RailgunEventType.CommitmentBatch;
    case "GeneratedCommitmentBatch":
      return RailgunEventType.GeneratedCommitmentBatch; // Need to add this payload/type
    case "Nullifiers":
      return RailgunEventType.Nullifiers;
    case "Shield":
      return RailgunEventType.Shield;
    case "Unshield":
      return RailgunEventType.Unshield;
    // case 'Transact': return RailgunEventType.Transact; // Need to add this payload/type
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
  private activeStream: ReadableStreamDefaultController<DataEntry> | null;
  private isDestroyed: boolean;

  head: bigint = 0n;
  syncing: boolean = true;

  constructor(
    scannerConfig: ConstructorParameters<typeof RailgunScanner>[0], // Pass scanner config directly
  ) {
    this.scanner = new RailgunScanner(scannerConfig);
    // @ts-ignore // dirty bad boy // TODO: Implement this as a public getter
    this.currentAbi = this.scanner.currentAbi!;
    // @ts-ignore // dirty bad boy stop  // TODO: Implement this as a public getter
    this.version = this.scanner.version;
    // @ts-ignore // bad boy stop doing this // TODO: Implement this as a public getter
    this.batchSize = this.scanner.batchSize;
    this.activeStream = null;
    this.isDestroyed = false;
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
  ): Promise<ReadableStream<DataEntry>> {
    let streamCurrentHead = this.head;

    const self = this; // Capture 'this' context
    let currentHeight = height;
    let isCancelled = false; // Flag specific to this stream instance

    console.log(
      `RpcSource: Creating ReadableStream starting from height ${height}`,
    );

    const stream = new ReadableStream({
      async start(controller) {
        console.log("rpcSource readableStream start");

        // kickoff with updating block;
        if (streamCurrentHead === 0n || height > streamCurrentHead) {
          await self.updateHead();
          streamCurrentHead = self.head;
        }
      },

      async pull(controller) {
        // basically the iterator method to pull data and expiose it as readable ??
        //

        console.log("pull desiredSize: ", controller.desiredSize);

        console.log(
          `RpcSource Stream [${height}]: pull called. Current height: ${currentHeight}, Head: ${streamCurrentHead}, stream size: ${controller.desiredSize}`,
        );

        if (isCancelled || self.isDestroyed) {
          console.log(
            `RpcSource Stream [${height}]: Pull aborted (cancelled or destroyed).`,
          );
          if (!isCancelled) {
            try {
              controller.close();
            } catch {
              console.error("catch err");
            }
          }
          return;
        }

        console.log("continue pull");

        try {
          while (
            controller.desiredSize! > 0 &&
            !isCancelled &&
            !self.isDestroyed
          ) {
            // check if we're past the last known head for the stream
            if (currentHeight > streamCurrentHead) {
              console.log("currentHeihgt > streamCurrentHEad");
              await self.updateHead();
              streamCurrentHead = self.head;
              console.log("updated head");

              // does this actually happen like wtf ??
              // if (currentHeight > streamCurrentHead) {
              //   // We are truly caught up. Options:
              //   // A) Close the stream if it's not meant to be live indefinitely.
              //   //    controller.close();
              //   //    self.activeStreams.delete(controller);
              //   //    console.log(`RpcSource Stream [${height}]: Caught up to head ${streamCurrentHead}. Closing stream.`);
              //   //    return; // Exit pull loop

              //   // B) Wait and try again later (for live syncing)
              //   console.log(
              //     `RpcSource Stream [${height}]: Caught up to head ${streamCurrentHead}. Waiting for new blocks...`,
              //   );
              //   self.syncing = true; // Indicate we are waiting for new blocks state
              //   // Wait for a bit before checking the head again
              //   await new Promise((resolve) => setTimeout(resolve, 5000)); // 5-second wait
              //   continue; // Re-evaluate the head in the next iteration of the while loop
              // } else {
              //   // Head advanced, continue processing the new range in this loop iteration
              //   self.syncing = true; // Indicate we are actively syncing
              // }
              //
              //
              //
            }

            // 2. Determine the block range for the next batch fetch
            const fromBlock = currentHeight;
            const potentialToBlock = fromBlock + BigInt(self.batchSize - 1);
            // Fetch up to batchSize blocks, but don't go beyond the current head
            const toBlock =
              potentialToBlock > streamCurrentHead
                ? streamCurrentHead
                : potentialToBlock;

            // Sanity check: If fromBlock ended up > toBlock (e.g., head didn't advance much, or only 1 block needed)
            // This can happen if head == fromBlock. toBlock becomes head.
            if (fromBlock > toBlock) {
              console.log(
                `RpcSource Stream [${height}]: fromBlock (${fromBlock}) > toBlock (${toBlock}). Likely waiting for next block at head. Waiting...`,
              );
              self.syncing = true; // Waiting state
              await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait
              continue; // Re-evaluate head and range
            }

            console.log(
              `RpcSource Stream [${height}]: Fetching batch: blocks ${fromBlock} to ${toBlock}`,
            );

            let batchEntries: DataEntry[] = [];
            let logsFound = false;

            try {
              // @ts-ignore // TODO: Implement public getter in RailgunScanner
              const contractAddress = self.scanner.getContractAddress();
              // @ts-ignore // TODO: Implement public getter in RailgunScanner
              const client = self.scanner.client;

              const rawLogs: Log[] = await client.getLogs({
                address: contractAddress,
                fromBlock,
                toBlock,
              });

              logsFound = rawLogs.length > 0;

              if (logsFound) {
                const parsedLogs = parseEventLogs({
                  abi: self.currentAbi,
                  logs: rawLogs,
                  strict: false, // Allow ABI to have more events than found
                });

                // Pre-fetch all unique block timestamps concurrently
                const blockNumbersInBatch = [
                  ...new Set(
                    parsedLogs
                      .map((log) => log.blockNumber)
                      .filter((bn) => bn !== null),
                  ),
                ] as bigint[];

                // Optimization: Fetch only timestamps not already in cache
                const timestampsToFetch = blockNumbersInBatch.filter(
                  (bn) => !self.blockTimeCache.has(bn),
                );
                if (timestampsToFetch.length > 0) {
                  console.log(
                    `RpcSource Stream [${height}]: Fetching ${timestampsToFetch.length} timestamps for blocks ${fromBlock}-${toBlock}`,
                  );
                  await Promise.all(
                    timestampsToFetch.map((bn) => self.getBlockTimestamp(bn)),
                  );
                }

                for (const parsedLog of parsedLogs) {
                  // Check for cancellation/destruction frequently
                  if (isCancelled || self.isDestroyed) break;

                  if (
                    parsedLog.blockNumber === null ||
                    parsedLog.logIndex === null ||
                    parsedLog.transactionHash === null
                  ) {
                    console.warn(
                      `RpcSource Stream [${height}]: Skipping log with null block/tx/log index:`,
                      parsedLog,
                    );
                    continue;
                  }
                  if (!parsedLog.eventName) {
                    console.warn(
                      `RpcSource Stream [${height}]: Skipping parsed log without event name:`,
                      parsedLog,
                    );
                    continue;
                  }

                  const timestamp = self.blockTimeCache.get(
                    parsedLog.blockNumber,
                  );
                  if (timestamp === undefined) {
                    // This should ideally not happen if pre-fetching worked and getBlockTimestamp throws on failure
                    console.error(
                      `RpcSource Stream [${height}]: CRITICAL: Timestamp not found for block ${parsedLog.blockNumber} after fetching. Skipping log.`,
                    );
                    continue;
                  }

                  const railgunType = mapScannerEventToRailgunEvent(
                    parsedLog.eventName as EventType,
                    self.version,
                  );

                  if (!railgunType) continue; // Skip unmapped/unwanted events

                  // Apply eventTypes filter if provided
                  if (
                    eventTypes &&
                    eventTypes.length > 0 &&
                    !eventTypes.includes(railgunType)
                  ) {
                    continue; // Skip if not in the requested filter list
                  }

                  let adaptedEntries: DataEntry | DataEntry[] | null = null;
                  try {
                    // Use adapter functions based on the mapped type
                    switch (
                      railgunType // Switch on railgunType for clarity
                    ) {
                      case RailgunEventType.CommitmentBatch:
                        adaptedEntries = adaptParsedCommitmentBatch(
                          parsedLog,
                          timestamp,
                        );
                        break;
                      case RailgunEventType.Nullifiers:
                        adaptedEntries = adaptParsedNullifiers(
                          parsedLog,
                          timestamp,
                        );
                        break;
                      case RailgunEventType.Unshield:
                        adaptedEntries = adaptParsedUnshield(
                          parsedLog,
                          timestamp,
                        );
                        break;
                      case RailgunEventType.Shield:
                        adaptedEntries = adaptParsedShield(
                          parsedLog,
                          timestamp,
                        );
                        break;
                      // Add cases for GeneratedCommitmentBatch, Transact etc. when adapters exist
                      // case RailgunEventType.GeneratedCommitmentBatch:
                      //   adaptedEntries = adaptParsedGeneratedCommitmentBatch(parsedLog, timestamp);
                      //   break;
                      default:
                        // Already filtered by mapScannerEventToRailgunEvent, this shouldn't be hit often unless map returns valid but no adapter exists
                        // console.warn(`RpcSource Stream [${height}]: No adapter found for mapped event type: ${railgunType}`);
                        break;
                    }
                  } catch (adaptError) {
                    console.error(
                      `RpcSource Stream [${height}]: Error adapting ${parsedLog.eventName} (Type: ${railgunType}) log at block ${parsedLog.blockNumber}, tx ${parsedLog.transactionHash}:`,
                      adaptError,
                      parsedLog,
                    );
                    continue; // Skip this log on adaptation error
                  }

                  if (adaptedEntries) {
                    if (Array.isArray(adaptedEntries)) {
                      batchEntries.push(...adaptedEntries);
                    } else {
                      batchEntries.push(adaptedEntries);
                    }
                  }
                } // End loop through parsedLogs

                // Sort the collected batch entries chronologically if any were added
                if (batchEntries.length > 0) {
                  batchEntries.sort((a, b) => {
                    if (a.blockNumber !== b.blockNumber) {
                      return a.blockNumber < b.blockNumber ? -1 : 1;
                    }
                    return a.logIndex - b.logIndex; // Use logIndex for intra-block ordering
                  });
                }
              } else {
                // No logs found in this range
                console.log(
                  `RpcSource Stream [${height}]: No relevant logs found in blocks ${fromBlock}-${toBlock}`,
                );
              }

              // Check cancellation/destruction again after processing batch
              if (isCancelled || self.isDestroyed) break;
            } catch (fetchError) {
              console.error(
                `RpcSource Stream [${height}]: Error fetching/processing blocks ${fromBlock}-${toBlock}:`,
                fetchError,
              );
              // Decide on error strategy:
              // 1. Retry? (Complex)
              // 2. Skip batch and continue? (Potential data loss)
              // 3. Error the stream? (Safest for consumer)
              controller.error(
                fetchError instanceof Error
                  ? fetchError
                  : new Error(String(fetchError)),
              );
              self.syncing = false; // Assume error stops syncing process
              return; // Exit pull
            }

            // 4. Enqueue the processed batch entries
            for (const entry of batchEntries) {
              if (isCancelled || self.isDestroyed) break; // Check before each enqueue
              controller.enqueue(entry);
            }

            // 5. Advance height for the next iteration
            currentHeight = toBlock + 1n;

            // 6. Check if we should exit the loop
            // - If we were cancelled or destroyed, the break condition handles it.
            // - If we enqueued data, the loop condition `controller.desiredSize > 0` will be re-evaluated.
            //   If the buffer is full (`desiredSize <= 0`), the loop exits, and `pull` finishes.
            //   It will be called again later when the consumer reads data.
            // - If we *didn't* enqueue data (empty batch), but we are not caught up to the head,
            //   the loop continues automatically to fetch the *next* range.
            if (batchEntries.length > 0 && controller.desiredSize! <= 0) {
              console.log(
                `RpcSource Stream [${height}]: Enqueued ${batchEntries.length} entries. Buffer is now full or consumer doesn't need more yet. Pausing pull.`,
              );
              // Exit the pull function, it will be called again when needed
              return;
            }
            // If no entries found OR buffer still has space, continue the while loop to get more data immediately.
          } // End of while

          // If the loop finished cleanly (e.g., cancelled, destroyed)
          if (isCancelled || self.isDestroyed) {
            console.log(
              `RpcSource Stream [${height}]: Exited pull loop due to cancellation or destruction.`,
            );
            // Ensure controller is closed if not already handled by cancel
            if (!isCancelled) {
              try {
                controller.close();
              } catch {}
            }
          } else if (controller.desiredSize! <= 0) {
            console.log(
              `RpcSource Stream [${height}]: Exited pull loop because desiredSize <= 0.`,
            );
          }
        } catch (error) {
          // Catch unexpected errors within the pull logic itself
          console.error(
            `RpcSource Stream [${height}]: Unexpected error in pull mechanism at height ${currentHeight}:`,
            error,
          );
          controller.error(
            error instanceof Error ? error : new Error(String(error)),
          );
          self.syncing = false;
        }
      },

      cancel(reason) {
        console.log(
          `RpcSource Stream [${height}]: Cancel called. Reason: ${reason?.message || reason}`,
        );
        isCancelled = true; // Set the flag to stop processing in pull
        // Optional: Any other cleanup specific to *this* stream instance
      },
    });

    return Promise.resolve(stream);
  }

  destroy(error?: Error): void {
    console.log(
      "RpcSource: Destroy called.",
      error ? `Error: ${error.message}` : "",
    );
    this.syncing = false;
    this.blockTimeCache.clear();
    // If scanner needs cleanup, call it here.
    //
    //
    console.log("RpcSource: Resources cleaned up.");
  }
}
