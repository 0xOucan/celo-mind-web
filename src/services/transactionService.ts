import { apiUrl } from '../config';
import { createPublicClient, http, createWalletClient, custom, WalletClient } from 'viem';
import { celo } from 'viem/chains';

// Transaction status types
export enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  FAILED = 'failed',
  APPROVAL_PENDING = 'approval-pending'
}

// Transaction interface matching backend pendingTransactions
export interface PendingTransaction {
  id: string;
  to: string;
  data?: string;
  value?: string;
  from?: string;
  status: TransactionStatus;
  hash?: string;
  networkId?: string;
  updatedAt: string;
  timestamp?: number;
  metadata?: {
    approvalTxId?: string;
    description?: string;
    tokenSymbol?: string;
    tokenAmount?: string;
    operationType?: string;
    // other metadata fields as needed
  };
}

// Add this type definition near the other types
export interface ProcessResult {
  processed: number;
  errors: string[];
  hash?: string;
  txId?: string;
  message?: string;
  rejectedByUser?: boolean;
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
      valueInEther: (BigInt(transaction.value || '0') / BigInt(10**18)).toString(),
      dataLength: transaction.data ? transaction.data.length : 0,
      dataPrefix: transaction.data ? transaction.data.substring(0, 10) : 'none', // First 4 bytes is the function selector
      tokenApproval: transaction.data?.startsWith('0x095ea7b3') || transaction.data?.startsWith('0x39509351'),
      tokenTransfer: transaction.data?.startsWith('0xa9059cbb')
    });
    
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
      valueInEther: (txParams.value / BigInt(10**18)).toString(),
      hasData: !!txParams.data,
      dataPrefix: txParams.data ? txParams.data.substring(0, 10) : 'none'
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
      
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      
      // Add a gas limit with 20% buffer to ensure transaction has enough gas
      txParams.gas = gasEstimate * BigInt(12) / BigInt(10);
    } catch (error) {
      console.warn('⚠️ Gas estimation failed, proceeding without gas limit:', error);
      // Continue without gas estimate - wallet will handle it
    }
    
    // Send the transaction - this should trigger the wallet popup
    let hash: `0x${string}`;
    
    try {
      // First we'll check if we can access the account
      const [account] = await walletClient.getAddresses();
      console.log(`👤 Sending from account: ${account}`);
      
      // Wait a short delay to ensure the wallet UI has time to prepare
      // This can help with some wallets that need a moment between operations
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send the transaction - THIS IS WHERE THE WALLET POPUP SHOULD APPEAR
      console.log('⚡ Requesting wallet signature - EXPECT WALLET POPUP NOW');
      console.log('Transaction data:', JSON.stringify(txParams, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      ));
      
      hash = await walletClient.sendTransaction(txParams);
      
      // Validate hash format
      if (!hash || !hash.startsWith('0x') || hash.length !== 66) {
        console.warn(`❗ Received invalid transaction hash format: ${hash}`);
        throw new Error(`Invalid transaction hash format received: ${hash}`);
      }
      
      console.log(`✅ Transaction signed successfully! Hash: ${hash}`);
      
      // Update transaction status to submitted with the valid hash
      await updateTransactionStatus(transaction.id, TransactionStatus.SUBMITTED, hash);
      
      // Return the valid transaction hash
      return hash;
    } catch (error: any) {
      // This catch block handles wallet rejection or other wallet-level errors
      console.error('❌ Error during transaction signing:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        transaction: transaction.id
      });
      
      if (error.code === 4001 || error.code === -32603 ||
          (error.message && (
            error.message.includes('reject') || 
            error.message.includes('denied') ||
            error.message.includes('cancel') ||
            error.message.includes('dismissed') ||
            error.message.includes('user declined') ||
            error.message.includes('user denied')
          ))) {
        // User rejected the transaction
        console.log('👨‍💻 Transaction was rejected by user');
        await updateTransactionStatus(transaction.id, TransactionStatus.REJECTED);
        return null;
      }
      
      // Rethrow other errors to be caught by the outer catch block
      throw error;
    }
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
    
    console.log('Creating wallet client with wallet:', {
      type: wallet.walletClientType,
      address: wallet.address,
      hasProvider: !!wallet.provider,
      hasGetEthereumProvider: typeof wallet.getEthereumProvider === 'function'
    });
    
    // Different wallets provide the provider differently
    let provider;
    
    try {
      // Step 1: Try to get the Ethereum provider - this works for most browser extensions
      if (typeof wallet.getEthereumProvider === 'function') {
        console.log('Attempting to get Ethereum provider using wallet.getEthereumProvider()');
        const ethProvider = await wallet.getEthereumProvider();
        
        if (ethProvider) {
          console.log('✅ Retrieved EthereumProvider successfully', {
            hasRequest: !!ethProvider.request,
            hasAccounts: !!ethProvider.getAccounts,
            hasSendAsync: !!ethProvider.sendAsync,
            hasSend: !!ethProvider.send
          });
          provider = ethProvider;
        } else {
          console.warn('⚠️ wallet.getEthereumProvider() returned null or undefined');
        }
      } else {
        console.warn('⚠️ wallet.getEthereumProvider is not a function');
      }
      
      // Step 2: If getEthereumProvider failed, try wallet.provider
      if (!provider && wallet.provider) {
        console.log('Using wallet.provider as fallback');
        provider = wallet.provider;
        
        // Log provider capabilities
        console.log('Wallet.provider capabilities:', {
          hasRequest: !!provider.request,
          hasSend: !!provider.send,
          hasSendAsync: !!provider.sendAsync,
          hasAccounts: !!provider.getAccounts
        });
      }
      
      // Step 3: If both methods failed, try to access the embedded web3 provider
      if (!provider && wallet.walletClientType === 'privy') {
        console.log('Trying to access embedded web3 provider for Privy wallet');
        try {
          // @ts-ignore
          const embeddedProvider = await wallet._embedded?.getEthereumProvider?.();
          if (embeddedProvider) {
            console.log('Retrieved embedded provider');
            provider = embeddedProvider;
          }
        } catch (err) {
          console.warn('Error accessing embedded provider:', err);
        }
      }
      
      // Final check - if we still don't have a provider, throw an error
      if (!provider) {
        throw new Error('No provider available in wallet after all fallback attempts');
      }
    } catch (error) {
      console.error('❌ Error getting ethereum provider:', error);
      throw new Error(`Failed to get provider: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Verify provider has required methods
    if (!provider.request) {
      console.error('❌ Provider missing request method. Provider:', provider);
      throw new Error('Provider is missing required request method. Cannot create wallet client.');
    }

    // Test the provider with a simple request
    try {
      const chainId = await provider.request({ method: 'eth_chainId' });
      console.log('🔗 Provider test successful. Chain ID:', chainId);
    } catch (e) {
      console.warn('⚠️ Provider test failed:', e);
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
      console.log('✅ Wallet client working: retrieved addresses', addresses);
      
      // Test chain access
      const chainId = await walletClient.getChainId();
      console.log('🔗 Chain ID from wallet client:', chainId);
      
      console.log('✅ Wallet client ready for signing transactions');
      return walletClient;
    } catch (error) {
      console.error('❌ Error testing wallet client:', error);
      throw new Error(`Wallet client creation succeeded but testing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    console.error('❌ Error creating wallet client:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      wallet: wallet ? {
        address: wallet.address,
        type: wallet.walletClientType,
        hasProvider: !!wallet.provider,
        hasGetEthereumProvider: typeof wallet.getEthereumProvider === 'function'
      } : 'null'
    });
    return null;
  }
};

