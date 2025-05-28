import { type AbiEvent } from 'viem';
export declare const V2_EVENTS: {
    readonly NULLIFIERS: "Nullifiers";
    readonly NULLIFIED: "Nullified";
    readonly GENERATED_COMMITMENT_BATCH: "GeneratedCommitmentBatch";
    readonly COMMITMENT_BATCH: "CommitmentBatch";
    readonly SHIELD: "Shield";
    readonly UNSHIELD: "Unshield";
    readonly TRANSACT: "Transact";
};
export declare const V2_LEGACY_EVENTS_ABI: Record<string, AbiEvent>;
export declare const V2_EVENTS_ABI: Record<string, AbiEvent>;
export type V2EventType = typeof V2_EVENTS[keyof typeof V2_EVENTS];
