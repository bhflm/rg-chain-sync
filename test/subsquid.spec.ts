import { describe, it, beforeEach, after, before } from "node:test";
import assert from "node:assert";
import { SubsquidSource } from "../src/data-sources/subsquid/";
import {
  RailgunEventType,
  DataEntry,
  isNullifiersEntry,
  isUnshieldEntry,
  isShieldEntry,
  isTransactEntry,
  isCommitmentBatchEntry,
  isGeneratedCommitmentBatchEntry
} from "../src/types/data-entry";
import { DataCompleteness } from "../src/types/datasource";


const BATCH_SIZE_FOR_TESTING = 50;

describe("SubsquidSource Integration", () => {
  let subsquidSource: SubsquidSource;

  before(async () => {
    // Initialize the SubsquidSource
    subsquidSource = new SubsquidSource({
      network: "ethereum",
      batchSize: 100,
    });

    // Wait for head initialization
    const startTime = Date.now();
    const waitTimeout = 5000;
    while (subsquidSource.head === 0n && Date.now() - startTime < waitTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (subsquidSource.head === 0n) {
      throw new Error("SubsquidSource head did not initialize in time");
    }
    console.log(`SubsquidSource initialized with head: ${subsquidSource.head}`);
  });

  after(() => {
    if (subsquidSource) {
      subsquidSource.destroy();
    }
  });

  // // Init //
  // it("should have initialized the head property", () => {
  //   assert.ok(subsquidSource.head > 0n, `Head should be > 0, got ${subsquidSource.head}`);
  // });

  // it("should report syncing as true initially", () => {
  //   assert.strictEqual(subsquidSource.syncing, true, "Should be syncing initially");
  // });


  // it("should fetch and validate Nullifier events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.Nullifiers, validateNullifierEvent);
  // });

  // // Core iteration && Pagination //
  // it("read should return a valid AsyncIterableIterator", async () => {
  //   const targetBlock = 14755920n;
  //   const iterator = await subsquidSource.read(targetBlock);
  //   assert.ok(iterator, "Iterator should be returned");
  //   assert.strictEqual(typeof iterator.next, "function", "Iterator should have next method");
  //   assert.strictEqual(typeof iterator[Symbol.asyncIterator], "function", "Iterator should be async iterable");
  // });


  // it("read(startBlock) should yield the first event at or after startBlock", async () => {
  //   const targetBlock = 14755920n;
  //   const iterator = await subsquidSource.read(targetBlock);
  //   const { value, done } = await iterator.next();
  //   assert.strictEqual(done, false, "Iterator should not be done immediately");
  //   assert.ok(value, "Iterator should yield a value");
  //   assert.ok(value.blockNumber >= targetBlock, `First yielded block ${value.blockNumber} should be >= start block ${targetBlock}`);
  // });

  // it("should yield events chronologically (blockNumber, then secondary sort)", async () => {
  //   const targetBlock = 14755920n;
  //   const startBlock = targetBlock - 1n; // Start slightly before
  //   const endBlock = targetBlock + 1n; // Scan a small range
  //   const iterator = await subsquidSource.read(startBlock);
  //   let lastBlock = 0n;
  //   let lastSecondaryKey = ""; // Use txHash or logIndex string
  //   let count = 0;

  //   for await (const entry of iterator) {
  //       if (entry.blockNumber > endBlock) break;
  //       if (entry.blockNumber < startBlock) continue; // Skip blocks before range if any yielded

  //       assert.ok(entry.blockNumber >= lastBlock, `Block number decreased: ${entry.blockNumber} < ${lastBlock}`);
  //       if (entry.blockNumber === lastBlock) {
  //           // Simple txHash comparison as secondary sort key (adapt if logIndex is reliable)
  //           const currentSecondaryKey = entry.transactionHash + (entry.logIndex > -1 ? `-${entry.logIndex}` : '');
  //           assert.ok(currentSecondaryKey >= lastSecondaryKey, `Secondary sort key decreased within block ${entry.blockNumber}: ${currentSecondaryKey} < ${lastSecondaryKey}`);
  //           lastSecondaryKey = currentSecondaryKey;
  //       } else {
  //           lastBlock = entry.blockNumber;
  //           lastSecondaryKey = entry.transactionHash + (entry.logIndex > -1 ? `-${entry.logIndex}` : ''); // Reset secondary key
  //       }
  //       count++;
  //       if (count >= BATCH_SIZE_FOR_TESTING * 2) break; // Don't run forever
  //   }
  //   assert.ok(count > 0, "Should have yielded at least one event in the range");
  // });

  // it("should correctly paginate through multiple batches", async () => {
  //   // test relies on the specific range having more events than the batch size

  //   const RANGE_START_BLOCK = 19000000n;
  //   const RANGE_END_BLOCK = 19000500n;

  //   const iterator = await subsquidSource.read(RANGE_START_BLOCK);
  //   let yieldedCount = 0;
  //   for await (const entry of iterator) {
  //     if (entry.blockNumber > RANGE_END_BLOCK) break;
  //     if (entry.blockNumber >= RANGE_START_BLOCK) {
  //       yieldedCount++;
  //     }
  //   }
  //   console.log(`Pagination test: Yielded ${yieldedCount} events in range ${RANGE_START_BLOCK}-${RANGE_END_BLOCK}`);
  //   assert.ok(yieldedCount > BATCH_SIZE_FOR_TESTING, `Should yield more than batch size (${BATCH_SIZE_FOR_TESTING}), got ${yieldedCount}`);
  // });

  // it("should stop iteration when no more data is available", async () => {
  //   const farFutureBlock = subsquidSource.head + 1000n; // way past the current head
  //   const iterator = await subsquidSource.read(farFutureBlock);
  //   const { done } = await iterator.next();
  //   assert.strictEqual(done, true, "Iterator should be done immediately when starting past the head");
  // });


  // events validation || data adapters

  // it("should correctly adapt Nullifier data", async () => {
  //   const KNOWN_TX_HASH_FOR_NULLIFIER = "0xf07a9a458f57f1cc9cc2e5a627c3ef611a18b77e10c2bfc133fceca7743f8d0c";
  //   const EXPECTED_NULLIFIER_IN_BLOCK = "0x1e52cee52f67c37a468458671cddde6b56390dcbdc4cf3b770badc0e78d66401";
  //   const EXPECTED_TREE_NUMBER_FOR_NULLIFIER = 0;

  //   const targetBlock = 14755920n;

  //   const iterator = await subsquidSource.read(targetBlock);
  //   let foundEvent: DataEntry | null = null;

  //   for await (const entry of iterator) {
  //     // console.log('ENTRY: ', entry);
  //     // console.log('ENTRY: ', entry.blockNumber, targetBlock, entry.blockNumber === targetBlock);
  //     // console.log('ENTRY TXHASH: ', entry.transactionHash, KNOWN_TX_HASH_FOR_NULLIFIER, entry.transactionHash === KNOWN_TX_HASH_FOR_NULLIFIER);
  //     // console.log('ENTRY payload nullifier: ', entry.type, entry.payload, EXPECTED_NULLIFIER_IN_BLOCK);

  //       if (entry.blockNumber > targetBlock) break; // Only check target block
  //       if (entry.blockNumber === targetBlock &&
  //           isNullifiersEntry(entry) &&
  //           entry.transactionHash === KNOWN_TX_HASH_FOR_NULLIFIER &&
  //           entry.payload.nullifiers.includes(EXPECTED_NULLIFIER_IN_BLOCK))
  //       {
  //           foundEvent = entry;
  //           break;
  //       }
  //   }

  //   console.log('FOUND EVENT: ', foundEvent);

  //   assert.ok(foundEvent, `Expected nullifier ${EXPECTED_NULLIFIER_IN_BLOCK} not found in block ${targetBlock}`);
  //   if (!foundEvent || !isNullifiersEntry(foundEvent)) return;

  //   assert.strictEqual(foundEvent.type, RailgunEventType.Nullifiers, "Type mismatch");
  //   assert.strictEqual(foundEvent.source, "subsquid", "Source mismatch");
  //   assert.strictEqual(foundEvent.completeness, DataCompleteness.COMPLETE, "Completeness mismatch");
  //   assert.strictEqual(foundEvent.blockNumber, targetBlock, "Block number mismatch");
  //   assert.strictEqual(foundEvent.transactionHash, KNOWN_TX_HASH_FOR_NULLIFIER, "TX Hash mismatch");
  //   assert.ok(foundEvent.blockTimestamp > 0, "Timestamp invalid");
  //   assert.strictEqual(foundEvent.payload.treeNumber, EXPECTED_TREE_NUMBER_FOR_NULLIFIER, "Tree number mismatch");
  //   assert.ok(foundEvent.payload.nullifiers.includes(EXPECTED_NULLIFIER_IN_BLOCK), "Expected nullifier missing in payload");
  //   assert.ok(foundEvent.payload.nullifiers[0].startsWith('0x') && foundEvent.payload.nullifiers[0].length === 66, "Nullifier format invalid");
  // });

  it("should correctly adapt Commitment data (from Transact/Shield)", async () => {
    const targetBlock = 14755920n;
    const EXPECTED_COMMITMENT_HASH = '0x1afd01a29faf22dcc5678694092a08d38de99fc97d07b9281fa66f956ce43579';
    const EXPECTED_COMMITMENT_INDEX = 2;
    const KNOWN_TX_HASH_FOR_COMMITMENT = '0xf07a9a458f57f1cc9cc2e5a627c3ef611a18b77e10c2bfc133fceca7743f8d0c';
    const EXPECTED_COMMITMENT_TYPE = RailgunEventType.CommitmentBatch;
    const EXPECTED_TREE_NUMBER_FOR_COMMITMENT = 0;
    const EXPECTED_START_POSITION_FOR_COMMITMENT = 2;
    const EXPECTED_RAILGUN_TX_ID = '0x0000000000000000000000000000000000000000000000000000000000e1285000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000000';

    const iterator = await subsquidSource.read(targetBlock);
    let foundEvent: DataEntry | null = null;

    for await (const entry of iterator) {
        if (entry.blockNumber > targetBlock) break;
        if (entry.blockNumber === targetBlock &&
            entry.transactionHash === KNOWN_TX_HASH_FOR_COMMITMENT &&
            isCommitmentBatchEntry(entry)
        ) // Check relevant types
        {
            // console.log('TARGET BLOCK ENTRY: ', entry);
            // console.log('COMMITMENT: ', JSON.stringify((entry.payload)))
            // Find the specific commitment if needed, or just validate the first one
            //
              const commitment = entry.payload.commitments.find(c => c.hash === EXPECTED_COMMITMENT_HASH || c.index === EXPECTED_COMMITMENT_INDEX);
              if (commitment) {
                  foundEvent = entry; // Found the transaction containing the commitment
                  break;
              }
        }
    }

    assert.ok(foundEvent, `Expected commitment event not found in block ${targetBlock} tx ${KNOWN_TX_HASH_FOR_COMMITMENT}`);
    if (!foundEvent) return;

    assert.strictEqual(foundEvent.type, EXPECTED_COMMITMENT_TYPE, "Commitment event type mismatch");
    assert.strictEqual(foundEvent.source, "subsquid");
    assert.strictEqual(foundEvent.completeness, DataCompleteness.COMPLETE);
    assert.strictEqual(foundEvent.blockNumber, targetBlock);
    assert.strictEqual(foundEvent.transactionHash, KNOWN_TX_HASH_FOR_COMMITMENT);
    assert.strictEqual(foundEvent.payload.treeNumber, EXPECTED_TREE_NUMBER_FOR_COMMITMENT);
    assert.strictEqual(foundEvent.payload.startPosition, EXPECTED_START_POSITION_FOR_COMMITMENT);
    assert.strictEqual(foundEvent.railgunTxid, EXPECTED_RAILGUN_TX_ID);

    const targetCommitment = foundEvent.payload.commitments.find(c => c.hash === EXPECTED_COMMITMENT_HASH || c.index === EXPECTED_COMMITMENT_INDEX);
    assert.ok(targetCommitment, "Target commitment not found within the payload");
    assert.strictEqual(targetCommitment.hash, EXPECTED_COMMITMENT_HASH, "Commitment hash mismatch");
    assert.strictEqual(targetCommitment.index, EXPECTED_COMMITMENT_INDEX, "Commitment index mismatch");
  });


});
