import { DataEntry } from "../types/data-entry";
export declare function adaptParsedCommitmentBatch(log: any, // Keep 'any' for now, but assert inside
timestamp: number): DataEntry;
export declare function adaptParsedNullifiers(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry[];
export declare function adaptParsedUnshield(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry;
export declare function adaptParsedShield(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry;
export declare function adaptParsedGeneratedCommitmentBatch(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry;
export declare function adaptParsedNullified(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry[];
export declare function adaptParsedTransact(log: any, // Keep 'any' for now, assert inside
timestamp: number): DataEntry;
