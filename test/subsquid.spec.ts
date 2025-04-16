import { describe, it, beforeEach, after, before } from 'node:test';
import assert from 'node:assert';
import { SubsquidSource } from '../src/data-sources/subsquid/';
import { RailgunEventType, DataEntry, isCommitmentBatchEntry, isNullifiersEntry } from '../src/types/data-entry'; // Import new types
import { NetworkName } from '../src/config/network-config';
import { DataCompleteness } from '../src/types/datasource';

describe('SubsquidSource', () => {
    let subsquidSource: SubsquidSource;

    before(async () => {
        subsquidSource = new SubsquidSource({
            network: 'ethereum',
        });

        const startTime = Date.now();
        const waitTimeout = 5000;
        while (subsquidSource.head === 0n && (Date.now() - startTime) < waitTimeout) {
            await new Promise(resolve => setTimeout(resolve, 50));
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


    // it('should initialize subsquid client and retrieve head correctly', async () => {
    //   const head = await subsquidSource.head;
    //   assert.ok(head > 0n, 'Head should be greater than 0');
    // });


      // Test case focused on finding the nullifier at the target block
      it('should fetch the first Nullifier event at or after block 14755920', async () => {
        const targetBlock = 14755920n;
        let foundMatch = false;
        const maxBlocksToScan = 50n; // Limit search range to avoid excessively long test
        const endScanBlock = targetBlock + maxBlocksToScan;

        console.log(`[Test Subsquid Source] Starting search for Nullifier at/after block ${targetBlock}...`);

        // Get the iterator, starting from the target block
        const iterator = await subsquidSource.read(targetBlock);

        // Iterate through the results
        for await (const entry of iterator) {
            console.log(`[Test Subsquid Source] Processing entry: Type=${entry.type}, Block=${entry.blockNumber}`);

            // Stop if we scan too far
             if (entry.blockNumber > endScanBlock) {
                console.log(`[Test Subsquid Source] Scanned up to block ${entry.blockNumber}, stopping search.`);
                break;
            }

            // Check if it's a nullifier and at or after the target block
            if (entry.blockNumber >= targetBlock && isNullifiersEntry(entry)) {
                foundMatch = true;
                console.log('SUBSQUID SOURCE TARGET: ',)
                console.log(`[Test Subsquid Source] Found Nullifiers entry at block ${entry.blockNumber}, tx ${entry.transactionHash}`);


                // --- Assertions on the first matching entry ---
                assert.strictEqual(entry.type, RailgunEventType.Nullifiers);
                assert.strictEqual(entry.source, 'subsquid');
                // Subsquid data *should* be complete relative to on-chain events it processes
                assert.strictEqual(entry.completeness, DataCompleteness.COMPLETE);
                assert.ok(entry.blockNumber >= targetBlock, `Block number ${entry.blockNumber} >= ${targetBlock}`);
                assert.ok(entry.transactionHash.startsWith('0x') && entry.transactionHash.length === 66);
                // Subsquid might not provide logIndex, adapter uses -1
                assert.ok(entry.logIndex === -1 || entry.logIndex >= 0);
                assert.ok(entry.blockTimestamp > 0);
                // railgunTxid might be undefined if not queried/linked
                // assert.ok(entry.railgunTxid === undefined || entry.railgunTxid.startsWith('0x'));

                const payload = entry.payload;
                assert.ok(typeof payload.treeNumber === 'number');
                assert.ok(Array.isArray(payload.nullifiers) && payload.nullifiers.length === 1); // Adapter makes one entry per nullifier

                const nullifierHex = payload.nullifiers[0];
                assert.strictEqual(typeof nullifierHex, 'string');
                assert.ok(nullifierHex.startsWith('0x'));
                assert.strictEqual(nullifierHex.length, 66, `Nullifier hex length: ${nullifierHex.length}`);

                // If specifically targeting 14755920, check the known value
                if (entry.blockNumber === targetBlock) {
                     const knownNullifiersInBlock = [
                        "0x1e52cee52f67c37a468458671cddde6b56390dcbdc4cf3b770badc0e78d66401",
                        "0x0ac9f5ab5bcb5a115a3efdd0475f6c22dc6a6841caf35a52ecf86a802bfce8ee"
                     ];
                     assert.ok(knownNullifiersInBlock.includes(nullifierHex), `Nullifier ${nullifierHex} not expected in block ${targetBlock}`);
                     console.log(`[Test Subsquid Source] Nullifier ${nullifierHex} matches known value for block ${targetBlock}.`);
                }

                console.log('[Test Subsquid Source] Validation successful. Stopping iteration.');
                break; // Stop after the first valid nullifier >= startBlock
            }
        }

        // Final assertion
        assert.ok(foundMatch, `Test failed: No Nullifiers event found and validated at or after block ${targetBlock} within ${maxBlocksToScan} blocks`);

    }); // Allow 30 seconds for this live test
});
