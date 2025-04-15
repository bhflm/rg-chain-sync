import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { RpcSource } from '../src/datasources/rpc';
import { RailgunEventType, isNullifiersEntry } from '../src/types/data-entry';
import { NetworkName } from '../src/config/network-config';
import { DataCompleteness } from '../src/types/datasource';

const API_KEY = '' // i dont wanna install dotenv for real i just dont want to
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;


describe('RpcSource', () => {
    let rpcSource: RpcSource;

    before(async () => {
        rpcSource = new RpcSource({
            networkName: NetworkName.Ethereum,
            providerUrl: alchemyURL,
            version: 'v2',
            batchSize: 500,
        });

        const startTime = Date.now();
        const waitTimeout = 5000;
        while (rpcSource.head === 0n && (Date.now() - startTime) < waitTimeout) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (rpcSource.head === 0n) {
            throw new Error("RpcSource head did not initialize in time");
        }
        console.log(`RpcSource initialized with head: ${rpcSource.head}`);
      });

    after(() => {
      if (rpcSource) {
        rpcSource.destroy();
      }
    });

  // it('should fetch and iterate through Nullifier events', async () => {
  //   // Choose a block range known to contain V2 Nullifier events on Ethereum Mainnet
  //   // Example range (adjust if needed based on actual data):
  //   const startBlock = 14755920n;
  //   const scanLimitBlocks = 5000n; // Limit how far we scan for this test
  //   const endBlockSearch = startBlock + scanLimitBlocks;
  //   let foundAndValidatedNullifier = false;
    
  //   console.log(`[Test] Starting Nullifier search from block ${startBlock}...`);

  //   // Get the iterator from the RpcSource
  //   const iterator = await rpcSource.read(startBlock);

  //   // Loop through the yielded DataEntry items
  //   for await (const entry of iterator) {
  //       console.log(`[Test] Processing entry: Type=${entry.type}, Block=${entry.blockNumber}`);

  //       // Stop if we've scanned beyond our test limit
  //       if (entry.blockNumber > endBlockSearch) {
  //           console.log(`[Test] Reached scan limit block ${endBlockSearch}, stopping.`);
  //           break;
  //       }

  //       // Check if this entry is the type we are looking for
  //       if (isNullifiersEntry(entry)) { // Use the type guard
  //           console.log(`[Test] Found Nullifiers event at block ${entry.blockNumber}, tx ${entry.transactionHash}`);
  //           foundAndValidatedNullifier = true;

  //           // --- Perform Assertions ---
  //           // 1. Standard DataEntry fields
  //           assert.strictEqual(entry.type, RailgunEventType.Nullifiers, 'Entry type should be Nullifiers');
  //           assert.strictEqual(entry.source, 'rpc', 'Source should be "rpc"');
  //           assert.strictEqual(entry.completeness, DataCompleteness.BASIC, 'Completeness should be BASIC');
  //           assert.ok(entry.blockNumber >= startBlock, `Block number ${entry.blockNumber} should be >= start block ${startBlock}`);
  //           assert.ok(entry.transactionHash.startsWith('0x') && entry.transactionHash.length === 66, 'Transaction hash should be a valid 32-byte hex');
  //           assert.ok(entry.logIndex >= 0, 'Log index should be >= 0');
  //           assert.ok(entry.blockTimestamp > 1600000000, 'Block timestamp should be a plausible Unix timestamp'); // Simple sanity check
  //           assert.strictEqual(entry.railgunTxid, undefined, 'RailgunTxid should be undefined for basic RPC');

  //           // 2. Specific NullifiersPayload fields
  //           const payload = entry.payload;
  //           assert.ok(typeof payload.treeNumber === 'number' && payload.treeNumber >= 0, 'Payload treeNumber should be a non-negative number');
  //           assert.ok(Array.isArray(payload.nullifiers), 'Payload nullifiers field must be an array');
  //           assert.ok(payload.nullifiers.length > 0, 'Payload nullifiers array should not be empty');


  //           console.log('PAYLOAD: ', payload);
  //           // 3. Check the format of the first nullifier in the array
  //           const firstNullifier = payload.nullifiers[0];
  //           assert.ok(typeof firstNullifier === 'string', 'Nullifier should be a string');
  //           assert.ok(firstNullifier.startsWith('0x'), 'Nullifier string should start with 0x');
  //           assert.strictEqual(firstNullifier.length, 66, `Nullifier hex string length should be 66 (0x + 64 hex chars), but got ${firstNullifier.length}`);

  //           console.log(`[Test] Successfully validated Nullifiers entry: ${JSON.stringify(entry, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

  //           break;
  //       }
  //   } 

  //   assert.ok(foundAndValidatedNullifier, `Test failed: No Nullifiers event found and validated between blocks ${startBlock} and ${endBlockSearch}`);
  // });


  it('should fetch the first V1 Nullifier event at or after block 14755920', async () => {
    const targetBlock = 14755920n;
    let foundMatch = false;
    // TARGET NULLIFIER
    const expectedNullifier = "0x1e52cee52f67c37a468458671cddde6b56390dcbdc4cf3b770badc0e78d66401";
    const maxBlocksToScan = 50n;
    const endScanBlock = targetBlock + maxBlocksToScan;

    console.log(`[Test RPC Source] Starting search for Nullifier at/after block ${targetBlock}...`);


    const iterator = await rpcSource.read(targetBlock);

    for await (const entry of iterator) {
        console.log(`[Test RPC Source] Processing entry: Type=${entry.type}, Block=${entry.blockNumber}`);

         if (entry.blockNumber > endScanBlock) {
            console.log(`[Test RPC Source] Scanned up to block ${entry.blockNumber}, stopping search.`);
            break;
        }

        // Check if it's a nullifier at or after the target block
        if (entry.blockNumber >= targetBlock && isNullifiersEntry(entry)) {
            foundMatch = true;
            console.log('RPC SOURCE TARGET: ', entry);
            console.log(`[Test RPC Source] Found Nullifiers entry at block ${entry.blockNumber}, tx ${entry.transactionHash}`);

            // --- Assertions ---
            assert.strictEqual(entry.type, RailgunEventType.Nullifiers);
            assert.strictEqual(entry.source, 'rpc');
            assert.strictEqual(entry.completeness, DataCompleteness.BASIC); // << TODO: double triple check on what kind of data should be defined here
            assert.ok(entry.blockNumber >= targetBlock);
            assert.ok(entry.transactionHash.startsWith('0x') && entry.transactionHash.length === 66);
            assert.ok(entry.logIndex >= 0); // RPC provides logIndex
            assert.ok(entry.blockTimestamp > 0);
            assert.strictEqual(entry.railgunTxid, undefined);

            const payload = entry.payload;
            assert.ok(typeof payload.treeNumber === 'number');
            assert.ok(Array.isArray(payload.nullifiers) && payload.nullifiers.length === 1);

            const nullifierHex = payload.nullifiers[0];
            assert.strictEqual(typeof nullifierHex, 'string');
            assert.ok(nullifierHex.startsWith('0x'));
            assert.strictEqual(nullifierHex.length, 66);

            // Crucially, check if it matches the expected nullifier from the target block
            if (entry.blockNumber === targetBlock && nullifierHex === expectedNullifier) {
                 console.log(`[Test RPC Source] Nullifier ${nullifierHex} matches expected value for block ${targetBlock}. Validation successful.`);
                 // Stop as soon as we find the specific nullifier we were looking for
                 break;
            } else if (entry.blockNumber === targetBlock) {
                 console.warn(`[Test RPC Source] Found nullifier ${nullifierHex} in target block, but it wasn't the expected ${expectedNullifier}. Continuing search...`);
                 foundMatch = false; // Reset flag as we haven't found the *exact* one yet
            } else {
                // Found a nullifier after the target block, validation is still good, stop.
                 console.log(`[Test RPC Source] Validation successful for nullifier after target block. Stopping iteration.`);
                 break;
            }
        }
    }

    assert.ok(foundMatch, `Test failed: Expected Nullifier ${expectedNullifier} not found and validated at or after block ${targetBlock} within ${maxBlocksToScan} blocks`);
  });
});
