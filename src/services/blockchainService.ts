import { createPublicClient, http, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { 
  CELO_RPC_URL, 
  DEFAULT_WALLET_ADDRESS, 
  TRACKED_TOKENS,
  TOKEN_PRICES_USD,
  apiUrl
} from '../config';

// ERC20 ABI (minimal for balance checking)
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Define the token balance interface
export interface TokenBalance {
  symbol: string;
  balance: string;
  balanceFormatted: string;
  balanceUsd: string;
  icon: string;
}

// Create public client for Celo
const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

// Cache for the wallet address
let cachedWalletAddress = '';  // Initialize with empty string instead of null

/**
 * Get the wallet address from the backend API
 */
export const getWalletAddress = async (): Promise<string> => {
  // Return cached address if available (non-empty)
  if (cachedWalletAddress) {
    return cachedWalletAddress;
  }
  
  try {
    // Query the API to get the wallet address using the balance checker
    const response = await fetch(`${apiUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userInput: 'get wallet address' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch wallet address from API');
    }
    
    const data = await response.json();
    const responseText = data.response || '';
    
    // Try to extract the wallet address using regex
    // Looking for patterns like: Address: 0x... or Your wallet address is 0x...
    const addressMatch = responseText.match(/(?:Address|address|wallet address)[^\w`]*[`']?(0x[a-fA-F0-9]{40})[`']?/);
    
    if (addressMatch && addressMatch[1]) {
      // Cache the address for future use
      cachedWalletAddress = addressMatch[1];
      console.log(`Wallet address fetched from API: ${cachedWalletAddress}`);
      return cachedWalletAddress;
    }
    
    console.warn('Could not parse wallet address from API response:', responseText);
    return DEFAULT_WALLET_ADDRESS;
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    return DEFAULT_WALLET_ADDRESS;
  }
};

/**
 * Get native CELO balance
 */
export const getNativeBalance = async (address?: string): Promise<bigint> => {
  try {
    // If no address provided, fetch from API
    const walletAddress = address || await getWalletAddress();
    
    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    return balance;
  } catch (error) {
    console.error('Error getting native balance:', error);
    return BigInt(0);
  }
};

/**
 * Get ERC20 token balance
 */
export const getTokenBalance = async (
  tokenAddress: string,
  walletAddress?: string
): Promise<bigint> => {
  try {
    // If no address provided, fetch from API
    const address = walletAddress || await getWalletAddress();
    
    // Use readContract instead of getContract().read
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    
    return balance as bigint;
  } catch (error) {
    console.error(`Error getting balance for token ${tokenAddress}:`, error);
    return BigInt(0);
  }
};

/**
 * Format token balance with proper decimals
 */
export const formatTokenBalance = (
  balance: bigint,
  decimals: number
): string => {
  return formatUnits(balance, decimals);
};

/**
 * Calculate USD value of token amount
 */
export const calculateUsdValue = (
  formattedBalance: string,
  tokenAddress: string
): string => {
  // Use type assertion for the index access
  const price = TOKEN_PRICES_USD[tokenAddress as keyof typeof TOKEN_PRICES_USD] || 0;
  const usdValue = Number(formattedBalance) * price;
  return usdValue.toFixed(2);
};

/**
 * Get all token balances for a wallet
 */
export const getAllTokenBalances = async (
  walletAddress?: string
): Promise<TokenBalance[]> => {
  try {
    // If no address provided, fetch from API
    const address = walletAddress || await getWalletAddress();
    console.log(`Fetching token balances for address: ${address}`);
    
    const result: TokenBalance[] = [];
    
    // Get balances for all tokens in parallel
    const balancePromises = TRACKED_TOKENS.map(async (token) => {
      let balance: bigint;
      
      if (token.isNative) {
        balance = await getNativeBalance(address);
      } else {
        balance = await getTokenBalance(token.address, address);
      }
      
      // Always include the token, even if balance is 0
      const formattedBalance = formatTokenBalance(balance, token.decimals);
      const balanceUsd = calculateUsdValue(formattedBalance, token.address);
      
      result.push({
        symbol: token.symbol,
        balance: balance.toString(),
        balanceFormatted: formattedBalance,
        balanceUsd: `$${balanceUsd}`,
        icon: token.icon
      });
    });
    
    await Promise.all(balancePromises);
    
    // Sort by USD value, highest first
    return result.sort((a, b) => {
      const aValue = Number(a.balanceUsd.replace('$', ''));
      const bValue = Number(b.balanceUsd.replace('$', ''));
      return bValue - aValue;
    });
  } catch (error) {
    console.error('Error getting all token balances:', error);
    return [];
  }
}; 