/**
 * Poll for pending transactions and process them
 * @param walletClient Viem wallet client with signing capabilities
 */
export const processPendingTransactions = async (
  walletClient: WalletClient, 
  pendingTransactions: PendingTransaction[]
): Promise<ProcessResult> => {
  if (!walletClient || !pendingTransactions.length) {
    return { processed: 0, errors: [] };
  }

  const errors: string[] = [];
  let processed = 0;
  let continueProcessing = true;

  // First, check for any approval that has been confirmed and has a dependent transaction
  // This is a high priority operation
  const approvalCompletedTx = pendingTransactions.find(tx => 
    tx.status === TransactionStatus.CONFIRMED && 
    tx.metadata?.description?.toLowerCase().includes('approval') &&
    pendingTransactions.some(otherTx => 
      otherTx.status === TransactionStatus.APPROVAL_PENDING && 
      otherTx.metadata?.approvalTxId === tx.id
    )
  );

  if (approvalCompletedTx) {
    // Find transactions waiting on this approval
    const dependentTx = pendingTransactions.find(tx => 
      tx.status === TransactionStatus.APPROVAL_PENDING && 
      tx.metadata?.approvalTxId === approvalCompletedTx.id
    );
    
    if (dependentTx) {
      console.log(`Approval transaction ${approvalCompletedTx.id} confirmed, proceeding with dependent transaction ${dependentTx.id}`);
      
      try {
        // Mark the dependent transaction as pending to proceed with it
        await updateTransactionStatus(dependentTx.id, TransactionStatus.PENDING);
        // We'll continue to process this transaction in the regular flow
        continueProcessing = false; // Skip the regular processing flow below
        return { processed: 1, errors: [], message: `Automatically proceeding with transaction after approval` };
      } catch (error) {
        console.error(`Error updating dependent transaction status:`, error);
        errors.push(`Failed to update transaction ${dependentTx.id} status: ${error}`);
      }
    }
  }

  // If we decided to skip normal processing, return early
  if (!continueProcessing) {
    return { processed, errors };
  }
  
  // Process only one pending transaction at a time to avoid overwhelming the user with multiple prompts
  const pendingTx = pendingTransactions.find(tx => tx.status === TransactionStatus.PENDING);
  
  if (pendingTx) {
    try {
      console.log(`Processing transaction ${pendingTx.id}`);
      const { to, value, data } = pendingTx;
      
      // Check if walletClient is connected to the correct account
      // This is necessary as sometimes wallet connections can disconnect
      try {
        const account = await walletClient.getAddresses();
        if (!account || account.length === 0) {
          console.error('Wallet client not connected to any account');
          return { processed: 0, errors: ['Wallet client not connected to any account'] };
        }
      } catch (error) {
        console.error('Error getting wallet addresses:', error);
        return { processed: 0, errors: [`Error getting wallet addresses: ${error}`] };
      }
      
      // Format value to hexadecimal
      const hexValue = value ? BigInt(value) : 0n;
      console.log(`Sending transaction: to=${to}, value=${value}, hexValue=${hexValue}`);
      
      // Update transaction status to submitted
      await updateTransactionStatus(pendingTx.id, TransactionStatus.SUBMITTED);
      
      // Send the transaction with chain: null
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: hexValue,
        data: data as `0x${string}` || undefined,
        account: (await walletClient.getAddresses())[0],
        chain: null,
      });
      
      console.log(`Transaction hash: ${hash}`);
      
      // Update transaction with hash
      await updateTransactionHash(pendingTx.id, hash);
      
      processed++;
      
      return { 
        processed, 
        errors,
        hash,
        txId: pendingTx.id,
        message: `Successfully submitted transaction ${pendingTx.id} with hash ${hash}`
      };
    } catch (error: any) {
      console.error(`Error processing transaction ${pendingTx.id}:`, error);
      
      // Check if the error is a rejection by the user
      if (error.code === 4001 || error.message?.includes('user rejected')) {
        // Mark the transaction as rejected
        await updateTransactionStatus(pendingTx.id, TransactionStatus.REJECTED);
        return { 
          processed: 0, 
          errors: [`Transaction ${pendingTx.id} was rejected by the user`],
          txId: pendingTx.id,
          rejectedByUser: true
        };
      } else {
        // Mark the transaction as failed with other errors
        await updateTransactionStatus(pendingTx.id, TransactionStatus.FAILED);
        errors.push(`Failed to process transaction ${pendingTx.id}: ${error.message || error}`);
      }
    }
  }
  
  return { processed, errors };
};

