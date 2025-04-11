import { mainnet, polygon, arbitrum, bsc, type Chain as ViemChain } from 'viem/chains';

/**
 * Network names enum
 */
export enum NetworkName {
  // Mainnets
  Ethereum = 'Ethereum',
  BNBChain = 'BNB_Chain',
  Polygon = 'Polygon',
  Arbitrum = 'Arbitrum',
  // Testnets
  EthereumSepolia = 'Ethereum_Sepolia',
  PolygonAmoy = 'Polygon_Amoy',
}

/**
 * Contract addresses for RAILGUN proxy by network
 */
export const RailgunProxyContract: Record<NetworkName, string> = {
  // Main nets
  [NetworkName.Ethereum]: '0xfa7093cdd9ee6932b4eb2c9e1cde7ce00b1fa4b9',
  [NetworkName.BNBChain]: '0x590162bf4b50f6576a459b75309ee21d92178a10',
  [NetworkName.Polygon]: '0x19b620929f97b7b990801496c3b361ca5def8c71',
  [NetworkName.Arbitrum]: '0xFA7093CDD9EE6932B4eb2c9e1cde7CE00B1FA4b9',

  // Test nets
  [NetworkName.EthereumSepolia]: '0xeCFCf3b4eC647c4Ca6D49108b311b7a7C9543fea',
  [NetworkName.PolygonAmoy]: '0xD1aC80208735C7f963Da560C42d6BD82A8b175B5',
};

/**
 * Deployment blocks for RAILGUN proxy by network
 */
export const RailgunProxyDeploymentBlock: Record<NetworkName, number> = {
  // Main nets
  [NetworkName.Ethereum]: 14737691,
  [NetworkName.BNBChain]: 17633701,
  [NetworkName.Polygon]: 28083766,
  [NetworkName.Arbitrum]: 56109834,

  // Test nets
  [NetworkName.EthereumSepolia]: 5784866,
  [NetworkName.PolygonAmoy]: 6666136,
};

/**
 * Map network names to Viem chain objects 
 */
export const NetworkToViemChain: Record<NetworkName, ViemChain> = {
  [NetworkName.Ethereum]: mainnet,
  [NetworkName.Polygon]: polygon,
  [NetworkName.BNBChain]: bsc,
  [NetworkName.Arbitrum]: arbitrum,
  // Testnets
  [NetworkName.EthereumSepolia]: {
    ...mainnet,
    id: 11155111,
    name: 'Sepolia',
  } as ViemChain,
  [NetworkName.PolygonAmoy]: {
    ...polygon,
    id: 80002,
    name: 'Amoy',
  } as ViemChain,
};

export const StringToNetworkName: Record<string, NetworkName> = {
  'ethereum': NetworkName.Ethereum,
  'bnb': NetworkName.BNBChain,
  'polygon': NetworkName.Polygon,
  'matic': NetworkName.Polygon,
  'arbitrum': NetworkName.Arbitrum,  
  'sepolia': NetworkName.EthereumSepolia,
  'amoy': NetworkName.PolygonAmoy,
};

export function getNetworkName(networkStr: string | NetworkName): NetworkName {
  if (Object.values(NetworkName).includes(networkStr as NetworkName)) {
    return networkStr as NetworkName;
  }
  
  const normalized = String(networkStr).toLowerCase().trim();
  const networkName = StringToNetworkName[normalized];
  
  if (!networkName) {
    throw new Error(`Unsupported network: ${networkStr}`);
  }
  
  return networkName;
}