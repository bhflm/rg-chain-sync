import { type Log, type Address, type ParseEventLogsReturnType } from 'viem';
import { V1_EVENTS, V1EventType, V2_EVENTS, V2EventType, RailgunAbi } from '../abi';
import { NetworkName } from '../config/network-config';
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
    contractAddress?: Address;
    currentAbi?: RailgunAbi;
}
export interface ScanResult<T> {
    logs: T[];
    fromBlock: bigint;
    toBlock: bigint;
    nextBlock: bigint;
}
export declare class RailgunScanner {
    private config;
    private client;
    private batchSize;
    private scanRetryCount;
    private startBlock;
    private contractAddress;
    private version;
    private networkName;
    private currentAbi?;
    constructor(config: ScannerConfig);
    getLatestBlockNumber(): Promise<bigint>;
    getContractAddress(): `0x${string}`;
    /**
    * Get logs for a specific event type within a block range
    */
    getLogsForEvent(eventType: EventType, fromBlock: bigint, toBlock: bigint): Promise<Log[]>;
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
    getLogsWithParse<T extends EventType>(eventType: T, fromBlock: bigint, toBlock: bigint, strict?: boolean): Promise<ParseEventLogsReturnType<RailgunAbi, T>>;
    /**
     * Scan for events of a specific type and process them with a formatter function
     *
     * @param eventType The type of event to scan for
     * @param fromBlock The starting block number
     * @param formatter Function to format each log
     * @param maxBlocks Optional maximum number of blocks to scan
     * @returns The scan result with processed logs
     */
    scanForEvents<T>(eventType: EventType, fromBlock: bigint, formatter: (log: Log) => T, maxBlocks?: number): Promise<ScanResult<T>>;
    /**
     * Scan for multiple event types in a single batch
     *
     * @param eventTypes Map of event types to their formatters
     * @param fromBlock Starting block number
     * @param maxBlocks Optional maximum number of blocks to scan
     * @returns Combined scan results for all event types
     */
    scanForMultipleEvents<T>(eventTypes: {
        [key: string]: {
            eventType: EventType;
            formatter: (log: Log) => T;
        };
    }, fromBlock: bigint, maxBlocks?: number): Promise<{
        [key: string]: ScanResult<T>;
    }>;
}
