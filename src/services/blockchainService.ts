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

/**
 * Get wallet address from backend
 */
export const getWalletAddress = async (): Promise<string> => {
  try {
    // First try with direct "get wallet address" command
    const response = await fetch(`${apiUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userInput: 'get wallet address' })
    });
    
    if (!response.ok) {
      throw new Error('Failed to get wallet address from backend');
    }
    
    const data = await response.json();
    const responseText = data.response || '';
    
    // Extract the wallet address from the response text
    // Look for patterns like "Your wallet address is: 0x..." or "Address: 0x..."
    const addressMatch = 
      responseText.match(/[Aa]ddress(?:\s+is)?(?:\s*:\s*|\s+)(?:`)?0x[a-fA-F0-9]{40}(?:`)?/i) ||
      responseText.match(/(?:`)?0x[a-fA-F0-9]{40}(?:`)?/);
    
    if (addressMatch) {
      // Extract the address, removing any backticks, colons, "address" text
      const extractedAddress = addressMatch[0].match(/0x[a-fA-F0-9]{40}/);
      if (extractedAddress) {
        const address = extractedAddress[0];
        console.log('Found wallet address from API:', address);
        return address;
      }
    }
    
    // If direct command failed, try getting it from wallet portfolio
    console.log('Direct wallet address query failed, trying portfolio query');
    const portfolioResponse = await fetch(`${apiUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userInput: 'check wallet portfolio' })
    });
    
    if (!portfolioResponse.ok) {
      throw new Error('Failed to get wallet portfolio from backend');
    }
    
    const portfolioData = await portfolioResponse.json();
    const portfolioText = portfolioData.response || '';
    
    // Look for address in portfolio response which typically has "Address: 0x..." format
    // at the beginning of the response
    const portfolioAddressMatch = 
      portfolioText.match(/[Aa]ddress(?:\s*:\s*|\s+)(?:`)?0x[a-fA-F0-9]{40}(?:`)?/i) ||
      portfolioText.match(/(?:`)?0x[a-fA-F0-9]{40}(?:`)?/);
    
    if (portfolioAddressMatch) {
      // Extract the address, removing any backticks, colons, "address" text
      const extractedAddress = portfolioAddressMatch[0].match(/0x[a-fA-F0-9]{40}/);
      if (extractedAddress) {
        const address = extractedAddress[0];
        console.log('Found wallet address from portfolio query:', address);
        return address;
      }
    }
    
    // If no address was found in either query, use the default
    console.warn('Could not extract wallet address from API responses, using default');
    return DEFAULT_WALLET_ADDRESS;
  } catch (error) {
    console.error('Error getting wallet address from backend:', error);
    // Fallback to default address
    return DEFAULT_WALLET_ADDRESS;
  }
};

/**
 * Get native CELO balance
 */
export const getNativeBalance = async (address: string = DEFAULT_WALLET_ADDRESS): Promise<bigint> => {
  try {
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`,
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
  walletAddress: string = DEFAULT_WALLET_ADDRESS
): Promise<bigint> => {
  try {
    // Use readContract instead of getContract().read
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
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
    // If no valid wallet address is provided, try to get it from the backend
    let address = walletAddress;
    
    // Validate the address format
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      console.log('Invalid wallet address provided to getAllTokenBalances, falling back to backend address');
      address = await getWalletAddress();
    } else {
      console.log('Using provided wallet address for balance check:', address);
    }
    
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