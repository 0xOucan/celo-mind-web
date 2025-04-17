import React, { useEffect, useState } from 'react';
import { useWallet } from '../providers/WalletContext';
import { useWallets } from '@privy-io/react-auth';
import { 
  getPendingTransactions, 
  processPendingTransactions, 
  createPrivyWalletClient,
  updateTransactionStatus,
  PendingTransaction,
  TransactionStatus
} from '../services/transactionService';

// Polling interval for checking pending transactions
const POLL_INTERVAL = 3000; // 3 seconds

export default function TransactionMonitor() {
  const { connectedAddress, isConnected } = useWallet();
  const { wallets } = useWallets();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<PendingTransaction[]>([]);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Helper to get the primary wallet
  const getPrimaryWallet = () => {
    if (!wallets || wallets.length === 0) return null;
    return wallets[0];
  };

  // Fetch pending transactions from the backend
  const fetchPendingTransactions = async () => {
    if (!isConnected) return;
    
    try {
      const transactions = await getPendingTransactions();
      
      // If new transactions arrived, show a notification
      if (transactions.length > pendingTransactions.length) {
        console.log(`New transactions detected: ${transactions.length - pendingTransactions.length}`);
        // You could add a browser notification here
      }
      
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    }
  };

  // Process pending transactions
  const processTransactions = async () => {
    if (!isConnected || isProcessing) return;
    
    const wallet = getPrimaryWallet();
    if (!wallet) return;

    // Small delay to ensure UI is updated before processing starts
    setTimeout(async () => {
      setIsProcessing(true);
      
      try {
        // Create wallet client for the connected wallet
        console.log('Creating wallet client for connected wallet:', wallet.address);
        const walletClient = await createPrivyWalletClient(wallet);
        
        if (walletClient) {
          console.log('Wallet client created successfully, processing pending transactions...');
          // Process pending transactions
          await processPendingTransactions(walletClient);
          setLastProcessed(new Date());
        } else {
          console.warn('No wallet client available for transaction processing');
        }
      } catch (error) {
        console.error('Error processing transactions:', error);
      } finally {
        setIsProcessing(false);
      }
    }, 500); // Small delay to allow UI to update
  };
  
  // Explicitly reject a transaction
  const rejectTransaction = async (txId: string) => {
    try {
      await updateTransactionStatus(txId, TransactionStatus.REJECTED);
      // Move to history
      const tx = pendingTransactions.find(t => t.id === txId);
      if (tx) {
        setTransactionHistory(prev => [
          {...tx, status: TransactionStatus.REJECTED},
          ...prev
        ]);
      }
      // Remove from pending
      setPendingTransactions(prev => prev.filter(t => t.id !== txId));
    } catch (error) {
      console.error(`Error rejecting transaction ${txId}:`, error);
    }
  };

  // Poll for pending transactions
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial fetch
    fetchPendingTransactions();
    
    // Set up polling
    const pollInterval = setInterval(() => {
      fetchPendingTransactions();
    }, POLL_INTERVAL);
    
    return () => clearInterval(pollInterval);
  }, [isConnected]);

  // Process transactions when they are found
  useEffect(() => {
    if (pendingTransactions.length > 0 && !isProcessing) {
      processTransactions();
    }
  }, [pendingTransactions, isProcessing]);

  // Only render if there are pending transactions or history to show
  if (pendingTransactions.length === 0 && transactionHistory.length === 0) return null;

  // Format amount display for better readability
  const formatAmount = (value: string): string => {
    try {
      const amount = parseFloat(value) / 1e18;
      return amount.toFixed(amount < 0.01 ? 6 : 4);
    } catch (e) {
      return "0";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 border border-yellow-200 dark:border-slate-700 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 dark:text-white">Transactions</h3>
        <div className="flex items-center gap-2">
          {pendingTransactions.length > 0 && (
            <div className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-full">
              {pendingTransactions.length} pending
            </div>
          )}
          {transactionHistory.length > 0 && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
          )}
          {isProcessing && (
            <div className="flex items-center">
              <svg className="animate-spin h-4 w-4 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {pendingTransactions.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Pending</h4>
          {pendingTransactions.map((tx) => (
            <div key={tx.id} className="p-3 bg-yellow-50 dark:bg-slate-700 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="font-mono text-xs truncate">To: {tx.to.slice(0, 6)}...{tx.to.slice(-6)}</div>
                <div className="text-xs px-2 py-1 bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                  {tx.status}
                </div>
              </div>
              <div className="text-sm mt-1 font-medium">{formatAmount(tx.value)} ETH</div>
              
              {/* Additional transaction info */}
              {tx.data && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Contract interaction: {tx.data.length} bytes
                </div>
              )}
              
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Transaction ID: {tx.id.slice(0, 10)}...
              </div>
              
              <div className="flex justify-between mt-2">
                <div className="text-xs text-blue-500">
                  {isProcessing ? 'Waiting for wallet...' : 'Ready to sign'}
                </div>
                <button
                  onClick={() => rejectTransaction(tx.id)}
                  className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-800/40 text-red-800 dark:text-red-300 rounded"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showHistory && transactionHistory.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto border-t border-gray-200 dark:border-slate-700 pt-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">History</h4>
          {transactionHistory.map((tx) => (
            <div key={tx.id} className="p-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="font-mono text-xs truncate">{tx.to.slice(0, 6)}...{tx.to.slice(-6)}</div>
                <div className={`text-xs px-2 py-1 rounded-full ${
                  tx.status === TransactionStatus.CONFIRMED ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
                  tx.status === TransactionStatus.REJECTED ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200' :
                  'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-gray-200'
                }`}>
                  {tx.status}
                </div>
              </div>
              <div className="text-sm mt-1">{formatAmount(tx.value)} ETH</div>
              {tx.hash && (
                <a 
                  href={`https://celoscan.io/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                >
                  View on Explorer
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      
      {lastProcessed && (
        <div className="mt-2 text-xs text-center text-slate-500">
          Last checked: {lastProcessed.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
} 