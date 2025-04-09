import { createPublicClient, http, type PublicClient, type Log, type Address, type Chain, type AbiEvent } from 'viem';
import {
  GENERATED_COMMITMENT_BATCH_EVENT,
  COMMITMENT_BATCH_EVENT,
  NULLIFIERS_EVENT
} from './abi/events';
 
// Scanner Module
// - Primary responsibility: Query blockchain for Railgun related events
// - Key features:
//   - Connect to EVM providers
//   - Fetch blocks and logs with efficient filtering
//   - Handle provider failures and reconnections
//   - Support different scanning modes (historical, catchup, and real-time)

export const V1_EVENTS = {
  GENERATED_COMMITMENT_BATCH: 'GeneratedCommitmentBatch',
  COMMITMENT_BATCH: 'CommitmentBatch',
  NULLIFIERS: 'Nullifiers',
} as const;

export type V1EventType = typeof V1_EVENTS[keyof typeof V1_EVENTS];

interface ScannerConfig {
  chain: Chain;
  contractAddress: Address;
  providerUrl: string;
  batchSize?: number;
  startBlock?: number;
  scanRetryCount?: number;
};


export class RailgunScanner {
  private client: PublicClient;
  private chain: Chain;
  private batchSize: number;
  private scanRetryCount: number;
  private startBlock: number;
  private contractAddress: Address;

  constructor(
    private config: ScannerConfig,
  ) {
    this.client = createPublicClient({
      chain: config.chain,
      transport: http(config.providerUrl),
    });

    this.chain = config.chain;
    this.batchSize = config.batchSize ?? 1000;
    this.scanRetryCount = config.scanRetryCount ?? 3;
    this.startBlock = config.startBlock ?? 0;
    this.contractAddress = config.contractAddress as Address;
  }

   /**
     * Get logs for a specific event type within a block range
     */
   public async getLogsForEvent(
    eventType: V1EventType,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Log[]> {
    
    let event: AbiEvent;
    
    if (eventType === V1_EVENTS.GENERATED_COMMITMENT_BATCH) {
      event = GENERATED_COMMITMENT_BATCH_EVENT;
    } else if (eventType === V1_EVENTS.COMMITMENT_BATCH) {
      event = COMMITMENT_BATCH_EVENT;
    } else if (eventType === V1_EVENTS.NULLIFIERS) {
      event = NULLIFIERS_EVENT;
    } else {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    

    // @@ TODO: Implement try and catch with retry blocks, this just works as one call! with a given range of blocks
    const logs = await this.client.getLogs({
      address: this.contractAddress,
      event: event,
      fromBlock,
      toBlock,
    });

    return logs;
  }
};