import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RailgunScanner, V1_EVENTS, V2_EVENTS } from '../src/scanner';
import { ByteUtils } from '../src/utils/bytes';

const API_KEY = process.env.API_KEY
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe('RailgunScanner', () => {
  describe('V1 Scanner Tests', () => {
    it('should initialize with v1 values', () => {
      const v1Scanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v1'
      });
      
      assert.ok(v1Scanner, 'Scanner should be initialized');
    });

    it('Should fetch events from v1', async () => {
      const v1Scanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v1'
      });
      
      // Use a small block range for quicker tests
      const fromBlock = 14737691;
      const toBlock = 14739000;   
      
      // Test just one event type to avoid long test runs
      const eventType = V1_EVENTS.COMMITMENT_BATCH;
      try {
        console.log(`\nFetching logs for V1 event: ${eventType}`);
        const logs = await v1Scanner.getLogsForEvent(
          eventType,
          BigInt(fromBlock),
          BigInt(toBlock)
        );
        
        console.log(`Found ${logs.length} logs for ${eventType}`);
        
        if (logs.length > 0) {
          const blockNumbers = [...new Set(logs.map(log => Number(log.blockNumber)))].sort();
          console.log(`Events found in blocks: ${blockNumbers.slice(0, 5).join(', ')}${blockNumbers.length > 5 ? '...' : ''}`);
        }
        
        assert.ok(logs !== undefined, `${eventType} logs should be defined`);
      } catch (error) {
        console.error(`Error fetching ${eventType} logs:`, error);
        throw error;
      }
    });
  });

  describe('V2 Scanner Tests', () => {
    it('should initialize with v2 values', () => {
      const v2Scanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v2'
      });
      
      assert.ok(v2Scanner, 'Scanner should be initialized');
    });

    it('Should fetch events from v2', async () => {
      const v2Scanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v2'
      });
      
      const fromBlock = 15500000; 
      const toBlock = 16000000;
      
      const eventsToTest = [
        V2_EVENTS.COMMITMENT_BATCH,
        V2_EVENTS.NULLIFIERS
      ];
      
      for (const eventType of eventsToTest) {
        try {
          console.log(`\nFetching logs for V2 event: ${eventType}`);
          const logs = await v2Scanner.getLogsForEvent(
            eventType,
            BigInt(fromBlock),
            BigInt(toBlock)
          );
          
          console.log(`Found ${logs.length} logs for ${eventType}`);
          
          if (logs.length > 0) {
            const blockNumbers = [...new Set(logs.map(log => Number(log.blockNumber)))].sort();
            console.log(`Events found in blocks: ${blockNumbers.slice(0, 5).join(', ')}${blockNumbers.length > 5 ? '...' : ''}`);
          }
          
          assert.ok(logs !== undefined, `${eventType} logs should be defined`);
        } catch (error) {
          console.error(`Error fetching ${eventType} logs:`, error);
          throw error;
        }
      }
    });
  });

  describe('V2 Legacy Scanner Tests', () => {
    it('should initialize with v2-legacy values', () => {
      const v2LegacyScanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v2-legacy'
      });
      
      assert.ok(v2LegacyScanner, 'Scanner should be initialized');
    });

    it('Should fetch events from v2-legacy', async () => {
      const v2LegacyScanner = new RailgunScanner({
        networkName: 'ethereum',
        providerUrl: alchemyURL,
        version: 'v2-legacy'
      });
      
      // Pick appropriate block range for V2 legacy events
      const fromBlock = 15000000;
      const toBlock = 15500000;
      
      // Test just a few event types to avoid long test runs
      const eventsToTest = [
        V2_EVENTS.COMMITMENT_BATCH,
        V2_EVENTS.NULLIFIERS
      ];
      
      for (const eventType of eventsToTest) {
        try {
          console.log(`\nFetching logs for V2-legacy event: ${eventType}`);
          const logs = await v2LegacyScanner.getLogsForEvent(
            eventType,
            BigInt(fromBlock),
            BigInt(toBlock)
          );
          
          console.log(`Found ${logs.length} logs for ${eventType}`);
          
          if (logs.length > 0) {
            const blockNumbers = [...new Set(logs.map(log => Number(log.blockNumber)))].sort();
            console.log(`Events found in blocks: ${blockNumbers.slice(0, 5).join(', ')}${blockNumbers.length > 5 ? '...' : ''}`);
          }
          
          assert.ok(logs !== undefined, `${eventType} logs should be defined`);
        } catch (error) {
          console.error(`Error fetching ${eventType} logs:`, error);
          throw error;
        }
      }
    });
  });

  describe('scanner: scanForEvents', () => {
      
  });
});
