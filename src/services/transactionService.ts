import { apiUrl, CELO_CHAIN_ID } from '../config';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { celo } from 'viem/chains';

// Additional constants for chain switching
const CELO_CHAIN_HEX = `0x${CELO_CHAIN_ID.toString(16)}`;
const CELO_NETWORK_PARAMS = {
  chainId: CELO_CHAIN_HEX,
  chainName: 'Celo Mainnet',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18
  },
  rpcUrls: ['https://forno.celo.org', 'https://rpc.ankr.com/celo'],
  blockExplorerUrls: ['https://celoscan.io/']
};

// Transaction status types
export enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  FAILED = 'failed'
}

// Transaction interface matching backend pendingTransactions
export interface PendingTransaction {
  id: string;
  to: string;
  value: string;
  data?: string;
  status: string;
  timestamp: number;
  hash?: string;
}

/**
 * Fetch pending transactions from the backend
 */
export const getPendingTransactions = async (): Promise<PendingTransaction[]> => {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/pending`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pending transactions: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.transactions || [];
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    return [];
  }
};

/**
 * Update transaction status on the backend
 */
export const updateTransactionStatus = async (
  txId: string, 
  status: TransactionStatus, 
  hash?: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/${txId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, hash })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update transaction: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating transaction ${txId}:`, error);
    return false;
  }
};

/**
 * Switch the wallet chain to Celo if needed
 * @param provider The provider from the wallet
 * @returns Boolean indicating whether chain was already Celo or successfully switched
 */
export const switchToceloChain = async (provider: any): Promise<boolean> => {
  try {
    // Get current chain ID
    const currentChainId = await provider.request({ method: 'eth_chainId' });
    
    // Check if already on Celo
    if (currentChainId === CELO_CHAIN_HEX) {
      console.log('Already on Celo network');
      return true;
    }
    
    console.log(`Need to switch chains from ${currentChainId} to Celo (${CELO_CHAIN_HEX})`);
    
    // Try to switch to Celo chain
    try {
      // First try the standard wallet_switchEthereumChain method
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CELO_CHAIN_HEX }]
      });
      console.log('Successfully switched to Celo chain');
      return true;
    } catch (switchError: any) {
      // Chain doesn't exist yet in wallet
      if (switchError.code === 4902 || 
          (switchError.message && switchError.message.includes('chain hasn\'t been added'))) {
        try {
          // Try to add the chain to the wallet
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [CELO_NETWORK_PARAMS]
          });
          console.log('Successfully added and switched to Celo chain');
          return true;
        } catch (addError) {
          console.error('Failed to add Celo chain to wallet:', addError);
          throw new Error('Failed to add Celo network to wallet. Please add it manually.');
        }
      } else {
        console.error('Failed to switch to Celo chain:', switchError);
        throw new Error('Failed to switch to Celo network. Please switch manually in your wallet.');
      }
    }
  } catch (error) {
    console.error('Error during chain switching:', error);
    throw error;
  }
};

/**
 * Execute a pending transaction
 * @param transaction The pending transaction to execute
 * @param walletClient Viem wallet client with signing capabilities
 */
