import { type AbiEvent } from 'viem';

// TODO: Figure out a better way of using this
export const findEventInAbi = (eventName: string, eventsJson: any[]): AbiEvent => {
  const event = eventsJson.find(
    item => item.type === 'event' && item.name === eventName
  ) as AbiEvent;
  
  if (!event) {
    throw new Error(`Event ${eventName} not found in ABI`);
  }
  return event;
};