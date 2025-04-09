import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { RailgunScanner, V1_EVENTS } from '../src/scanner';
import { mainnet } from 'viem/chains';
import { CommitmentEvent, Nullifier } from '../src/types/events';
import { createPublicClient } from 'viem';
import { ByteUtils } from '../src/utils/bytes';

const V1_PROXY_ADDRESS = '0xfa7093cdd9ee6932b4eb2c9e1cde7ce00b1fa4b9';
const API_KEY = process.env.API_KEY;
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe('RailgunScanner', () => {
  it('should initialize with default values', () => {
    const scanner = new RailgunScanner({
      chain: mainnet,
      providerUrl: alchemyURL,
      contractAddress: V1_PROXY_ADDRESS,
      startBlock : 14737691,
    });
    
    assert.ok(scanner, 'Scanner should be initialized');
  });
  
  it('should fetch event logs', async () => {
    const scanner = new RailgunScanner({
      chain: mainnet,
      providerUrl: alchemyURL,
      contractAddress: V1_PROXY_ADDRESS,
      startBlock : 14737691,
    });
    
    const fromBlock = 14737691;
    const toBlock = 14738000;
    
    const logs = await scanner.getLogsForEvent(
      V1_EVENTS.COMMITMENT_BATCH,
      BigInt(fromBlock),
      BigInt(toBlock)
    );
    
    console.log(`Found ${logs.length} CommitmentBatch logs`);
    assert.ok(logs !== undefined, 'Logs should be defined');
    
    const nullifierLogs = await scanner.getLogsForEvent(
      V1_EVENTS.NULLIFIERS,
      BigInt(fromBlock),
      BigInt(toBlock)
    );
    
    console.log(`Found ${nullifierLogs.length} Nullifiers logs`);
    assert.ok(nullifierLogs !== undefined, 'Nullifier logs should be defined');
  });

  it('Should fetch events from a wide block range with the proxy contract', async () => {
    const scanner = new RailgunScanner({
      chain: mainnet,
      providerUrl: alchemyURL,
      contractAddress: V1_PROXY_ADDRESS,
      startBlock: 14737691,
    });
    
    // Wide range scanning - try a full year's worth of blocks
    const fromBlock = 14737691;
    const toBlock = 15500000;   
    
    for (const eventType of Object.values(V1_EVENTS)) {
      try {
        console.log(`\nFetching logs for event: ${eventType}`);
        const startTime = Date.now();
        
        const logs = await scanner.getLogsForEvent(
          eventType,
          BigInt(fromBlock),
          BigInt(toBlock)
        );
        
        const duration = Date.now() - startTime;
        console.log(`Found ${logs.length} logs for ${eventType} in ${duration/1000} seconds`);
        
        if (logs.length > 0) {
          const blockNumbers = [...new Set(logs.map(log => Number(log.blockNumber)))].sort();
          console.log(`Events found in blocks: ${blockNumbers.slice(0, 5).join(', ')}${blockNumbers.length > 5 ? '...' : ''}`);
          
          console.log(`First log:`, JSON.stringify(logs[0], ByteUtils.bigIntSerializer, 2));
        }
        
        assert.ok(logs !== undefined, `${eventType} logs should be defined`);
      } catch (error) {
        console.error(`Error fetching ${eventType} logs:`, error);
        throw error;
      }
    }
  });
});