export const executeTransaction = async (
  transaction: PendingTransaction, 
  walletClient: any
): Promise<string | null> => {
  try {
    if (!walletClient) {
      throw new Error('No wallet client available');
    }
    
    console.log(`🔶 Executing transaction: ${transaction.id}`, {
      to: transaction.to,
      value: transaction.value,
      dataLength: transaction.data ? transaction.data.length : 0,
      dataPrefix: transaction.data ? transaction.data.substring(0, 10) : 'none' // First 4 bytes is the function selector
    });
    
    // First try to get the provider from walletClient
    const provider = walletClient.transport?.getProvider?.() || 
                    walletClient.transport?.provider || 
                    walletClient.provider;
    
    if (provider) {
      // Try to switch to Celo chain before executing transaction
      try {
        await switchToceloChain(provider);
        // After switching, re-create walletClient with the new chain ID to avoid mismatch errors
        walletClient = createWalletClient({
          account: walletClient.account,
          chain: celo,
          transport: custom(provider)
        });
      } catch (switchError) {
        console.warn('Chain switching failed, transaction may fail:', switchError);
        // Continue with transaction attempt even if switching fails
        // Some wallets handle this gracefully on their end
      }
    } else {
      console.warn('Could not access provider for chain switching, transaction may fail');
    }
    
    // Update transaction status to submitted before sending to prevent duplicate attempts
    await updateTransactionStatus(transaction.id, TransactionStatus.SUBMITTED);
    
    // Prepare transaction parameters
    const txParams: any = {
      to: transaction.to as `0x${string}`,
      value: BigInt(transaction.value || '0'),
    };
    
    // Only add data if it exists and is non-empty
    if (transaction.data && transaction.data !== '0x') {
      txParams.data = transaction.data as `0x${string}`;
    }
    
    console.log('🔷 Sending transaction to wallet for signing...', {
      to: txParams.to,
      value: txParams.value.toString(),
      hasData: !!txParams.data
    });
    
    // Try to estimate gas first to catch any obvious errors before sending to the wallet
    try {
      const publicClient = createPublicClient({
        chain: celo,
        transport: http()
      });
      
      const gasEstimate = await publicClient.estimateGas({
        account: walletClient.account,
        ...txParams
      });
      
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      
      // Add a gas limit with 20% buffer to ensure transaction has enough gas
      txParams.gas = gasEstimate * BigInt(12) / BigInt(10);
    } catch (error) {
      console.warn('Gas estimation failed, proceeding without gas limit:', error);
      // Continue without gas estimate - wallet will handle it
    }
    
    // Send the transaction - this should trigger the wallet popup
    let hash: `0x${string}`;
    
    try {
      // First we'll check if we can access the account
      const [account] = await walletClient.getAddresses();
      console.log(`Sending from account: ${account}`);
      
      // Send the transaction - THIS IS WHERE THE WALLET POPUP SHOULD APPEAR
      console.log('⚡ Requesting wallet signature...');
      hash = await walletClient.sendTransaction(txParams);
      
      console.log(`✅ Transaction signed successfully! Hash: ${hash}`);
    } catch (error: any) {
      // This catch block handles wallet rejection or other wallet-level errors
      console.error('Error during transaction signing:', error);
      
      // Handle chain mismatch errors specifically
      if (error.message && error.message.includes('chain') && error.message.includes('match')) {
        console.error('Chain mismatch error detected:', error.message);
        await updateTransactionStatus(transaction.id, TransactionStatus.FAILED);
        throw new Error('Please switch your wallet to the Celo network (Chain ID: 42220) and try again.');
      }
      
      if (error.code === 4001 || 
          (error.message && (
            error.message.includes('reject') || 
            error.message.includes('denied') ||
            error.message.includes('cancel') ||
            error.message.includes('dismissed')
          ))) {
        // User rejected the transaction
        console.log('👨‍💻 Transaction was rejected by user');
        await updateTransactionStatus(transaction.id, TransactionStatus.REJECTED);
        return null;
      }
      
      // Rethrow other errors to be caught by the outer catch block
      throw error;
    }
    
    // Transaction was signed successfully - update with hash
    await updateTransactionStatus(transaction.id, TransactionStatus.SUBMITTED, hash);
    
    // Return the transaction hash
    return hash;
  } catch (error: any) {
    // This outer catch block handles any other errors in the process
    console.error('❌ Error executing transaction:', error);
    console.error('Details:', {
      message: error.message,
      code: error.code,
      type: error.name,
      transaction: transaction.id
    });
    
    // Update transaction status to failed
    await updateTransactionStatus(transaction.id, TransactionStatus.FAILED);
    return null;
  }
};

/**
 * Create a Viem wallet client for the connected wallet using Privy
 * This function needs to be called in a component with access to Privy hooks
 */
