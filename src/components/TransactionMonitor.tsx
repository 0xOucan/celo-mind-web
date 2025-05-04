import React, { useEffect, useState } from 'react';
import { useWallet } from '../providers/WalletContext';
import { useWallets } from '@privy-io/react-auth';
import { TransactionStatus } from '../constants/network';
import { 
  getPendingTransactions, 
  processPendingTransactions, 
  createPrivyWalletClient,
  updateTransactionStatus,
  PendingTransaction,
  switchToCeloChain,
  switchToChain,
  executeTransaction
} from '../services/transactionService';

// Polling interval for checking pending transactions
const POLL_INTERVAL = 3000; // 3 seconds
// How long to keep completed transactions visible (5 minutes)
const KEEP_COMPLETED_FOR_MS = 5 * 60 * 1000;

export default function TransactionMonitor() {
  const { connectedAddress, isConnected } = useWallet();
  const { wallets } = useWallets();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<PendingTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [forceVisible, setForceVisible] = useState(false);

  // Helper to get the primary wallet
  const getPrimaryWallet = () => {
    if (!wallets || wallets.length === 0) return null;
    return wallets[0];
  };

  // Format transaction hash for display
  const formatTxHash = (hash: string | undefined): string => {
    if (!hash) return 'Pending...';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Get blockchain explorer link for a transaction
  const getExplorerLink = (tx: PendingTransaction): string => {
    if (!tx.hash) return '#';
    
    // Determine which explorer to use based on chain
    const chain = tx.metadata?.chain || 'celo';
    
    switch(chain) {
      case 'base':
        return `https://basescan.org/tx/${tx.hash}`;
      case 'arbitrum':
        return `https://arbiscan.io/tx/${tx.hash}`;
      case 'mantle':
        return `https://explorer.mantle.xyz/tx/${tx.hash}`;
      case 'zksync':
        return `https://explorer.zksync.io/tx/${tx.hash}`;
      case 'celo':
      default:
        return `https://celoscan.io/tx/${tx.hash}`;
    }
  };

  // Get explorer name based on chain
  const getExplorerName = (tx: PendingTransaction): string => {
    const chain = tx.metadata?.chain || 'celo';
    
    switch(chain) {
      case 'base':
        return 'Basescan';
      case 'arbitrum':
        return 'Arbiscan';
      case 'mantle':
        return 'Mantle Explorer';
      case 'zksync':
        return 'zkSync Explorer';
      case 'celo':
      default:
        return 'Celoscan';
    }
  };

  // Switch to the correct network based on the transaction's chain
  const ensureCorrectNetwork = async (transaction?: PendingTransaction) => {
    if (!isConnected) return;
    
    try {
      setNetworkError(null);
      const wallet = getPrimaryWallet();
      if (!wallet) return;
      
      // Determine which chain to use
      let targetChain: 'celo' | 'base' | 'arbitrum' | 'mantle' | 'zksync' = 'celo'; // Default to Celo
      
      if (transaction?.metadata?.chain) {
        // Use the chain from transaction metadata if available
        targetChain = transaction.metadata.chain as 'celo' | 'base' | 'arbitrum' | 'mantle' | 'zksync';
      }
      
      try {
        const provider = await wallet.getEthereumProvider();
        if (provider) {
          await switchToChain(provider, targetChain);
          console.log(`Network verified for ${targetChain.toUpperCase()} transactions`);
        } else {
          console.warn('Could not get provider to switch networks');
        }
      } catch (error) {
        console.error(`Error switching to ${targetChain} network:`, error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error switching networks';
        setNetworkError(`Network Error: ${errMsg}`);
      }
    } catch (error) {
      console.error('Error in ensureCorrectNetwork:', error);
    }
  };

  // Fetch pending transactions from the backend
  const fetchPendingTransactions = async () => {
    if (!isConnected) return;
    
    try {
      const transactions = await getPendingTransactions();
      console.log('Fetched transactions:', transactions);
      
      // If new transactions arrived, show a notification
      if (transactions.length > pendingTransactions.length) {
        console.log(`New transactions detected: ${transactions.length - pendingTransactions.length}`);
        // Force the UI to be visible when new transactions arrive
        setForceVisible(true);
        setIsMinimized(false);
        
        // Try to switch to the right network for the newest transaction
        if (transactions.length > 0) {
          const newestTransaction = transactions[transactions.length - 1];
          ensureCorrectNetwork(newestTransaction);
        }
      }
      
      // Move completed transactions to completedTransactions
      const currentTime = Date.now();
      const newCompletedTxs: PendingTransaction[] = [];
      
      // Check for any transactions that were previously pending but are now confirmed
      pendingTransactions.forEach(oldTx => {
        const updatedTx = transactions.find(tx => tx.id === oldTx.id);
        
        // If the transaction was previously pending but is now confirmed/failed/rejected
        if (updatedTx && 
            (oldTx.status === 'pending' || oldTx.status === 'submitted') && 
            (updatedTx.status === 'confirmed' || updatedTx.status === 'failed' || updatedTx.status === 'rejected')) {
          // Ensure the timestamp is properly set
          updatedTx.timestamp = updatedTx.timestamp || currentTime;
          newCompletedTxs.push(updatedTx);
          console.log('Moving transaction to completed:', updatedTx);
        }
      });
      
      // Add new completed transactions
      if (newCompletedTxs.length > 0) {
        setCompletedTransactions(prev => {
          // Filter out expired completed transactions (older than KEEP_COMPLETED_FOR_MS)
          const filteredPrev = prev.filter(tx => 
            currentTime - (tx.timestamp || 0) < KEEP_COMPLETED_FOR_MS
          );
          
          // Add new completed transactions
          return [...filteredPrev, ...newCompletedTxs];
        });
      }
      
      // Update pending transactions - only include actual pending ones
      setPendingTransactions(transactions.filter(tx => 
        tx.status === 'pending' || tx.status === 'submitted'
      ));

      // Log current state of transactions for debugging
      console.log('Current pending transactions:', pendingTransactions.length);
      console.log('Current completed transactions:', completedTransactions.length);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    }
  };

  // Process pending transactions with the wallet
  const processTransactions = async () => {
    if (!isConnected || isProcessing) return;
    
    try {
      setIsProcessing(true);
      const wallet = getPrimaryWallet();
      
      if (!wallet) {
        console.warn('No wallet available for transaction processing');
        return;
      }
      
      console.log('👛 Creating wallet client for connected wallet:', connectedAddress);
      
      try {
        // Get provider to check current chain before creating wallet client
        const provider = await wallet.getEthereumProvider();
        if (provider) {
          const chainId = await provider.request({ method: 'eth_chainId' });
          console.log('Wallet currently on chain ID:', chainId);
        }
      } catch (e) {
        console.error('Error checking current chain:', e);
      }
      
      const walletClient = await createPrivyWalletClient(wallet);
      
      if (!walletClient) {
        console.error('Failed to create wallet client');
        return;
      }
      
      console.log('🚀 Wallet client created successfully, processing pending transactions...');
      
      try {
        // Get pending transactions
        const pendingTxs = await getPendingTransactions();
        console.log('Pending transactions to process:', pendingTxs.length);
        
        if (pendingTxs.length === 0) {
          console.log('No pending transactions to process');
          return;
        }
        
        // Process only one transaction at a time to ensure proper wallet interaction
        for (const tx of pendingTxs) {
          if (tx.status === 'pending') {
            console.log(`Processing transaction ${tx.id} targeting chain ${tx.metadata?.chain || 'unknown'}`);
            console.log(`Transaction details: to=${tx.to}, value=${tx.value}, data=${tx.data ? tx.data.substring(0, 20) + '...' : 'none'}`);
            
            // Ensure we're on the right network for this transaction
            await ensureCorrectNetwork(tx);
            
            // Execute this specific transaction
            try {
              const hash = await executeTransaction(tx, walletClient);
              console.log(`✅ Transaction executed with hash: ${hash}`);
              // Only process one transaction, then break
              break;
            } catch (txError) {
              console.error(`Failed to execute transaction ${tx.id}:`, txError);
              // Continue to next transaction if this one fails
              continue;
            }
          }
        }
        
        setLastProcessed(new Date());
      } catch (error) {
        console.error('Error processing transactions:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error processing transactions';
        
        // Handle network-related errors
        if (errMsg.includes('network') || errMsg.includes('chain')) {
          setNetworkError(`Network Error: ${errMsg}`);
        }
      }
    } catch (error) {
      console.error('Error in transaction processing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Polling for pending transactions
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial check
    fetchPendingTransactions();
    
    // Set up polling
    const intervalId = setInterval(fetchPendingTransactions, POLL_INTERVAL);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [isConnected, connectedAddress]);
  
  // Process transactions when they arrive
  useEffect(() => {
    if (pendingTransactions.length > 0 && !isProcessing) {
      processTransactions();
    }
  }, [pendingTransactions, isProcessing]);

  // Clean up completed transactions periodically
  useEffect(() => {
    const cleanup = () => {
      const currentTime = Date.now();
      setCompletedTransactions(prev => 
        prev.filter(tx => {
          // Ensure timestamp exists, default to current time if missing
          const txTime = tx.timestamp || currentTime;
          return currentTime - txTime < KEEP_COMPLETED_FOR_MS;
        })
      );
    };
    
    const intervalId = setInterval(cleanup, 60000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, []);

  // Reset force visibility after some time
  useEffect(() => {
    if (forceVisible) {
      const timer = setTimeout(() => {
        setForceVisible(false);
      }, 10000); // Reset after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [forceVisible]);

  // Don't render UI if not connected and there are no transactions or errors
  if (!isConnected && (pendingTransactions.length === 0 && completedTransactions.length === 0 && !networkError) && !forceVisible) return null;

  // Count total transactions
  const totalTransactions = pendingTransactions.length + completedTransactions.length;

  // If no transactions and no errors, show a simple message in minimized state
  const hasNoContent = totalTransactions === 0 && !networkError && !forceVisible;

  // Render the transaction monitor UI
  return (
    <div className={`fixed bottom-4 right-4 w-72 bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 z-50 overflow-hidden transition-all duration-300 ${forceVisible ? 'opacity-100' : ''}`}>
      <div 
        className="p-3 bg-slate-700 border-b border-slate-600 font-medium flex justify-between items-center cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center">
          <span>Transaction Status</span>
          {totalTransactions > 0 && (
            <span className="ml-2 bg-yellow-500 text-xs font-medium px-2 py-0.5 rounded-full">
              {totalTransactions}
            </span>
          )}
        </div>
        <div>
          {isMinimized ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </div>
      </div>
      
      {!isMinimized && (
        <>
      {networkError && (
        <div className="p-3 bg-red-900 border-b border-red-800">
          <div className="font-medium mb-1">Network Error</div>
          <div className="text-sm text-red-200 mb-2">{networkError.replace('Network Error: ', '')}</div>
          <button 
            onClick={async () => {
              // Check if there are pending transactions
              const pendingTxs = await getPendingTransactions();
              
              // Find the first pending transaction to determine which network to switch to
              const firstPendingTx = pendingTxs.find(tx => tx.status === 'pending');
              
              if (firstPendingTx) {
                ensureCorrectNetwork(firstPendingTx);
              } else {
                // Default to Base if no transactions pending
                const wallet = getPrimaryWallet();
                if (wallet) {
                  try {
                    const provider = await wallet.getEthereumProvider();
                    if (provider) {
                      await switchToChain(provider, 'base');
                    }
                  } catch (error) {
                    console.error('Error switching to Base:', error);
                  }
                }
              }
            }}
            className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Switch Network
          </button>
        </div>
      )}
      
          {hasNoContent ? (
            <div className="p-4 text-center text-gray-400">
              No transactions to display
            </div>
          ) : (
            <div className="p-3 max-h-80 overflow-y-auto">
      {pendingTransactions.length > 0 && (
                <div className="mb-2">
                  <div className="text-sm font-medium mb-2">Pending Transactions</div>
          {pendingTransactions.map(tx => (
            <div key={tx.id} className="mb-3 last:mb-0 bg-slate-700 p-2 rounded">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-slate-400">
                  ID: {tx.id.slice(0, 10)}...
                </div>
                <div className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${tx.status === 'pending' ? 'bg-yellow-500 text-yellow-900' : 
                    tx.status === 'submitted' ? 'bg-blue-500 text-blue-900' : 
                    'bg-slate-500 text-slate-900'}
                `}>
                  {tx.status}
                </div>
              </div>
              
              <div className="text-sm mb-1">
                {tx.status === 'pending' && 'Waiting for wallet signature...'}
                {tx.status === 'submitted' && 'Transaction submitted to blockchain...'}
                      </div>
                      
                      <div className="text-xs text-slate-400 mb-1">
                        To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                      </div>
                      
                      {/* Display transaction hash with link when available */}
                      {tx.hash && (
                        <div className="text-xs mt-1">
                          <a 
                            href={getExplorerLink(tx)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center"
                          >
                            <span className="mr-1">🔍</span>
                            <span className="underline">{getExplorerName(tx)}: {formatTxHash(tx.hash)}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              )}
              
              {/* Show completed transactions */}
              {completedTransactions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">
                    {pendingTransactions.length > 0 ? 'Completed Transactions' : 'Transaction History'}
                  </div>
                  
                  {completedTransactions.map(tx => (
                    <div key={tx.id} className="mb-3 last:mb-0 bg-slate-700 p-2 rounded opacity-80">
                      <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-slate-400">
                          {new Date(tx.timestamp || Date.now()).toLocaleTimeString()}
                        </div>
                        <div className={`
                          text-xs px-2 py-0.5 rounded-full
                          ${tx.status === 'confirmed' ? 'bg-green-500 text-green-900' :
                            tx.status === 'failed' ? 'bg-red-500 text-red-900' :
                            tx.status === 'rejected' ? 'bg-orange-500 text-orange-900' :
                            'bg-slate-500 text-slate-900'}
                        `}>
                          {tx.status}
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-400 mb-1">
                To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
              </div>
                      
                      {/* Display transaction hash with link when available */}
                      {tx.hash && (
                        <div className="text-xs">
                          <a 
                            href={getExplorerLink(tx)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center"
                          >
                            <span className="mr-1">🔍</span>
                            <span className="underline">{getExplorerName(tx)}: {formatTxHash(tx.hash)}</span>
                          </a>
                        </div>
                      )}
            </div>
          ))}
        </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 