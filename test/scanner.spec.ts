import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RailgunScanner, V1_EVENTS } from '../src/scanner';
import { ByteUtils } from '../src/utils/bytes';

const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

describe('RailgunScanner', () => {
  it('should initialize with v1 values', () => {
    const v1Scanner = new RailgunScanner({
      networkName: 'ethereum',
      providerUrl: alchemyURL,
      version: 'v1'
    });
    
    assert.ok(v1Scanner, 'Scanner should be initialized');
    // do public methods for getting netwokr name and check for v1 abi ettc etc
  });

  it('Should fetch events from v1', async () => {

    const v1Scanner = new RailgunScanner({
      networkName: 'ethereum',
      providerUrl: alchemyURL,
      version: 'v1'
    });
    
    const fromBlock = 14737691;
    const toBlock = 15500000;   
    
    for (const eventType of Object.values(V1_EVENTS)) {
      try {
        console.log(`\nFetching logs for event: ${eventType}`);
        const startTime = Date.now();
        
        const logs = await v1Scanner.getLogsForEvent(
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