export const createPrivyWalletClient = async (wallet: any) => {
  try {
    if (!wallet) {
      console.error('No wallet provided to createPrivyWalletClient');
      throw new Error('No wallet available');
    }
    
    console.log('Creating wallet client with wallet type:', wallet.walletClientType);
    console.log('Wallet address:', wallet.address);
    
    // Different wallets provide the provider differently
    let provider;
    
    try {
      // Try to get the Ethereum provider - works for most browser extensions
      const ethProvider = await wallet.getEthereumProvider();
      
      if (ethProvider) {
        console.log('Retrieved EthereumProvider successfully', {
          hasRequest: !!ethProvider.request,
          hasAccounts: !!ethProvider.getAccounts,
          hasSendAsync: !!ethProvider.sendAsync,
          hasSend: !!ethProvider.send
        });
        provider = ethProvider;
      } else if (wallet.provider) {
        // Fallback to wallet.provider if getEthereumProvider() returns null
        console.log('Using wallet.provider as fallback');
        provider = wallet.provider;
      } else {
        throw new Error('No provider available in wallet');
      }
    } catch (error) {
      console.error('Error getting ethereum provider:', error);
      // Last resort fallback to wallet.provider
      if (wallet.provider) {
        console.log('Using wallet.provider as last resort fallback');
        provider = wallet.provider;
      } else {
        throw new Error('No provider available in wallet after fallback attempts');
      }
    }
    
    // Verify provider has required methods
    if (!provider.request) {
      console.error('Provider missing request method:', provider);
      throw new Error('Provider is missing required request method');
    }

    // Test the provider with a simple request
    try {
      const chainId = await provider.request({ method: 'eth_chainId' });
      console.log('Provider test successful. Chain ID:', chainId);
    } catch (e) {
      console.error('Provider test failed:', e);
      // Continue anyway, as some providers might restrict certain methods
    }
    
    // Create wallet client with transport to the wallet's provider
    console.log('Creating walletClient with custom transport');
    const walletClient = createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: celo,
      transport: custom(provider)
    });
    
    // Verify wallet client by testing key methods
    try {
      const addresses = await walletClient.getAddresses();
      console.log('Wallet client working: retrieved addresses', addresses);
      
      // Test chain access
      const chainId = await walletClient.getChainId();
      console.log('Chain ID from wallet client:', chainId);
      
      // Additional check to make sure wallet can sign
      console.log('Wallet client ready for signing transactions');
    } catch (error) {
      console.error('Error testing wallet client:', error);
      throw new Error('Wallet client creation succeeded but testing failed');
    }
    
    return walletClient;
  } catch (error: any) {
    console.error('Error creating wallet client:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      wallet: wallet ? {
        address: wallet.address,
        type: wallet.walletClientType,
        hasProvider: !!wallet.provider
      } : 'null'
    });
    return null;
  }
};

/**
 * Poll for pending transactions and process them
 * @param walletClient Viem wallet client with signing capabilities
 */
export const processPendingTransactions = async (walletClient: any): Promise<void> => {
  try {
    const pendingTxs = await getPendingTransactions();
    
    if (pendingTxs.length > 0) {
      console.log(`📋 Found ${pendingTxs.length} pending transactions`);
    }
    
    // Process only the first pending transaction - better UX to handle one at a time
    // This gives the user time to interact with their wallet between transactions
    for (const tx of pendingTxs) {
      if (tx.status === TransactionStatus.PENDING) {
        console.log(`⚡ Processing pending transaction: ${tx.id}`);
        
        try {
          const hash = await executeTransaction(tx, walletClient);
          if (hash) {
            console.log(`✅ Transaction executed successfully! Hash: ${hash}`);
          } else {
            console.log(`❌ Transaction was not completed (likely rejected)`);
          }
          
          // Only process one transaction at a time, then exit
          // This prevents overwhelming the user with multiple wallet popups
          break;
        } catch (error) {
          console.error(`Error executing transaction ${tx.id}:`, error);
          
          // Continue to the next transaction if this one fails
          continue;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing pending transactions:', error);
  }
}; 