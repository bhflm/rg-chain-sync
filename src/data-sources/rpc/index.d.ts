import { RailgunScanner } from "../../services/scanner";
import { DataSource } from "../../types/datasource";
import { DataEntry, RailgunEventType } from "../../types/data-entry";
export declare class RpcSource implements DataSource {
    private scanner;
    private currentAbi;
    private version;
    private batchSize;
    private blockTimeCache;
    head: bigint;
    syncing: boolean;
    constructor(scannerConfig: ConstructorParameters<typeof RailgunScanner>[0]);
    private updateHead;
    private getBlockTimestamp;
    read(height: bigint, eventTypes?: RailgunEventType[]): Promise<AsyncIterableIterator<DataEntry>>;
    destroy(error?: Error): void;
}
