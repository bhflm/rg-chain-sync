import { 
  createPublicClient, 
  http, 
  type PublicClient, 
  type Log, 
  type Address,
  type AbiEvent,   
  parseEventLogs,
  type ParseEventLogsReturnType
} from 'viem';
import {
  V1_EVENTS_ABI,
  V1_EVENTS,
  V1EventType,
  V2_EVENTS_ABI,
  V2_LEGACY_EVENTS_ABI,
  V2_EVENTS,
  V2EventType,
  RailgunAbi, 
  RAILGUN_ABI,
} from '../abi';

import { 
  NetworkName, 
  RailgunProxyContract, 
  RailgunProxyDeploymentBlock,
  NetworkToViemChain,
  getNetworkName
} from '../config/network-config';


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
  currentAbi?: RailgunAbi;
};

export interface ScanResult<T> {
  logs: T[];
  fromBlock: bigint;
  toBlock: bigint;
  nextBlock: bigint;
}

export class RailgunScanner {
  private client: PublicClient;
  private batchSize: number;
  private scanRetryCount: number;
  private startBlock: number;
  private contractAddress: Address;
  private version: ScannerVersion;
  private networkName: NetworkName;
  private currentAbi?: RailgunAbi; // TODO: Refactor this make it no optional

  constructor(
    private config: ScannerConfig,
  ) {
    console.log('STARTING NEW SCANNER: ', config);
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

    switch (this.version) {
      case 'v1':
          this.currentAbi = RAILGUN_ABI.V1_RAILGUN_LOGIC;
          break;
      case 'v2':
          this.currentAbi = RAILGUN_ABI.V2_RAILGUN_SMART_WALLET;
          break;
      case 'v2-legacy':
        this.currentAbi = RAILGUN_ABI.V2_RAILGUN_SMART_WALLET_LEGACY;
          break;
      default:
          throw new Error(`Unknown scanner version: ${this.version}`);
    }
  }

  public async getLatestBlockNumber(): Promise<bigint> {
    const block = await this.client.getBlockNumber();
    return block;
  }

  public getContractAddress() {
    return this.contractAddress;
  };

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

  
   /**
   * Get and parse logs for a specific event type within a block range using viem's parseEventLogs.
   * This fetches *all* logs for the contract in the range and then filters/parses them client-side.
   *
   * @param eventType The name of the event to get logs for.
   * @param fromBlock The starting block number (inclusive).
   * @param toBlock The ending block number (inclusive).
   * @param strict Optional: Whether to enforce strict decoding (defaults to true).
   * @returns A promise that resolves to an array of parsed logs conforming to the ABI.
   * 
   * 
   * this offers convenience by handling the parsing but comes at the cost of fetching potentially much 
   * larger amounts of data and performing parsing client-side.
   * it's a trade-off between RPC/network efficiency and parsing convenience/client-side load.
   * 
   */
   public async getLogsWithParse<T extends EventType>(
    eventType: T,
    fromBlock: bigint,
    toBlock: bigint,
    strict: boolean = true,
): Promise<ParseEventLogsReturnType<RailgunAbi, T>> { // Use the determined ABI type
    
    const rawLogs: Log[] = await this.client.getLogs({
        address: this.contractAddress,
        fromBlock,
        toBlock,
    });

    if (rawLogs.length === 0) {
        return [] as ParseEventLogsReturnType<RailgunAbi, T>;
    }

    const parsedLogs = parseEventLogs({
        abi: this.currentAbi!, // Ensure the ABI is defined before using it
        logs: rawLogs,
        eventName: eventType, // Filter by the specific event name
        strict: strict,
    });
    return parsedLogs;
}


  /**
   * Scan for events of a specific type and process them with a formatter function
   * 
   * @param eventType The type of event to scan for
   * @param fromBlock The starting block number
   * @param formatter Function to format each log
   * @param maxBlocks Optional maximum number of blocks to scan
   * @returns The scan result with processed logs
   */
  public async scanForEvents<T>(
    eventType: EventType,
    fromBlock: bigint,
    formatter: (log: Log) => T,
    maxBlocks?: number
  ): Promise<ScanResult<T>> {
    
    console.log('Running scan for events..');
    
    const latestBlock = await this.getLatestBlockNumber();
    
    const maxBatchSize = maxBlocks ? maxBlocks : this.batchSize;
    const toBlock = fromBlock + BigInt(maxBatchSize) > latestBlock
      ? latestBlock
      : fromBlock + BigInt(maxBatchSize - 1);

    if (fromBlock > latestBlock) {
      return {
        logs: [],
        fromBlock,
        toBlock: fromBlock,
        nextBlock: fromBlock
      };
    }

    // Get logs for this batch
    const logs = await this.getLogsForEvent(eventType, fromBlock, toBlock);
    
    console.log('LOGS BATCH: ', logs);

    const processedLogs = logs.map(log => formatter(log));
    
    console.log('PROCESSED LOGS: ', processedLogs);


    const nextBlock = toBlock + 1n;
    
    return {
      logs: processedLogs,
      fromBlock,
      toBlock,
      nextBlock
    };
  }

  /**
   * Scan for multiple event types in a single batch
   * 
   * @param eventTypes Map of event types to their formatters
   * @param fromBlock Starting block number
   * @param maxBlocks Optional maximum number of blocks to scan
   * @returns Combined scan results for all event types
   */
  public async scanForMultipleEvents<T>(
    eventTypes: { [key: string]: { eventType: EventType, formatter: (log: Log) => T } },
    fromBlock: bigint,
    maxBlocks?: number
  ): Promise<{ [key: string]: ScanResult<T> }> {
    const latestBlock = await this.getLatestBlockNumber();
    
    const maxBatchSize = maxBlocks ? maxBlocks : this.batchSize;
    const toBlock = fromBlock + BigInt(maxBatchSize) > latestBlock
      ? latestBlock
      : fromBlock + BigInt(maxBatchSize - 1);

    if (fromBlock > latestBlock) {
      const emptyResults: { [key: string]: ScanResult<T> } = {};
      for (const key of Object.keys(eventTypes)) {
        emptyResults[key] = {
          logs: [],
          fromBlock,
          toBlock: fromBlock,
          nextBlock: fromBlock
        };
      }
      return emptyResults;
    }

    const scanPromises = Object.entries(eventTypes).map(async ([key, { eventType, formatter }]) => {
      try {
        const logs = await this.getLogsForEvent(eventType, fromBlock, toBlock);
        return [key, {
          logs: logs.map(log => formatter(log)),
          fromBlock,
          toBlock,
          nextBlock: toBlock + 1n
        }];
      } catch (error) {
        console.error(`Error scanning for ${key}:`, error);
        return [key, {
          logs: [],
          fromBlock,
          toBlock,
          nextBlock: toBlock + 1n,
          error
        }];
      }
    });

    const results = await Promise.all(scanPromises);
    const combinedResults: { [key: string]: ScanResult<T> } = {};
    
    for (const [key, result] of results) {
      combinedResults[key as string] = result as ScanResult<T>;
    }
    
    return combinedResults;
  }
};