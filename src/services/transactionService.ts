import { apiUrl } from '../config';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { celo } from 'viem/chains';
import { 
  CELO_CHAIN_HEX, 
  CELO_NETWORK_PARAMS,
  TransactionStatus,
  NetworkErrorType 
} from '../constants/network';
import { formatWeiToEther } from '../utils/formatting';

// Transaction interface matching backend pendingTransactions
export interface PendingTransaction {
  id: string;
  to: string;
  value: string;
  data?: string;
  status: string;
  timestamp: number;
  hash?: string;
  metadata?: {
    source: string;
    walletAddress: string;
    requiresSignature: boolean;
    dataSize: number;
    dataType: string;
  };
}

// Custom error class for better error handling
export class TransactionError extends Error {
  type: string;
  details?: string;
  transaction?: PendingTransaction;

  constructor(message: string, type: string, details?: string, transaction?: PendingTransaction) {
    super(message);
    this.name = 'TransactionError';
    this.type = type;
    this.details = details;
    this.transaction = transaction;
  }
}

/**
 * Fetch pending transactions from the backend
 */
export const getPendingTransactions = async (): Promise<PendingTransaction[]> => {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/pending`);
    
    if (!response.ok) {
      throw new TransactionError(
        `Failed to fetch pending transactions: ${response.statusText}`,
        'fetch_error',
        `Status: ${response.status}`
      );
    }
    
    const data = await response.json();
    return data.transactions || [];
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    
    console.error('Error fetching pending transactions:', error);
    throw new TransactionError(
      'Failed to fetch pending transactions',
      'fetch_error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};

/**
 * Update transaction status on the backend
 */
export const updateTransactionStatus = async (
  txId: string, 
  status: TransactionStatus, 
  hash?: string
): Promise<PendingTransaction | null> => {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/${txId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, hash })
    });
    
    if (!response.ok) {
      throw new TransactionError(
        `Failed to update transaction: ${response.statusText}`,
        'update_error',
        `Status: ${response.status}`
      );
    }
    
    const data = await response.json();
    return data.transaction || null;
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    
    console.error(`Error updating transaction ${txId}:`, error);
    throw new TransactionError(
      'Failed to update transaction status',
      'update_error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};

/**
 * Switch the wallet chain to Celo if needed
 * @param provider The provider from the wallet
 * @returns Boolean indicating whether chain was already Celo or successfully switched
 */
export const switchToCeloChain = async (provider: any): Promise<boolean> => {
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
          throw new TransactionError(
            'Failed to add Celo network to wallet. Please add it manually.',
            NetworkErrorType.CHAIN_ADD_FAILED,
            addError instanceof Error ? addError.message : 'Unknown error'
          );
        }
      } else {
        console.error('Failed to switch to Celo chain:', switchError);
        throw new TransactionError(
          'Failed to switch to Celo network. Please switch manually in your wallet.',
          NetworkErrorType.NETWORK_SWITCH_FAILED,
          switchError.message || 'Unknown error'
        );
      }
    }
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    
    console.error('Error during chain switching:', error);
    throw new TransactionError(
      'Error switching to Celo network',
      NetworkErrorType.CONNECTION_FAILED,
      error instanceof Error ? error.message : 'Unknown error'
    );
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
      throw new TransactionError(
        'No wallet client available',
        'wallet_error',
        'Please connect your wallet and try again'
      );
    }
    
    console.log(`🔶 Executing transaction: ${transaction.id}`, {
      to: transaction.to,
      value: transaction.value,
      valueInEther: formatWeiToEther(transaction.value),
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
        await switchToCeloChain(provider);
        // After switching, re-create walletClient with the new chain ID to avoid mismatch errors
        walletClient = createWalletClient({
          account: walletClient.account,
          chain: celo,
          transport: custom(provider)
        });
      } catch (switchError) {
        if (switchError instanceof TransactionError) {
          throw switchError;
        }
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
      valueInEther: formatWeiToEther(txParams.value),
      hasData: !!txParams.data
    });

    // Send the transaction
    try {
      const hash = await walletClient.sendTransaction(txParams);
      
      // Update transaction status with hash
      await updateTransactionStatus(transaction.id, TransactionStatus.CONFIRMED, hash);
      
      console.log('✅ Transaction submitted successfully:', hash);
      return hash;
    } catch (txError: any) {
      // Check if user rejected the transaction
      if (
        txError.code === 4001 ||  // MetaMask/standard rejection code
        (txError.message && (
          txError.message.includes('rejected') ||
          txError.message.includes('denied') ||
          txError.message.includes('cancelled') ||
          txError.message.includes('canceled')
        ))
      ) {
        console.warn('Transaction rejected by user:', txError);
        await updateTransactionStatus(transaction.id, TransactionStatus.REJECTED);
        throw new TransactionError(
          'Transaction rejected by user',
          'user_rejection',
          'You rejected the transaction in your wallet',
          transaction
        );
      } else {
        // Other transaction error
        console.error('Transaction failed:', txError);
        await updateTransactionStatus(transaction.id, TransactionStatus.FAILED);
        throw new TransactionError(
          'Transaction failed to process',
          'transaction_error',
          txError.message || 'Unknown error',
          transaction
        );
      }
    }
  } catch (error) {
    // Handle errors that might have occurred outside transaction execution
    if (error instanceof TransactionError) {
      throw error;
    }
    
    console.error('Error executing transaction:', error);
    throw new TransactionError(
      'Failed to execute transaction',
      'execution_error',
      error instanceof Error ? error.message : 'Unknown error',
      transaction
    );
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