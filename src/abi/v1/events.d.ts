import { type AbiEvent } from 'viem';
export declare const V1_EVENTS: {
    readonly GENERATED_COMMITMENT_BATCH: "GeneratedCommitmentBatch";
    readonly COMMITMENT_BATCH: "CommitmentBatch";
    readonly NULLIFIERS: "Nullifiers";
};
export declare const V1_EVENTS_ABI: Record<string, AbiEvent>;
export type V1EventType = typeof V1_EVENTS[keyof typeof V1_EVENTS];
