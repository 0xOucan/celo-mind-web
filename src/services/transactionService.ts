import { apiUrl } from '../config';
import { createPublicClient, http, createWalletClient, custom, parseEther, Chain } from 'viem';
import { celo } from 'viem/chains';

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
  metadata?: {
    source: string;
    walletAddress: string;
    requiresSignature: boolean;
    dataSize: number;
    dataType: string;
  };
}

// Store provider references to ensure they're not garbage collected
const providerCache = new Map();

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
    console.log(`Updating transaction ${txId} status to ${status}${hash ? ` with hash ${hash}` : ''}`);
    
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
 * Execute a pending transaction
 * @param transaction The pending transaction to execute
 * @param walletClient Viem wallet client with signing capabilities
 * @param publicClient Optional public client for transaction monitoring
 */
export const executeTransaction = async (
  transaction: PendingTransaction, 
  walletClient: any,
  publicClient?: any
): Promise<string | null> => {
  try {
    if (!walletClient) {
      throw new Error('No wallet client available');
    }
    
    console.log(`----- TRANSACTION EXECUTION START -----`);
    console.log(`Executing transaction: ${transaction.id}`, {
      to: transaction.to,
      value: transaction.value,
      data: transaction.data ? 
        `${transaction.data.substring(0, 20)}... (${transaction.data.length} bytes)` : 
        'none',
      metadata: transaction.metadata
    });
    
    // Update transaction status to submitted first
    await updateTransactionStatus(transaction.id, TransactionStatus.SUBMITTED);
    
    // Prepare transaction parameters
    const txParams = {
      to: transaction.to as `0x${string}`,
      value: BigInt(transaction.value),
      data: transaction.data ? transaction.data as `0x${string}` : undefined
    };
    
    console.log('Sending transaction to wallet for signing:', {
      to: txParams.to,
      value: txParams.value.toString(),
      dataPresent: !!txParams.data
    });
    
    // Make sure user has time to see the transaction in UI before wallet popup appears
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send the transaction - this should trigger the wallet popup
    console.log('⏳ Awaiting wallet signature...');
    const hash = await walletClient.sendTransaction(txParams);
    
    console.log(`✅ Transaction signed successfully! Hash: ${hash}`);
    
    // Update transaction with hash
    await updateTransactionStatus(transaction.id, TransactionStatus.SUBMITTED, hash);
    
    // If we have a public client, wait for transaction confirmation
    if (publicClient) {
      console.log(`Waiting for transaction confirmation...`);
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Transaction confirmed! Status: ${receipt.status}`);
        
        if (receipt.status === 'success') {
          await updateTransactionStatus(transaction.id, TransactionStatus.CONFIRMED, hash);
        } else {
          await updateTransactionStatus(transaction.id, TransactionStatus.FAILED, hash);
        }
      } catch (error) {
        console.error('Error waiting for transaction confirmation:', error);
      }
    }
    
    console.log(`----- TRANSACTION EXECUTION COMPLETE -----`);
    
    // Return the transaction hash
    return hash;
  } catch (error: any) {
    console.error('----- TRANSACTION EXECUTION ERROR -----');
    console.error('Error executing transaction:', error);
    
    // Log detailed error information
    const errorInfo = {
      message: error.message || 'Unknown error',
      code: error.code,
      data: error.data,
      txId: transaction.id,
      to: transaction.to,
      value: transaction.value
    };
    console.error('Detailed error info:', errorInfo);
    
    // Different handling for user rejection vs other errors
    if (
      error.code === 4001 || 
      (error.message && (
        error.message.includes('user rejected') || 
        error.message.includes('User denied') ||
        error.message.includes('rejected') ||
        error.message.includes('cancelled')
      ))
    ) {
      console.log('Transaction was rejected by the user');
      await updateTransactionStatus(transaction.id, TransactionStatus.REJECTED);
    } else {
      // Other error
      console.log('Transaction failed with error');
      await updateTransactionStatus(transaction.id, TransactionStatus.FAILED);
    }
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
    
    // Generate a unique cache key for this wallet
    const cacheKey = `wallet_${wallet.address}`;
    
    // Check if we already have a cached client
    if (providerCache.has(cacheKey)) {
      console.log('Using cached wallet client for:', wallet.address);
      return providerCache.get(cacheKey);
    }
    
    console.log('Creating new wallet client for wallet:', {
      address: wallet.address,
      walletClientType: wallet.walletClientType
    });
    
    // Get the EIP-1193 provider
    let provider;
    
    try {
      // Try to get Ethereum provider (EIP-1193)
      provider = await wallet.getEthereumProvider();
      console.log('Successfully retrieved Ethereum provider from wallet', {
        hasProvider: !!provider,
        hasRequest: !!(provider && provider.request),
        walletType: wallet.walletClientType
      });
    } catch (providerError) {
      console.error('Error getting Ethereum provider:', providerError);
      console.log('Falling back to wallet.provider');
      provider = wallet.provider;
    }
    
    if (!provider) {
      throw new Error('No wallet provider available');
    }
    
    // Test provider connectivity
    try {
      const testResult = await provider.request({ method: 'eth_chainId' });
      console.log('Provider test successful, chainId:', testResult);
    } catch (testError) {
      console.error('Provider test failed:', testError);
    }
    
    // Create a wallet client with the wallet's provider
    const walletClient = createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: celo,
      transport: custom(provider)
    });
    
    // Create a public client for status monitoring
    const publicClient = createPublicClient({
      chain: celo,
      transport: http()
    });
    
    // Test if the wallet client can access the account
    try {
      const accounts = await walletClient.getAddresses();
      console.log('Wallet client successfully retrieved accounts:', accounts);
      
      // Cache the client for future use
      providerCache.set(cacheKey, {
        walletClient,
        publicClient,
        provider,
        address: wallet.address
      });
      
      return {
        walletClient,
        publicClient,
        provider,
        address: wallet.address
      };
    } catch (addressError) {
      console.error('Error getting addresses from wallet client:', addressError);
      throw new Error('Could not access wallet accounts');
    }
  } catch (error: any) {
    console.error('Error creating wallet client:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      wallet: wallet ? {
        address: wallet.address,
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
export const processPendingTransactions = async (clientDetails: any): Promise<void> => {
  if (!clientDetails) {
    console.error('No wallet client details provided');
    return;
  }
  
  const { walletClient, publicClient } = clientDetails;
  
  try {
    const pendingTxs = await getPendingTransactions();
    
    if (pendingTxs.length > 0) {
      console.log(`Found ${pendingTxs.length} pending transactions`);
      
      // Process one transaction at a time
      for (const tx of pendingTxs) {
        if (tx.status === TransactionStatus.PENDING) {
          console.log(`Processing pending transaction: ${tx.id}`);
          
          try {
            await executeTransaction(tx, walletClient, publicClient);
            
            // Add a delay between transactions to prevent overwhelming the wallet
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (txError) {
            console.error(`Error processing transaction ${tx.id}:`, txError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing pending transactions:', error);
  }
}; 