import { Abi } from 'viem';

/***
 * Note: I think this is already done on a separate package, or it should, at least, be something like, import { v1, v2legacy, v2 } from @railgun-reloaded/abi
 */

import V1_RAILGUN_LOGIC_ABI_JSON from './v1/V1-railgun-logic.json';
import V2_RAILGUN_SMART_WALLET_LEGACY_JSON from './v2/V2-railgun-smart-wallet-legacy.json';
import V2_RAILGUN_SMART_WALLET_JSON from './v2/V2-1-railgun-smart-wallet.json';
import V2_RAILGUN_RELAY_ADAPT_JSON from './v2/V2-relay-adapt.json';


const V1_RAILGUN_LOGIC = V1_RAILGUN_LOGIC_ABI_JSON as Abi;
const V2_RAILGUN_SMART_WALLET_LEGACY = V2_RAILGUN_SMART_WALLET_LEGACY_JSON as Abi;
const V2_RAILGUN_SMART_WALLET = V2_RAILGUN_SMART_WALLET_JSON as Abi;
const V2_RAILGUN_RELAY_ADAPT = V2_RAILGUN_RELAY_ADAPT_JSON as Abi;

export const RAILGUN_ABI = {
  V1_RAILGUN_LOGIC,
  V2_RAILGUN_SMART_WALLET_LEGACY,
  V2_RAILGUN_SMART_WALLET,
  V2_RAILGUN_RELAY_ADAPT // figure out if we still need to read events from here ??? 
}

export type RailgunAbi = Abi;

export * from './v1/events';
export * from './v2/events';

