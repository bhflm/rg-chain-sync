import { Abi } from 'viem';
export declare const RAILGUN_ABI: {
    V1_RAILGUN_LOGIC: Abi;
    V2_RAILGUN_SMART_WALLET_LEGACY: Abi;
    V2_RAILGUN_SMART_WALLET: Abi;
    V2_RAILGUN_RELAY_ADAPT: Abi;
};
export type RailgunAbi = Abi;
export * from './v1/events';
export * from './v2/events';