/**
 * Clear completed transactions after a certain time period
 * This helps keep the transaction list clean in the UI
 */
export const clearCompletedTransactions = async (): Promise<void> => {
  try {
    // Get all pending transactions
    const allTx = await fetch(`${apiUrl}/api/transactions/all`);
    
    if (!allTx.ok) {
      console.warn('Failed to fetch all transactions for cleanup');
      return;
    }
    
    const data = await allTx.json();
    const transactions: PendingTransaction[] = data.transactions || [];
    
    // Find transactions that are completed (confirmed, failed, or rejected)
    // and are older than 10 minutes
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    const toRemove = transactions.filter(tx => 
      (tx.status === TransactionStatus.CONFIRMED || 
       tx.status === TransactionStatus.FAILED ||
       tx.status === TransactionStatus.REJECTED) &&
      (now - (tx.timestamp || new Date(tx.updatedAt).getTime()) > tenMinutes)
    );
    
    if (toRemove.length === 0) {
      return; // Nothing to clean up
    }
    
    console.log(`🧹 Cleaning up ${toRemove.length} completed transactions that are older than 10 minutes`);
    
    // Remove each transaction
    for (const tx of toRemove) {
      try {
        const response = await fetch(`${apiUrl}/api/transactions/${tx.id}/remove`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log(`✅ Removed transaction ${tx.id}`);
        } else {
          console.warn(`⚠️ Failed to remove transaction ${tx.id}`);
        }
      } catch (error) {
        console.error(`Error removing transaction ${tx.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error clearing completed transactions:', error);
  }
};

// Add this function for updating transaction hash
export const updateTransactionHash = async (
  txId: string,
  hash: string
): Promise<void> => {
  try {
    const response = await fetch(`${apiUrl}/api/transactions/${txId}/hash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hash }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update transaction hash: ${errorText}`);
    }

    console.log(`Updated transaction ${txId} with hash ${hash}`);
  } catch (error) {
    console.error('Error updating transaction hash:', error);
    throw error;
  }
};

export const removeCompletedTransactions = async (threshold = 24): Promise<void> => {
  try {
    const now = Date.now();
    const transactions = await getPendingTransactions();
    
    // Filter for completed transactions older than the threshold hours
    const completedIds = transactions
      .filter(tx => 
        (tx.status === TransactionStatus.CONFIRMED || 
         tx.status === TransactionStatus.FAILED || 
         tx.status === TransactionStatus.REJECTED) && 
        (new Date(tx.updatedAt).getTime() < now - threshold * 60 * 60 * 1000)
      )
      .map(tx => tx.id);
    
    if (completedIds.length > 0) {
      // Delete completed transactions
      await fetch(`${apiUrl}/api/transactions/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: completedIds }),
      });
      
      console.log(`Cleared ${completedIds.length} completed transactions`);
    }
  } catch (error) {
    console.error('Error clearing completed transactions:', error);
  }
}; 