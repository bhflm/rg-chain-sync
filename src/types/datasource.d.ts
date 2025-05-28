import { DataEntry, RailgunEventType } from "./data-entry";
export interface Data {
    blockNumber: number;
    height: bigint;
    ethTxid: string;
    railgunTxid?: string;
    timestamp?: number;
}
export interface DataSource {
    /**
     * The most recent block that this source can provide.
     * For a snapshot, this would be the last event saved
     * For subsquid this would be the last block observed
     * For a live RPC provider this would be the last block processed
     * or the tip of the chain
     */
    head: bigint;
    /**
     * Is the source still ingesting data, ie can you expect it to update?
     * For a snapshot this would always be false
     * For subsquid and RPC this would be true as long as it could reasonably
     * fetch new data.
     * For polling this would probably always be true as a new attempt to fetch
     * further data can be made
     * For socket based communication the field could signal whether it is
     * connected or a connection needs to be established
     */
    syncing: boolean;
    /**
     * Start iterating from a given height.
     * Having this as a method allows multiple concurrent iterators over
     * the same source. If a source does not wish to allow concurrent iteration
     * it must manage the interleaving internally, eg only allowing one request
     * in-flight at a time
     * As an async iterator, it allows consumption both as `for await(const … of …)`
     * and higher-level primitives such as `ReadableStream`
     * The method itself is made `async` as a lowest-common-denominator if a source
     * needs to do any async initialisation logic.
     * Alternatively async initialisation logic can be pushed into the iterator,
     * which would allow this method to be sync
     */
    read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterator<DataEntry>>;
    /**
     * Destory the source and clean up resources.
     * This will immediately terminate any active iterators.
     * If an error is provided, this should be thrown from all active iterators.
     */
    destroy(error?: Error): void;
}
