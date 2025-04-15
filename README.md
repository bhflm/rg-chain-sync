# RAILGUN Chain Sync

// I did ask gemini to do a readme about current status of things and this is what it came up with lol

## The Problem We're Solving

ELI5 VIBE CODED README 

*   **RAILGUN data is sparse:** Scanning every single block on Ethereum/Polygon/etc. just for RAILGUN stuff is not efficient at all. Most blocks are empty for us.
*   **Different Data Sources, Different Quirks:**
    *   **RPC Nodes:** Fast for *latest* blocks, but often limited (rate limits, batch sizes). Getting details like internal transactions (needed for full RAILGUN TXIDs) is hard or impossible without special (expensive) calls. Gives us basic, trustless data if you trust the node.
    *   **Subsquid Indexer:**  Gives us *everything*, including internal transactions and pre-calculated RAILGUN TXIDs. But, it runs a bit behind the absolute chain tip (to avoid reorg headaches)
    *   **Snapshots:** data dump (like a file or database). Super fast for catching up on old history, but obviously static – doesn't update in real-time.

## The Approach: Iterators and Aggregation

We treat each data source like an async conveyor belt carrying boxes of data

### 1. The `DataSource` Interface (`src/types/datasource.ts`)

blueprint for every data source. It promises to provide:

*   `head: bigint`: The latest block number this source knows about.
*   `syncing: boolean`: Is this source still trying to get new data? (Snapshots are `false`, RPC/Subsquid are usually `true`).
*   `read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>>`: This is the core! It gives you an async iterator (usable with `for await...of`) that yields standardized `DataEntry` objects starting from the requested `height`. You can optionally ask for specific `eventTypes`.
*   `destroy()`: Cleans things up.

### 2. The `DataEntry` Type (`src/types/data-entry.ts`)

This is the **standardized box** that all sources put their data into before yielding it. It ensures consistency.

*   **Common Info:** `source`, `blockNumber`, `transactionHash`, `logIndex` (maybe -1 if unknown), `blockTimestamp`, `completeness` (BASIC/COMPLETE/VERIFIED), `railgunTxid` (optional).
*   **`type`:** Tells you *what kind* of event this is (e.g., `RailgunEventType.Nullifiers`, `RailgunEventType.CommitmentBatch`).
*   **`payload`:** Contains the data *specific* to that event type (e.g., the actual nullifier hex string, commitment details).

### 3. Concrete Sources (`src/datasources/rpc.ts`, `src/datasources/subsquid.ts`)

*   **`RpcSource`:** Implements `DataSource`. Uses `RailgunScanner` -> `viem` -> RPC Node. Fetches logs, parses them, gets block timestamps. Uses **RPC Adapters** to convert parsed logs into `DataEntry`. Marks completeness as `BASIC`.
*   **`SubsquidSource`:** Implements `DataSource`. Uses `@railgun-reloaded/subsquid-client` -> Subsquid GraphQL API. Gets structured data back. Uses **Subsquid Adapters** to convert GraphQL results into `DataEntry`. Marks completeness as `COMPLETE`.

*(A `SnapshotSource` would be implemented similarly).*

### 4. Adapters (`src/adapters/`)

These are the crucial translators. They take the raw/parsed data *specific* to a source (Viem Log, Subsquid JSON) and convert it into the standard `DataEntry` format. This is where we handle differences like V1 `bigint` nullifiers vs V2 `bytes32` hex strings.

### 5. The `AggregatedSource` (`src/datasources/aggregated.ts`)

*   Takes an **ordered list** of `DataSource` instances (e.g., `[subsquidSource, rpcSourceV1]`). Order = Priority.
*   Its `read()` method starts iterators for all underlying sources *concurrently*.
*   It keeps track of the next available item from each source.
*   In a loop, it finds the chronologically *earliest* item across all sources (checking block, then log index, then source priority).
*   It **deduplicates** based on `txHash` and `logIndex`.
*   It yields the winning item and fetches the *next* item only from the source it just yielded from.
*   The result is a single, ordered, deduplicated stream of `DataEntry` items, giving you the best available data from your configured sources.

## TODO

1.  **Implement More Adapters:** Create adapters for *all* relevant event types (Commitments, Shields, Unshields, Transacts) for both RPC and Subsquid sources. Ensure they correctly produce the `DataEntry` format.
2.  **Enhance Source `read` Methods:** Make `RpcSource.read` and `SubsquidSource.read` dynamically build queries based on the requested `eventTypes` filter (instead of just nullifiers or everything). Handle fetching and adapting multiple types concurrently if efficient.
3.  **Refine AggregatedSource:** Thoroughly test deduplication and priority handling, especially with events that might exist in both sources but have slightly different `completeness` or `logIndex` details. Consider edge cases and performance.
4.  **Implement `SnapshotSource`**.
5.  **Reorg Handling:** Add logic (likely in `AggregatedSource` or a layer above) to detect and handle chain reorganizations. This might involve buffering recent blocks and checking for hash mismatches.
6.  **Verification:** Implement the on-chain Merkle root verification step against yielded `DataEntry` items (especially those with `completeness: COMPLETE`).
7.  **Caching:** Add more robust caching layers where appropriate (e.g., block timestamps in `RpcSource`, maybe recent results in `AggregatedSource`).
8.  **Transaction Builder:** Build the higher-level service to consume the `AggregatedSource` stream and reconstruct full RAILGUN transactions (grouping related shields/unshields/nullifiers potentially using `railgunTxid` when available from sources like Subsquid).