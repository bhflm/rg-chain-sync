import { type Chain as ViemChain } from 'viem/chains';
/**
 * Network names enum
 */
export declare enum NetworkName {
    Ethereum = "Ethereum",
    BNBChain = "BNB_Chain",
    Polygon = "Polygon",
    Arbitrum = "Arbitrum",
    EthereumSepolia = "Ethereum_Sepolia",
    PolygonAmoy = "Polygon_Amoy"
}
/**
 * Contract addresses for RAILGUN proxy by network
 */
export declare const RailgunProxyContract: Record<NetworkName, string>;
/**
 * Deployment blocks for RAILGUN proxy by network
 */
export declare const RailgunProxyDeploymentBlock: Record<NetworkName, number>;
/**
 * Map network names to Viem chain objects
 */
export declare const NetworkToViemChain: Record<NetworkName, ViemChain>;
export declare const StringToNetworkName: Record<string, NetworkName>;
export declare function getNetworkName(networkStr: string | NetworkName): NetworkName;
