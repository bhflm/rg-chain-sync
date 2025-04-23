require('dotenv').config();
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { RpcSource } from '../src/data-sources/rpc/';
import { 
  RailgunEventType, 
  isNullifiersEntry,
  isGeneratedCommitmentBatchEntry,
  isTransactEntry
} from '../src/types/data-entry';
import { NetworkName } from '../src/config/network-config';
import { DataCompleteness } from '../src/types/datasource';

const API_KEY = process.env.API_KEY;
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe('RPC Event Adapters', () => {
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

  it('should fetch and iterate through multiple blocks collecting various event types', async () => {
    const startBlock = 14755920n;
    const scanLimitBlocks = 5000n;
    const endBlockSearch = startBlock + scanLimitBlocks;
    
    // Counters to track events found
    let nullifiersCount = 0;
    let generatedCommitmentBatchCount = 0;
    let transactCount = 0;
    
    console.log(`[Test] Starting event search from block ${startBlock}...`);

    // Get the iterator from the RpcSource
    const iterator = await rpcSource.read(startBlock);

    // Loop through the yielded DataEntry items
    for await (const entry of iterator) {
      console.log(`[Test] Processing entry: Type=${entry.type}, Block=${entry.blockNumber}`);

      // Stop if we've scanned beyond our test limit
      if (entry.blockNumber > endBlockSearch) {
        console.log(`[Test] Reached scan limit block ${endBlockSearch}, stopping.`);
        break;
      }

      // Test common fields for all event types
      assert.ok(entry.source === 'rpc', 'Source should be "rpc"');
      assert.ok(entry.completeness === DataCompleteness.BASIC, 'Completeness should be BASIC');
      assert.ok(entry.blockNumber >= startBlock, `Block number ${entry.blockNumber} should be >= start block ${startBlock}`);
      assert.ok(entry.transactionHash.startsWith('0x') && entry.transactionHash.length === 66, 'Transaction hash should be a valid 32-byte hex');
      assert.ok(entry.logIndex >= 0, 'Log index should be >= 0');
      assert.ok(entry.blockTimestamp > 0, 'Block timestamp should be a positive number');
      assert.strictEqual(entry.railgunTxid, undefined, 'RailgunTxid should be undefined for basic RPC');

      // Test specific event types
      if (isNullifiersEntry(entry)) {
        nullifiersCount++;
        
        const payload = entry.payload;
        assert.ok(typeof payload.treeNumber === 'number' && payload.treeNumber >= 0, 'Payload treeNumber should be a non-negative number');
        assert.ok(Array.isArray(payload.nullifiers), 'Payload nullifiers field must be an array');
        assert.ok(payload.nullifiers.length > 0, 'Payload nullifiers array should not be empty');
        
        // Check first nullifier format
        const firstNullifier = payload.nullifiers[0];
        assert.ok(typeof firstNullifier === 'string', 'Nullifier should be a string');
        assert.ok(firstNullifier.startsWith('0x'), 'Nullifier string should start with 0x');
        assert.strictEqual(firstNullifier.length, 66, `Nullifier hex string length should be 66 (0x + 64 hex chars), but got ${firstNullifier.length}`);
      }
      else if (isGeneratedCommitmentBatchEntry(entry)) {
        generatedCommitmentBatchCount++;
        
        const payload = entry.payload;
        assert.ok(typeof payload.treeNumber === 'number' && payload.treeNumber >= 0, 'Payload treeNumber should be a non-negative number');
        assert.ok(typeof payload.startPosition === 'number' && payload.startPosition >= 0, 'Payload startPosition should be a non-negative number');
        assert.ok(Array.isArray(payload.commitments), 'Payload commitments field must be an array');
        
        if (payload.commitments.length > 0) {
          const firstCommitment = payload.commitments[0];
          assert.ok(typeof firstCommitment.hash === 'string' && firstCommitment.hash.startsWith('0x'), 'Commitment hash should be a hex string');
          assert.ok(typeof firstCommitment.index === 'number' && firstCommitment.index >= 0, 'Commitment index should be a non-negative number');
        }
      }
      else if (isTransactEntry(entry)) {
        transactCount++;
        
        const payload = entry.payload;
        assert.ok(typeof payload.treeNumber === 'number' && payload.treeNumber >= 0, 'Payload treeNumber should be a non-negative number');
        assert.ok(typeof payload.startPosition === 'number' && payload.startPosition >= 0, 'Payload startPosition should be a non-negative number');
        assert.ok(Array.isArray(payload.commitments), 'Payload commitments field must be an array');
        
        if (payload.commitments.length > 0) {
          const firstCommitment = payload.commitments[0];
          assert.ok(typeof firstCommitment.hash === 'string' && firstCommitment.hash.startsWith('0x'), 'Commitment hash should be a hex string');
          assert.ok(typeof firstCommitment.index === 'number' && firstCommitment.index >= 0, 'Commitment index should be a non-negative number');
          
          // Ciphertext is optional, so check only if it exists
          if (firstCommitment.ciphertext) {
            assert.ok(Array.isArray(firstCommitment.ciphertext.data), 'Ciphertext data should be an array');
            assert.ok(typeof firstCommitment.ciphertext.blindedSenderViewingKey === 'string', 'Blinded sender viewing key should be a string');
            assert.ok(typeof firstCommitment.ciphertext.blindedReceiverViewingKey === 'string', 'Blinded receiver viewing key should be a string');
          }
        }
      }
    }

    // Report found event counts
    console.log(`[Test] Event counts in blocks ${startBlock}-${endBlockSearch}:`);
    console.log(`  Nullifiers: ${nullifiersCount}`);
    console.log(`  GeneratedCommitmentBatch: ${generatedCommitmentBatchCount}`);
    console.log(`  Transact: ${transactCount}`);
    
    // We should have found at least some events
    assert.ok(nullifiersCount + generatedCommitmentBatchCount + transactCount > 0, 
      `No events found in blocks ${startBlock}-${endBlockSearch}. Increase block range or check implementation.`);
  });
});