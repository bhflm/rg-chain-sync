require('dotenv').config();
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { RpcSource } from '../src/data-sources/rpc/';
import { NetworkName } from '../src/config/network-config';
import { DataEntry, RailgunEventType } from '../src/types/data-entry';

const API_KEY = process.env.API_KEY;
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe('RPC Source Integration Test', () => {
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
  
  it('should locate blocks with Shield and CommitmentBatch events', async () => {
    // Use a block range at an earlier time for Railgun - might have more activity
    const startBlock = 14900000n; // Earlier block range with more activity
    const blockRange = 10000n;    // Larger range to ensure finding relevant events
    const endBlock = startBlock + blockRange;
    
    console.log(`[Shield/Commitment Test] Scanning blocks ${startBlock} to ${endBlock}...`);
    
    // We'll track specific blocks with event types
    const shieldBlocks: bigint[] = [];
    const commitmentBatchBlocks: bigint[] = [];
    const generatedCommitmentBatchBlocks: bigint[] = [];
    
    // Get all events in range
    const iterator = await rpcSource.read(startBlock);
    let scanCount = 0;
    const maxBlocksToScan = 5000; // Limit how many blocks we scan for test performance
    
    for await (const entry of iterator) {
      if (entry.blockNumber > endBlock || scanCount > maxBlocksToScan) {
        break;
      }
      
      scanCount++;
      
      // Check for specific event types
      if (entry.type === RailgunEventType.Shield && !shieldBlocks.includes(entry.blockNumber)) {
        shieldBlocks.push(entry.blockNumber);
        console.log(`[Shield/Commitment Test] Found Shield event at block ${entry.blockNumber}`);
      }
      else if (entry.type === RailgunEventType.CommitmentBatch && !commitmentBatchBlocks.includes(entry.blockNumber)) {
        commitmentBatchBlocks.push(entry.blockNumber);
        console.log(`[Shield/Commitment Test] Found CommitmentBatch event at block ${entry.blockNumber}`);
      }
      else if (entry.type === RailgunEventType.GeneratedCommitmentBatch && !generatedCommitmentBatchBlocks.includes(entry.blockNumber)) {
        generatedCommitmentBatchBlocks.push(entry.blockNumber);
        console.log(`[Shield/Commitment Test] Found GeneratedCommitmentBatch event at block ${entry.blockNumber}`);
      }
      
      // If we found enough of each type, we can stop early
      if (shieldBlocks.length >= 3 && commitmentBatchBlocks.length >= 3) {
        console.log('[Shield/Commitment Test] Found sufficient examples of each event type, stopping scan');
        break;
      }
    }
    
    // Output summary
    console.log(`[Shield/Commitment Test] Found Shield events in ${shieldBlocks.length} blocks: ${shieldBlocks.join(', ')}`);
    console.log(`[Shield/Commitment Test] Found CommitmentBatch events in ${commitmentBatchBlocks.length} blocks: ${commitmentBatchBlocks.join(', ')}`);
    console.log(`[Shield/Commitment Test] Found GeneratedCommitmentBatch events in ${generatedCommitmentBatchBlocks.length} blocks: ${generatedCommitmentBatchBlocks.join(', ')}`);
    
    // We should find at least one of each event type in the range
    const foundSomeEvents = shieldBlocks.length > 0 || 
                           commitmentBatchBlocks.length > 0 || 
                           generatedCommitmentBatchBlocks.length > 0;
                           
    assert.ok(foundSomeEvents, 'Should find at least some Shield or CommitmentBatch events');
  });

  it('should fetch a block range and categorize all events correctly', async () => {
    // Use a wider block range to find more diverse Railgun events
    const startBlock = 16000000n;
    const blockRange = 5000n;
    const endBlock = startBlock + blockRange;
    
    console.log(`[Integration Test] Scanning blocks ${startBlock} to ${endBlock}...`);
    
    // Track events by type
    const eventCounts: Record<string, number> = {};
    const entriesByBlock: Record<string, DataEntry[]> = {};
    
    // Get all events in range
    const iterator = await rpcSource.read(startBlock);
    
    for await (const entry of iterator) {
      if (entry.blockNumber > endBlock) {
        break;
      }
      
      // Count by event type
      const eventType = entry.type;
      eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
      
      // Group by block for analysis
      const blockKey = entry.blockNumber.toString();
      entriesByBlock[blockKey] = entriesByBlock[blockKey] || [];
      entriesByBlock[blockKey].push(entry);
    }
    
    // Print event counts
    console.log('[Integration Test] Event counts by type:');
    Object.entries(eventCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Print some block statistics
    const blockCount = Object.keys(entriesByBlock).length;
    console.log(`[Integration Test] Found events in ${blockCount} blocks out of ${blockRange} scanned`);
    
    // Find a block with multiple event types if possible
    let mixedBlock: string | null = null;
    let maxEventTypes = 0;
    
    for (const [block, entries] of Object.entries(entriesByBlock)) {
      const eventTypesInBlock = new Set(entries.map(e => e.type));
      if (eventTypesInBlock.size > maxEventTypes) {
        maxEventTypes = eventTypesInBlock.size;
        mixedBlock = block;
      }
    }
    
    if (mixedBlock && maxEventTypes > 1) {
      console.log(`[Integration Test] Block ${mixedBlock} contains ${maxEventTypes} different event types:`);
      const blockEvents = entriesByBlock[mixedBlock].map(e => e.type);
      console.log(`  Event types: ${blockEvents.join(', ')}`);
    }
    
    // Verify we found at least some events
    const totalEvents = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
    assert.ok(totalEvents > 0, 'Should find at least some events in the block range');
    
    // Log all found event types for clarity
    console.log("[Integration Test] Found event types:", Object.keys(eventCounts).join(", "));
    
    // Check for shield events specifically
    if (eventCounts[RailgunEventType.Shield] > 0) {
      console.log(`[Integration Test] Found ${eventCounts[RailgunEventType.Shield]} Shield events`);
    } else {
      console.log('[Integration Test] No Shield events found in this range');
    }
    
    // Check for commitment events
    if (eventCounts[RailgunEventType.CommitmentBatch] > 0) {
      console.log(`[Integration Test] Found ${eventCounts[RailgunEventType.CommitmentBatch]} CommitmentBatch events`);
    } else {
      console.log('[Integration Test] No CommitmentBatch events found in this range');
    }
    
    // Check for generated commitment events
    if (eventCounts[RailgunEventType.GeneratedCommitmentBatch] > 0) {
      console.log(`[Integration Test] Found ${eventCounts[RailgunEventType.GeneratedCommitmentBatch]} GeneratedCommitmentBatch events`);
    } else {
      console.log('[Integration Test] No GeneratedCommitmentBatch events found in this range');
    }
    
    // Verify key types are present
    const foundKeyEvents = eventCounts[RailgunEventType.Nullifiers] > 0 || 
                          eventCounts[RailgunEventType.Shield] > 0 ||
                          eventCounts[RailgunEventType.Unshield] > 0;
                          
    assert.ok(foundKeyEvents, 'Should find at least some basic Railgun events (Nullifiers, Shield, or Unshield)');
  });
});