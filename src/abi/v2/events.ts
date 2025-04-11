import V2LegacySmartWallet from './V2-railgun-smart-wallet-legacy.json';
import V2RelayAdapt from './V2-relay-adapt.json'; // TODO: Figure out what we need from relay adapt ?? something at all ? ?
import V2SmartWallet from './V2-1-railgun-smart-wallet.json';
import { type AbiEvent } from 'viem';
import { findEventInAbi } from '../../utils/events';

// Event names - these will be used as keys in the EVENTS_ABI
export const V2_EVENTS = {
  NULLIFIERS: 'Nullifiers',
  GENERATED_COMMITMENT_BATCH: 'GeneratedCommitmentBatch',
  COMMITMENT_BATCH: 'CommitmentBatch',
  SHIELD: 'Shield',
  UNSHIELD: 'Unshield',
  TRANSACT: 'Transact',
} as const;

// Get ABI for legacy V2 events
const NULLIFIERS_LEGACY = findEventInAbi(V2_EVENTS.NULLIFIERS, V2LegacySmartWallet);
const GENERATED_COMMITMENT_BATCH_LEGACY = findEventInAbi(V2_EVENTS.GENERATED_COMMITMENT_BATCH, V2LegacySmartWallet);
const COMMITMENT_BATCH_LEGACY = findEventInAbi(V2_EVENTS.COMMITMENT_BATCH, V2LegacySmartWallet);
const SHIELD_LEGACY = findEventInAbi(V2_EVENTS.SHIELD, V2LegacySmartWallet);
const UNSHIELD_LEGACY = findEventInAbi(V2_EVENTS.UNSHIELD, V2LegacySmartWallet);
const TRANSACT_LEGACY = findEventInAbi(V2_EVENTS.TRANSACT, V2LegacySmartWallet);

// Get ABI for current V2 events
const SHIELD = findEventInAbi(V2_EVENTS.SHIELD, V2SmartWallet);
const UNSHIELD = findEventInAbi(V2_EVENTS.UNSHIELD, V2SmartWallet);
const TRANSACT = findEventInAbi(V2_EVENTS.TRANSACT, V2SmartWallet);
const GENERATED_COMMITMENT_BATCH = findEventInAbi(V2_EVENTS.GENERATED_COMMITMENT_BATCH, V2SmartWallet);
const COMMITMENT_BATCH = findEventInAbi(V2_EVENTS.COMMITMENT_BATCH, V2SmartWallet);
const NULLIFIERS = findEventInAbi(V2_EVENTS.NULLIFIERS, V2SmartWallet);

// Map legacy event names to their ABI definitions
export const V2_LEGACY_EVENTS_ABI: Record<string, AbiEvent> = {
  [V2_EVENTS.NULLIFIERS]: NULLIFIERS_LEGACY,
  [V2_EVENTS.GENERATED_COMMITMENT_BATCH]: GENERATED_COMMITMENT_BATCH_LEGACY,
  [V2_EVENTS.COMMITMENT_BATCH]: COMMITMENT_BATCH_LEGACY,
  [V2_EVENTS.SHIELD]: SHIELD_LEGACY,
  [V2_EVENTS.UNSHIELD]: UNSHIELD_LEGACY,
  [V2_EVENTS.TRANSACT]: TRANSACT_LEGACY,
} as const;

// Map current V2 event names to their ABI definitions
export const V2_EVENTS_ABI: Record<string, AbiEvent> = {
  [V2_EVENTS.NULLIFIERS]: NULLIFIERS,
  [V2_EVENTS.GENERATED_COMMITMENT_BATCH]: GENERATED_COMMITMENT_BATCH,
  [V2_EVENTS.COMMITMENT_BATCH]: COMMITMENT_BATCH,
  [V2_EVENTS.SHIELD]: SHIELD,
  [V2_EVENTS.UNSHIELD]: UNSHIELD,
  [V2_EVENTS.TRANSACT]: TRANSACT,
} as const;

export type V2EventType = typeof V2_EVENTS[keyof typeof V2_EVENTS];