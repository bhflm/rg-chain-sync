import V1Events from './V1-railgun-logic.json';
import { type AbiEvent } from 'viem';
import { findEventInAbi } from '../../utils/events';

// Event names - these will be used as keys in the EVENTS_ABI
export const V1_EVENTS = {
  GENERATED_COMMITMENT_BATCH: 'GeneratedCommitmentBatch',
  COMMITMENT_BATCH: 'CommitmentBatch',
  NULLIFIERS: 'Nullifiers',
} as const;

// Get ABI for each event
const GENERATED_COMMITMENT_BATCH_EVENT = findEventInAbi(V1_EVENTS.GENERATED_COMMITMENT_BATCH, V1Events);
const COMMITMENT_BATCH_EVENT = findEventInAbi(V1_EVENTS.COMMITMENT_BATCH, V1Events);
const NULLIFIERS_EVENT = findEventInAbi(V1_EVENTS.NULLIFIERS, V1Events);

// Map event names to their ABI definitions
export const V1_EVENTS_ABI: Record<string, AbiEvent> = {
  [V1_EVENTS.GENERATED_COMMITMENT_BATCH]: GENERATED_COMMITMENT_BATCH_EVENT,
  [V1_EVENTS.COMMITMENT_BATCH]: COMMITMENT_BATCH_EVENT,
  [V1_EVENTS.NULLIFIERS]: NULLIFIERS_EVENT,
} as const;

export type V1EventType = typeof V1_EVENTS[keyof typeof V1_EVENTS];