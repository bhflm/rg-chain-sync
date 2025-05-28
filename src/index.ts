export { RpcSource } from "./data-sources/rpc/index";
export { SubsquidSource } from "./data-sources/subsquid/index";
export { AggregatedSource } from "./data-aggregator/aggregator";

export {
  RailgunScanner,
  type ScannerConfig,
  type ScannerVersion,
  type EventType
} from './services/scanner';

// Export specific types that consumers might need
export { 
  NetworkName, 
  RailgunProxyDeploymentBlock,
  getNetworkName
} from './config/network-config';

export {
  RailgunEventType,
  type DataEntry,
  // Type guards
  isCommitmentBatchEntry,
  isNullifiersEntry,
  isUnshieldEntry,
  isShieldEntry,
  isTransactEntry,
  isGeneratedCommitmentBatchEntry
} from './types/data-entry';

// Export all other types
export * from './types';
