/**
 * Network and blockchain related constants
 */

// Chain ID in both decimal and hex formats
export const CELO_CHAIN_ID = 42220;
export const CELO_CHAIN_HEX = `0x${CELO_CHAIN_ID.toString(16)}`;

// RPC URLs in priority order
export const CELO_RPC_URLS = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://celo-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161' // Public Infura endpoint
];

// Network parameters for wallet addition
export const CELO_NETWORK_PARAMS = {
  chainId: CELO_CHAIN_HEX,
  chainName: 'Celo Mainnet',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18
  },
  rpcUrls: CELO_RPC_URLS,
  blockExplorerUrls: ['https://celoscan.io/']
};

// Explorer URL formatters
export const getExplorerAddressUrl = (address: string): string => 
  `https://celoscan.io/address/${address}`;

export const getExplorerTxUrl = (txHash: string): string => 
  `https://celoscan.io/tx/${txHash}`;

// Transaction status enum
export enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  FAILED = 'failed'
}

// Error types
export enum NetworkErrorType {
  CONNECTION_FAILED = 'connection_failed',
  CHAIN_ADD_FAILED = 'chain_add_failed',
  NETWORK_SWITCH_FAILED = 'network_switch_failed',
  UNSUPPORTED_CHAIN = 'unsupported_chain',
  ACCOUNT_ACCESS_DENIED = 'account_access_denied',
  WALLET_NOT_FOUND = 'wallet_not_found',
  UNKNOWN = 'unknown'
}

// Gas price settings
export const GAS_PRICE_MULTIPLIER = 1.1; // 10% buffer
export const GAS_LIMIT_MULTIPLIER = 1.2; // 20% buffer

// RPC error codes
export const RPC_ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  CHAIN_NOT_ADDED: 4902
};

// Blockchain explorers
export const EXPLORERS = {
  CELO: {
    name: 'Celoscan',
    url: 'https://celoscan.io',
    tx: (hash: string) => `https://celoscan.io/tx/${hash}`,
    address: (address: string) => `https://celoscan.io/address/${address}`,
    token: (address: string) => `https://celoscan.io/token/${address}`
  },
  CELO_ALFAJORES: {
    name: 'Alfajores Explorer',
    url: 'https://alfajores.celoscan.io',
    tx: (hash: string) => `https://alfajores.celoscan.io/tx/${hash}`,
    address: (address: string) => `https://alfajores.celoscan.io/address/${address}`,
    token: (address: string) => `https://alfajores.celoscan.io/token/${address}`
  }
}; 