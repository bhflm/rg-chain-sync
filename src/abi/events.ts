import V1Events from './V1-events.json';
import { type AbiEvent } from 'viem';

// Had to do this because neither getAbiItem or parseAbiItem where working ?? one did have something like event doesn't match signature and the other one did have a type missmatch
const findEventInAbi = (eventName: string): AbiEvent => {
  const event = V1Events.find(
    item => item.type === 'event' && item.name === eventName
  ) as AbiEvent;
  
  if (!event) {
    throw new Error(`Event ${eventName} not found in ABI`);
  }
  return event;
};

export const GENERATED_COMMITMENT_BATCH_EVENT = findEventInAbi('GeneratedCommitmentBatch');
export const COMMITMENT_BATCH_EVENT = findEventInAbi('CommitmentBatch');
export const NULLIFIERS_EVENT = findEventInAbi('Nullifiers');