import React, { useEffect, useState } from 'react';
import { useWallet } from '../providers/WalletContext';
import { 
  getPendingTransactions, 
  executeTransaction, 
  updateTransactionStatus,
  createPrivyWalletClient,
  clearCompletedTransactions,
  PendingTransaction,
  TransactionStatus
} from '../services/transactionService';
import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';
import styles from '../styles/TransactionMonitor.module.css';

export default function TransactionMonitor() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [walletClient, setWalletClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { connectedAddress, isConnected, wallets } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    const initWalletClient = async () => {
      if (wallets && wallets.length > 0 && isConnected) {
        try {
          const client = await createPrivyWalletClient(wallets[0]);
          setWalletClient(client);
        } catch (error) {
          console.error('Error initializing wallet client:', error);
        }
      }
    };

    initWalletClient();
  }, [wallets, isConnected]);

  // Fetch pending transactions from the backend
  useEffect(() => {
    if (!connectedAddress) return;

    const fetchTransactions = async () => {
      try {
        const transactions = await getPendingTransactions();
        setPendingTransactions(transactions);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Error fetching pending transactions:', error);
        setError(`Failed to fetch transactions: ${(error as Error).message}`);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000); // Poll every 5 seconds instead of 10

    return () => clearInterval(interval);
  }, [connectedAddress, refreshKey]);

  // Check transaction status for submitted transactions
  useEffect(() => {
    if (!connectedAddress || pendingTransactions.length === 0 || isChecking) return;
    
    const checkTransactions = async () => {
      setIsChecking(true);
      try {
        const publicClient = createPublicClient({
          chain: celo,
          transport: http()
        });
        
        let hasApprovalCompleted = false;
        
        for (const tx of pendingTransactions) {
          // Only check submitted transactions with valid hashes
          if (tx.status === TransactionStatus.SUBMITTED && tx.hash && tx.hash.startsWith('0x') && tx.hash.length === 66) {
            try {
              // First check if the transaction is mined by getting the transaction data
              const transaction = await publicClient.getTransaction({ 
                hash: tx.hash as `0x${string}` 
              });
              
              // If we found the transaction but it doesn't have a blockNumber yet, it's still pending
              if (transaction && !transaction.blockNumber) {
                console.log(`Transaction ${tx.hash} is still pending in the mempool`);
                continue;
              }
              
              // Now get the receipt which tells us if it succeeded or failed
              const receipt = await publicClient.getTransactionReceipt({ 
                hash: tx.hash as `0x${string}` 
              });
              
              if (receipt) {
                console.log(`📝 Transaction ${tx.hash} receipt:`, {
                  status: receipt.status,
                  blockNumber: receipt.blockNumber.toString(),
                  gasUsed: receipt.gasUsed.toString(),
                  transactionIndex: receipt.transactionIndex
                });
                
                if (receipt.status === 'success') {
                  console.log(`✅ Transaction ${tx.hash} confirmed successfully`);
                  await updateTransactionStatus(tx.id, TransactionStatus.CONFIRMED);
                  setPendingTransactions(prev => 
                    prev.map(t => t.id === tx.id ? { ...t, status: TransactionStatus.CONFIRMED } : t)
                  );
                  
                  // Check if this was an approval transaction
                  const isApproval = tx.data?.startsWith('0x095ea7b3') || tx.data?.startsWith('0x39509351');
                  if (isApproval) {
                    console.log(`🔑 Approval transaction ${tx.id} confirmed - checking for dependent transactions`);
                    hasApprovalCompleted = true;
                  }
                } else {
                  console.error(`❌ Transaction ${tx.hash} failed on-chain`);
                  await updateTransactionStatus(tx.id, TransactionStatus.FAILED);
                  setPendingTransactions(prev => 
                    prev.map(t => t.id === tx.id ? { ...t, status: TransactionStatus.FAILED } : t)
                  );
                }
              }
            } catch (error: any) {
              // Only log specific errors, not the "receipt not found" errors which are expected
              if (error.message && !error.message.includes('receipt not found')) {
                console.warn(`Error checking transaction ${tx.hash}:`, error);
              } else {
                console.log(`Still waiting for receipt for transaction ${tx.hash.substring(0, 10)}...`);
              }
            }
          }
        }
        
        // If we detected a completed approval, check if we need to trigger any pending operations
        if (hasApprovalCompleted) {
          checkForDependentTransactions();
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
      } finally {
        setIsChecking(false);
      }
    };
    
    // Helper function to find and process dependent transactions
    const checkForDependentTransactions = () => {
      console.log('📣 Checking for transactions waiting on approvals...');
      
      // Get all completed approval transactions
      const confirmedApprovals = pendingTransactions.filter(tx => 
        tx.status === TransactionStatus.CONFIRMED && 
        (tx.data?.startsWith('0x095ea7b3') || tx.data?.startsWith('0x39509351'))
      );
      
      if (confirmedApprovals.length > 0) {
        console.log(`Found ${confirmedApprovals.length} confirmed approval transactions`);
        
        // For each pending transaction, check if it's waiting for an approval
        const pendingTxs = pendingTransactions.filter(tx => tx.status === TransactionStatus.PENDING);
        for (const pendingTx of pendingTxs) {
          // Only continue if there's a corresponding confirmed approval for the same token
          // Check if the transaction involves the same token contract
          const approvalMatch = confirmedApprovals.find(approval => {
            return approval.to === pendingTx.to || // Same token contract
                  (approval.data && pendingTx.data && // Same token involved in the operation
                   approval.data.substring(10, 74) === pendingTx.data.substring(10, 74));
          });
          
          if (approvalMatch) {
            console.log(`✨ Found pending transaction ${pendingTx.id} that can proceed now that approval ${approvalMatch.id} is confirmed`);
            setRefreshKey(prev => prev + 1); // Refresh to trigger processPendingTransactions
            return; // Only handle one at a time
          }
        }
      }
    };
    
    checkTransactions();
    const interval = setInterval(checkTransactions, 3000); // Check every 3 seconds for better responsiveness
    
    return () => clearInterval(interval);
  }, [connectedAddress, pendingTransactions, isChecking]);

  // Process pending transactions
  useEffect(() => {
    if (!walletClient || !connectedAddress || isProcessing || pendingTransactions.length === 0) {
      return;
    }

    const processPendingTransactions = async () => {
      setIsProcessing(true);
      setError(null);

      // Find the first pending transaction that hasn't been submitted yet
      // Prioritize approval transactions first
      const approvalTx = pendingTransactions.find(tx => 
        tx.status === TransactionStatus.PENDING && 
        tx.data && (tx.data.startsWith('0x095ea7b3') || tx.data.startsWith('0x39509351'))
      );
      
      // Use approval tx if found, otherwise use first pending tx
      const pendingTx = approvalTx || pendingTransactions.find(tx => tx.status === TransactionStatus.PENDING);
      
      if (pendingTx) {
        try {
          const isPriority = !!approvalTx;
          console.log(`🔄 Processing ${isPriority ? 'PRIORITY ' : ''}transaction ${pendingTx.id}`);
          
          const hash = await executeTransaction(pendingTx, walletClient);
          
          if (hash) {
            console.log(`✅ Transaction submitted with hash: ${hash}`);
            setPendingTransactions(prev => 
              prev.map(tx => 
                tx.id === pendingTx.id ? { ...tx, status: TransactionStatus.SUBMITTED, hash } : tx
              )
            );
          } else {
            // Transaction was rejected or failed - this is handled by executeTransaction
            setRefreshKey(prev => prev + 1); // Force refresh to get latest status
          }
        } catch (error) {
          console.error('Error executing transaction:', error);
          setError(`Transaction failed: ${(error as Error).message}`);
          
          try {
            await updateTransactionStatus(pendingTx.id, TransactionStatus.FAILED);
          } catch (updateError) {
            console.error('Error updating transaction status:', updateError);
          }
        }
      }
      
      setIsProcessing(false);
    };

    processPendingTransactions();
  }, [walletClient, connectedAddress, pendingTransactions, isProcessing]);

  const handleReject = async (txId: string) => {
    try {
      await updateTransactionStatus(txId, TransactionStatus.REJECTED);
      setRefreshKey(prev => prev + 1); // Force refresh
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      setError(`Failed to reject: ${(error as Error).message}`);
    }
  };

  const getExplorerLink = (hash?: string) => {
    if (!hash) return '';
    const baseUrl = process.env.NEXT_PUBLIC_CELOSCAN_URL || 'https://explorer.celo.org/mainnet';
    return `${baseUrl}/tx/${hash}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case TransactionStatus.PENDING:
        return '⏳';
      case TransactionStatus.SUBMITTED:
        return '🔄';
      case TransactionStatus.CONFIRMED:
        return '✅';
      case TransactionStatus.FAILED:
        return '❌';
      case TransactionStatus.REJECTED:
        return '🚫';
      default:
        return '❓';
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatValue = (value?: string) => {
    if (!value) return '0';
    return parseFloat(value || '0').toFixed(4);
  };

  // Periodically clean up completed transactions
  useEffect(() => {
    if (!connectedAddress) return;

    const cleanup = async () => {
      try {
        if (isCleaning) return;
        setIsCleaning(true);
        await clearCompletedTransactions();
        setIsCleaning(false);
      } catch (error) {
        console.error('Error cleaning up transactions:', error);
        setIsCleaning(false);
      }
    };

    // Run cleanup every 5 minutes
    const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
    
    // Run once on mount
    cleanup();
    
    return () => clearInterval(cleanupInterval);
  }, [connectedAddress, isCleaning]);

  // Check if there are any dependent transactions to process after an approval completes
  useEffect(() => {
    if (!walletClient || isLoading) return;

    const completedApprovals = pendingTransactions.filter(
      tx => 
        tx.status === TransactionStatus.CONFIRMED && 
        (tx.data?.startsWith('0x095ea7b3') || tx.data?.startsWith('0x39509351'))
    );

    if (completedApprovals.length === 0) return;

    console.log('Found completed approvals that may have dependent transactions:', completedApprovals);
    
    // Find any pending transactions that might be related to these approvals
    const pendingTxs = pendingTransactions.filter(tx => tx.status === TransactionStatus.PENDING);
    
    for (const pendingTx of pendingTxs) {
      for (const approvalTx of completedApprovals) {
        // Check if this pending tx is related to the approval (same token contract or same token data)
        const isRelated = 
          approvalTx.to === pendingTx.to || // Same token contract
          (approvalTx.data && pendingTx.data && 
           approvalTx.data.substring(10, 74) === pendingTx.data.substring(10, 74)); // Same token involved 
        
        if (isRelated) {
          console.log(`🔄 Processing transaction ${pendingTx.id} that depends on completed approval ${approvalTx.id}`);
          executeTransaction(pendingTx, walletClient)
            .then(hash => {
              if (hash) {
                console.log(`✅ Auto-processed dependent transaction with hash: ${hash}`);
              }
            })
            .catch(err => {
              console.error(`Error auto-processing dependent transaction:`, err);
            });
          
          // Only process one transaction at a time
          return;
        }
      }
    }
  }, [pendingTransactions, walletClient, isLoading]);

  return (
    <div className={styles.transactionMonitor}>
      <h2>Transactions</h2>
      <div className={styles.refreshInfo}>
        Last checked: {lastRefresh.toLocaleTimeString()} 
        {isChecking && <span className={styles.checking}> (checking...)</span>}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      
      {pendingTransactions.length === 0 ? (
        <div className={styles.noTransactions}>No pending transactions</div>
      ) : (
        <ul className={styles.transactionList}>
          {pendingTransactions.map((tx) => (
            <li key={tx.id} className={`${styles.transaction} ${styles[tx.status]}`}>
              <div className={styles.txHeader}>
                <span className={styles.status}>
                  {getStatusIcon(tx.status)} {tx.status.toUpperCase()}
                </span>
                <span className={styles.time}>{formatTime(tx.timestamp)}</span>
              </div>
              
              <div className={styles.txDetails}>
                <div>Value: {formatValue(tx.value)}</div>
                <div className={styles.address}>To: {tx.to.substring(0, 10)}...{tx.to.substring(tx.to.length - 8)}</div>
                
                {tx.status === TransactionStatus.PENDING && (
                  <button 
                    className={styles.rejectButton}
                    onClick={() => handleReject(tx.id)}
                    disabled={isProcessing}
                  >
                    Reject
                  </button>
                )}
                
                {tx.hash && tx.hash.startsWith('0x') && tx.hash.length === 66 ? (
                  <div className={styles.txActions}>
                    <a 
                      href={getExplorerLink(tx.hash)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.viewLink}
                    >
                      View on Explorer
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tx.hash || '');
                        alert('Transaction hash copied to clipboard!');
                      }}
                      className={styles.copyButton}
                      title="Copy transaction hash"
                    >
                      Copy Hash
                    </button>
                  </div>
                ) : tx.status !== TransactionStatus.PENDING && (
                  <div className={styles.hashPending}>
                    {tx.status === TransactionStatus.SUBMITTED ? 'Waiting for hash...' : 'No transaction hash available'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 