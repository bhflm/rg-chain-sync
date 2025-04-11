import { createPublicClient, http, type PublicClient, type Log, type Address, type Chain, type AbiEvent } from 'viem';
import {
  V1_EVENTS_ABI,
  V1_EVENTS,
  V1EventType,
} from './abi/v1/events';
import {
  V2_EVENTS_ABI,
  V2_LEGACY_EVENTS_ABI,
  V2_EVENTS,
  V2EventType,
} from './abi/v2/events';
import { 
  NetworkName, 
  RailgunProxyContract, 
  RailgunProxyDeploymentBlock,
  NetworkToViemChain,
  getNetworkName
} from './config/network-config';

export { V1_EVENTS, V2_EVENTS };

export type EventType = V1EventType | V2EventType;

export type ScannerVersion = 'v1' | 'v2' | 'v2-legacy';

export interface ScannerConfig {
  networkName: string | NetworkName;
  providerUrl: string;
  batchSize?: number;
  startBlock?: number;
  scanRetryCount?: number;
  version: ScannerVersion;
  contractAddress?: Address; // define if this needed, perhaps for extending to new chains ??, tho should refactor more in depth given that case
};

export class RailgunScanner {
  private client: PublicClient;
  private batchSize: number;
  private scanRetryCount: number;
  private startBlock: number;
  private contractAddress: Address;
  private version: ScannerVersion;
  private networkName: NetworkName;

  constructor(
    private config: ScannerConfig,
  ) {
    this.networkName = getNetworkName(config.networkName);
    
    
    const viemChain = NetworkToViemChain[this.networkName];
    if (!viemChain) {
      throw new Error(`Unsupported network: ${this.networkName}`);
    }

    // leave room for custom contract ???? 
    this.contractAddress = (config.contractAddress || 
      RailgunProxyContract[this.networkName]) as Address;

    // start block we already have on network cfg from shared models, no point on letting room for going before that ?? idc
    this.startBlock = config.startBlock !== undefined ? 
      config.startBlock : 
      RailgunProxyDeploymentBlock[this.networkName];

    this.client = createPublicClient({
      chain: viemChain,
      transport: http(config.providerUrl),
    });

    this.batchSize = config.batchSize ?? 1000;
    this.scanRetryCount = config.scanRetryCount ?? 3;
    this.version = config.version;
  }

  /**
  * Get logs for a specific event type within a block range
  */
  public async getLogsForEvent(
    eventType: EventType,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Log[]> {
    
    let event: AbiEvent | undefined;
    
    if (this.version === 'v1') {
      event = V1_EVENTS_ABI[eventType];
    } else if (this.version === 'v2') {
      event = V2_EVENTS_ABI[eventType];
    } else if (this.version === 'v2-legacy') {
      event = V2_LEGACY_EVENTS_ABI[eventType];
    }

    if (!event) {
      throw new Error(`Unknown event type ${eventType} for version ${this.version}`);
    }

    const logs = await this.client.getLogs({
      address: this.contractAddress,
      event: event,
      fromBlock,
      toBlock,
    });

    return logs;
  }
};