import { DataSource } from "../types/datasource";
import { DataEntry, RailgunEventType } from "../types/data-entry";
export declare class AggregatedSource implements DataSource {
    private sources;
    constructor(sources: DataSource[]);
    /**
     * The highest block number known across all underlying sources.
     */
    get head(): bigint;
    /**
     * True if any underlying source is still syncing.
     */
    get syncing(): boolean;
    /**
      * Reads data by merging underlying sources chronologically.
      * @param height The block number to start reading from.
      * @param eventTypes Optional filter for specific event types (passed to underlying sources).
    *
    * Ok some notes on why is AsyncIterableIterator rather than the other:
    * It just did not work with AsyncIterator, perhaps need to revisit, but did some findings and
    * from source asyncIterableIterator implements both AsyncIterator<T> and AsyncIterable<T>.
    * can be used directly in a for await...of loop, and also can call .next() if needed
    * i just find not calling .next() better???? no se
    * https://developer.mozilla.org/en-US/search?q=AsyncIterableIterator
    *
    
    */
    read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>>;
    destroy(error?: Error): void;
}
