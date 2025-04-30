# RAILGUN Chain Sync

A modular data retrieval and processing system for RAILGUN events across various blockchain networks. This library provides a unified approach to fetching and aggregating RAILGUN-related events from multiple data sources.

![Architecture Diagram](diagram.png)

## Overview

RAILGUN Chain Sync solves the challenge of efficiently retrieving and processing RAILGUN event data from blockchains. It provides:

- **Source-Agnostic Data Retrieval**: Standardized access to data from RPC nodes, Subsquid indexers, and other sources
- **Unified Data Format**: Common representation of all RAILGUN event types
- **Efficient Processing**: Asynchronous iterators for seamless consumption of ordered event streams
- **Flexible Aggregation**: Combine data from multiple sources with smart prioritization and deduplication

## Key Components

### Data Sources

The library implements multiple data sources through a common interface:

- **RPC Source**: Connects directly to blockchain nodes for real-time data
- **Subsquid Source**: Retrieves comprehensive indexed data from Subsquid
- **Aggregated Source**: Combines multiple sources with smart prioritization

Each source exposes a consistent async iterator interface, allowing consumers to process events in chronological order.

### Event Types

The system handles all RAILGUN event types:

- Nullifiers
- Commitments (Shield, Transact, CommitmentBatch, GeneratedCommitmentBatch)
- Unshields

### Data Flow

1. **Data Sources** connect to their respective endpoints and retrieve raw event data
2. **Adapters** transform source-specific data into standardized `DataEntry` objects
3. **Consumers** process these entries through async iterators
4. **Aggregator** combines entries from multiple sources with deduplication

## Architecture

### The `DataSource` Interface

Each data source implements:

- `head: bigint`: Latest known block number
- `syncing: boolean`: Source update status
- `read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>>`: Core event retrieval method
- `destroy()`: Cleanup method

### The `DataEntry` Type

Standardized event representation with:

- Common metadata: `source`, `blockNumber`, `transactionHash`, `logIndex`, `blockTimestamp`
- `type`: Event type identifier
- `payload`: Event-specific data (nullifiers, commitments, etc.)

### Adapters

Translator layer that converts source-specific data formats into the standardized `DataEntry` format, handling:

- Type conversion
- Data normalization
- Format standardization

## The Aggregated Source: Core of RAILGUN Chain Sync

The `AggregatedSource` is the centerpiece of this library, designed to provide a unified, seamless approach to blockchain data retrieval. By combining multiple data sources, it delivers:

1. **Optimal Data Quality**: Prioritizes sources to get the most complete data (e.g., Subsquid provides railgunTxid data that RPC doesn't)
2. **Continuous Syncing**: Uses faster RPC for recent blocks while falling back to more complete indexed data for historical blocks
3. **Smart Deduplication**: Automatically removes duplicate events when the same data is available from multiple sources
4. **Unified Chronological Stream**: All events are properly ordered by block number and log index

### Usage Example

```typescript
import {
  AggregatedSource,
  RpcSource,
  SubsquidSource,
  RailgunEventType
} from 'chain-sync';
import { NetworkName } from './config/network-config';

// Initialize the necessary data sources
// Each source has its strengths and limitations
const rpcSource = new RpcSource({
  networkName: NetworkName.Ethereum,
  providerUrl: 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
  version: 'v2',
  batchSize: 100
});

const subsquidSource = new SubsquidSource({
  network: 'ethereum',
  batchSize: 100
});

// Create the aggregated source
// Source order defines priority - first source gets priority for duplicate events
const aggregatedSource = new AggregatedSource({
  sources: [subsquidSource, rpcSource], // Subsquid preferred for its complete data
  deduplicate: true                     // Remove duplicates based on transactionHash+logIndex
});

// Start reading events from a specific block
const startBlock = 14000000n;
const iterator = await aggregatedSource.read(startBlock);

// Process the unified stream of events in chronological order
for await (const entry of iterator) {
  // Each entry is a standardized DataEntry object, regardless of its original source
  console.log(`Block ${entry.blockNumber}, Event: ${entry.type}, Source: ${entry.source}`);

  // The aggregator automatically provides the most complete data available
  // For example, Subsquid entries will include railgunTxid when available
  if (entry.railgunTxid) {
    console.log(`RAILGUN Transaction ID: ${entry.railgunTxid}`);
  }

  // Process events by their type
  switch (entry.type) {
    case RailgunEventType.Nullifiers:
      // Process nullifiers
      console.log(`Nullifiers: ${entry.payload.nullifiers.join(', ')}`);
      break;

    case RailgunEventType.Shield:
      // Process shield events
      const shieldAmount = entry.payload.commitments[0]?.preimage?.value;
      const tokenAddress = entry.payload.commitments[0]?.preimage?.token.tokenAddress;
      console.log(`Shield: ${shieldAmount} of token ${tokenAddress}`);
      break;

    case RailgunEventType.Unshield:
      // Process unshield events
      console.log(`Unshield: ${entry.payload.amount} to ${entry.payload.to}`);
      break;
  }

  // Optionally limit the range of blocks to process
  if (entry.blockNumber > 14010000n) {
    break;
  }
}

// Clean up when done
aggregatedSource.destroy();
```
