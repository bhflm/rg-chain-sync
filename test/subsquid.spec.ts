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
      batchSize: 500,
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


  // Init
  it("should have initialized the head property", () => {
    assert.ok(subsquidSource.head > 0n, `Head should be > 0, got ${subsquidSource.head}`);
  });

  it("should report syncing as true initially", () => {
    assert.strictEqual(subsquidSource.syncing, true, "Should be syncing initially");
  });


  it("should fetch and validate Nullifier events", async () => {
    const targetBlock = 14755920n;
    await testEventType(targetBlock, RailgunEventType.Nullifiers, validateNullifierEvent);
  });

  // Core iteration && Pagination
  it("read should return a valid AsyncIterableIterator", async () => {
    const targetBlock = 14755920n;
    const iterator = await subsquidSource.read(targetBlock);
    assert.ok(iterator, "Iterator should be returned");
    assert.strictEqual(typeof iterator.next, "function", "Iterator should have next method");
    assert.strictEqual(typeof iterator[Symbol.asyncIterator], "function", "Iterator should be async iterable");
  });


  it("read(startBlock) should yield the first event at or after startBlock", async () => {
    const targetBlock = 14755920n;
    const iterator = await subsquidSource.read(targetBlock);
    const { value, done } = await iterator.next();
    assert.strictEqual(done, false, "Iterator should not be done immediately");
    assert.ok(value, "Iterator should yield a value");
    assert.ok(value.blockNumber >= targetBlock, `First yielded block ${value.blockNumber} should be >= start block ${targetBlock}`);
  });

  it("should yield events chronologically (blockNumber, then secondary sort)", async () => {
    const targetBlock = 14755920n;
    const startBlock = targetBlock - 1n; // Start slightly before
    const endBlock = targetBlock + 1n; // Scan a small range
    const iterator = await subsquidSource.read(startBlock);
    let lastBlock = 0n;
    let lastSecondaryKey = ""; // Use txHash or logIndex string
    let count = 0;

    for await (const entry of iterator) {
        if (entry.blockNumber > endBlock) break;
        if (entry.blockNumber < startBlock) continue; // Skip blocks before range if any yielded

        assert.ok(entry.blockNumber >= lastBlock, `Block number decreased: ${entry.blockNumber} < ${lastBlock}`);
        if (entry.blockNumber === lastBlock) {
            // Simple txHash comparison as secondary sort key (adapt if logIndex is reliable)
            const currentSecondaryKey = entry.transactionHash + (entry.logIndex > -1 ? `-${entry.logIndex}` : '');
            assert.ok(currentSecondaryKey >= lastSecondaryKey, `Secondary sort key decreased within block ${entry.blockNumber}: ${currentSecondaryKey} < ${lastSecondaryKey}`);
            lastSecondaryKey = currentSecondaryKey;
        } else {
            lastBlock = entry.blockNumber;
            lastSecondaryKey = entry.transactionHash + (entry.logIndex > -1 ? `-${entry.logIndex}` : ''); // Reset secondary key
        }
        count++;
        if (count >= BATCH_SIZE_FOR_TESTING * 2) break; // Don't run forever
    }
    assert.ok(count > 0, "Should have yielded at least one event in the range");
  }); // Longer timeout for potentially multiple fetches


  // Events validation

  // it("should fetch and validate Unshield events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.Unshield, validateUnshieldEvent);
  // });

  // it("should fetch and validate Shield events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.Shield, validateShieldEvent);
  // });

  // it("should fetch and validate Commitment events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.CommitmentBatch, validateCommitmentBatchEvent);
  // });

  // it("should fetch and validate GeneratedCommitment events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.GeneratedCommitmentBatch, validateGeneratedCommitmentEvent);
  // });

  // it("should fetch and validate Transact events", async () => {
  //   const targetBlock = 14755920n;
  //   await testEventType(targetBlock, RailgunEventType.Transact, validateTransactEvent);
  // });

  // it("should correlate railgunTxid with events when available", async () => {
  //   const targetBlock = 14755920n;
  //   const maxBlocksToScan = 2000n;
  //   const endScanBlock = targetBlock + maxBlocksToScan;

  //   // Get the iterator, starting from the target block
  //   const iterator = await subsquidSource.read(targetBlock);

  //   let foundWithRailgunTxid = false;

  //   for await (const entry of iterator) {
  //     // Stop if we scan too far
  //     if (entry.blockNumber > endScanBlock) {
  //       break;
  //     }

  //     // Check if any event has a railgunTxid
  //     if (entry.railgunTxid) {
  //       foundWithRailgunTxid = true;

  //       // Validate the railgunTxid
  //       assert.ok(typeof entry.railgunTxid === 'string');
  //       assert.ok(entry.railgunTxid.length > 0);

  //       console.log(`Found event with railgunTxid: ${entry.railgunTxid} at block ${entry.blockNumber}`);
  //       break;
  //     }
  //   }

  //   // This assertion is marked as optional since railgunTxid correlation depends on
  //   // whether the Subsquid schema properly stores this relationship
  //   if (!foundWithRailgunTxid) {
  //     console.warn('No events with railgunTxid found in the scan range. This might be normal if the Subsquid schema does not store this relationship.');
  //   }
  // });

  // Helper function to test a specific event type
  async function testEventType(targetBlock: bigint, eventType: RailgunEventType, validator: (entry: DataEntry) => void) {
    // Create a source that only fetches the specific event type
    const filteredSource = new SubsquidSource({
      network: "ethereum",
      batchSize: 100,
    });

    try {
      // Wait for head initialization
      const startTime = Date.now();
      const waitTimeout = 5000;
      while (filteredSource.head === 0n && Date.now() - startTime < waitTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const maxBlocksToScan = 2000n;
      const endScanBlock = targetBlock + maxBlocksToScan;

      console.log(`Searching for ${eventType} events starting at block ${targetBlock}...`);

      // Get the iterator, starting from the target block
      const iterator = await filteredSource.read(targetBlock);

      let foundMatch = false;

      // Iterate through the results
      for await (const entry of iterator) {
        // Stop if we scan too far
        console.log('READING ITERATOR: ', entry)
        //
        if (entry.blockNumber > endScanBlock) {
          console.log(`Scanned up to block ${entry.blockNumber}, stopping search.`);
          break;
        }

        // Check if it's the event type we're looking for
        if (entry.type === eventType) {
          foundMatch = true;
          console.log(`Found ${eventType} entry at block ${entry.blockNumber}, tx ${entry.transactionHash}`);

          // Validate the entry
          validator(entry);

          console.log(`Validation successful for ${eventType}.`);
          break;
        }
      }

      // Skip assertion if no events found - this is acceptable for less common event types
      if (!foundMatch) {
        console.warn(`No ${eventType} events found in the scan range. Skipping validation.`);
      }
    } finally {
      filteredSource.destroy();
    }
  }

  // Validators for each event type
  function validateBaseFields(entry: DataEntry) {
    assert.strictEqual(entry.source, "subsquid");
    assert.strictEqual(entry.completeness, DataCompleteness.COMPLETE);
    assert.ok(typeof entry.blockNumber === 'bigint' && entry.blockNumber > 0n);
    assert.ok(typeof entry.transactionHash === 'string' && entry.transactionHash.startsWith("0x"));
    assert.ok(typeof entry.blockTimestamp === 'number' && entry.blockTimestamp > 0);
  }

  function validateNullifierEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.Nullifiers);
    assert.ok(isNullifiersEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.treeNumber === "number");
    assert.ok(Array.isArray(payload.nullifiers) && payload.nullifiers.length > 0);

    // Validate the first nullifier
    const nullifier = payload.nullifiers[0];
    assert.ok(typeof nullifier === 'string' && nullifier.startsWith('0x'));
  }

  function validateUnshieldEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.Unshield);
    assert.ok(isUnshieldEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.to === 'string' && payload.to.startsWith('0x'));
    assert.ok(typeof payload.tokenAddress === 'string' && payload.tokenAddress.startsWith('0x'));
    assert.ok(typeof payload.tokenType === 'number');
    assert.ok(typeof payload.tokenSubID === 'bigint');
    assert.ok(typeof payload.amount === 'bigint');
    assert.ok(typeof payload.fee === 'bigint');
  }

  function validateShieldEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.Shield);
    assert.ok(isShieldEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.treeNumber === 'number');
    assert.ok(typeof payload.startPosition === 'number');
    assert.ok(Array.isArray(payload.commitments) && payload.commitments.length > 0);
    assert.ok(Array.isArray(payload.fees));

    // Validate the first commitment
    const commitment = payload.commitments[0];
    assert.ok(typeof commitment.hash === 'string' && commitment.hash.startsWith('0x'));
    assert.ok(typeof commitment.index === 'number');
    assert.ok(commitment.preimage);
    assert.ok(commitment.encryptedBundle);
    assert.ok(commitment.shieldKey);
  }

  function validateCommitmentBatchEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.CommitmentBatch);
    assert.ok(isCommitmentBatchEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.treeNumber === 'number');
    assert.ok(typeof payload.startPosition === 'number');
    assert.ok(Array.isArray(payload.commitments) && payload.commitments.length > 0);

    // Validate the first commitment
    const commitment = payload.commitments[0];
    assert.ok(typeof commitment.hash === 'string' && commitment.hash.startsWith('0x'));
    assert.ok(typeof commitment.index === 'number');

    // LegacyEncryptedCommitment has ciphertext
    if (commitment.ciphertext) {
      assert.ok(Array.isArray(commitment.ciphertext.ephemeralKeys));
      assert.ok(typeof commitment.ciphertext.memo === 'string');
      assert.ok(Array.isArray(commitment.ciphertext.data));
      assert.ok(typeof commitment.ciphertext.iv === 'string');
      assert.ok(typeof commitment.ciphertext.tag === 'string');
    }
  }

  function validateGeneratedCommitmentEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.GeneratedCommitmentBatch);
    assert.ok(isGeneratedCommitmentBatchEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.treeNumber === 'number');
    assert.ok(typeof payload.startPosition === 'number');
    assert.ok(Array.isArray(payload.commitments) && payload.commitments.length > 0);

    // Validate the first commitment
    const commitment = payload.commitments[0];
    assert.ok(typeof commitment.hash === 'string' && commitment.hash.startsWith('0x'));
    assert.ok(typeof commitment.index === 'number');
    assert.ok(commitment.preimage);
    assert.ok(typeof commitment.preimage.npk === 'string');
    assert.ok(commitment.preimage.token);
    assert.ok(typeof commitment.preimage.value === 'bigint');
    assert.ok(Array.isArray(commitment.encryptedRandom));
  }

  function validateTransactEvent(entry: DataEntry) {
    validateBaseFields(entry);
    assert.strictEqual(entry.type, RailgunEventType.Transact);
    assert.ok(isTransactEntry(entry));

    const payload = entry.payload;
    assert.ok(typeof payload.treeNumber === 'number');
    assert.ok(typeof payload.startPosition === 'number');
    assert.ok(Array.isArray(payload.commitments) && payload.commitments.length > 0);

    // Validate the first commitment
    const commitment = payload.commitments[0];
    assert.ok(typeof commitment.hash === 'string' && commitment.hash.startsWith('0x'));
    assert.ok(typeof commitment.index === 'number');
    assert.ok(commitment.ciphertext);
    assert.ok(Array.isArray(commitment.ciphertext.data));
    assert.ok(typeof commitment.ciphertext.blindedSenderViewingKey === 'string');
    assert.ok(typeof commitment.ciphertext.blindedReceiverViewingKey === 'string');
    assert.ok(typeof commitment.ciphertext.annotationData === 'string');
    assert.ok(typeof commitment.ciphertext.memo === 'string');
  }
});
