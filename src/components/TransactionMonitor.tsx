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
  switchToCeloChain
} from '../services/transactionService';

// Polling interval for checking pending transactions
const POLL_INTERVAL = 3000; // 3 seconds

export default function TransactionMonitor() {
  const { connectedAddress, isConnected } = useWallet();
  const { wallets } = useWallets();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Helper to get the primary wallet
  const getPrimaryWallet = () => {
    if (!wallets || wallets.length === 0) return null;
    return wallets[0];
  };

  // Switch to Celo network if needed
  const ensureCorrectNetwork = async () => {
    if (!isConnected) return;
    
    try {
      setNetworkError(null);
      const wallet = getPrimaryWallet();
      if (!wallet) return;
      
      try {
        const provider = await wallet.getEthereumProvider();
        if (provider) {
          await switchToCeloChain(provider);
          console.log('Network verified for Celo transactions');
        } else {
          console.warn('Could not get provider to switch networks');
        }
      } catch (error) {
        console.error('Error switching to Celo network:', error);
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
      
      // If new transactions arrived, show a notification
      if (transactions.length > pendingTransactions.length) {
        console.log(`New transactions detected: ${transactions.length - pendingTransactions.length}`);
        // Try to switch to Celo network whenever new transactions arrive
        ensureCorrectNetwork();
      }
      
      setPendingTransactions(transactions);
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
      const walletClient = await createPrivyWalletClient(wallet);
      
      if (!walletClient) {
        console.error('Failed to create wallet client');
        return;
      }
      
      console.log('🚀 Wallet client created successfully, processing pending transactions...');
      
      try {
        await processPendingTransactions(walletClient);
        setLastProcessed(new Date());
      } catch (error) {
        console.error('Error processing transactions:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error processing transactions';
        
        // Handle network-related errors
        if (errMsg.includes('network') || errMsg.includes('chain') || errMsg.includes('Celo')) {
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

  // Don't render UI if not connected or no transactions or errors
  if (!isConnected || (pendingTransactions.length === 0 && !networkError)) return null;

  // Render the transaction monitor UI
  return (
    <div className="fixed bottom-4 right-4 w-72 bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 z-50 overflow-hidden">
      <div className="p-3 bg-slate-700 border-b border-slate-600 font-medium">
        Transaction Status
      </div>
      
      {networkError && (
        <div className="p-3 bg-red-900 border-b border-red-800">
          <div className="font-medium mb-1">Network Error</div>
          <div className="text-sm text-red-200 mb-2">{networkError.replace('Network Error: ', '')}</div>
          <button 
            onClick={ensureCorrectNetwork}
            className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Switch to Celo
          </button>
        </div>
      )}
      
      {pendingTransactions.length > 0 && (
        <div className="p-3">
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
                    tx.status === 'confirmed' ? 'bg-green-500 text-green-900' :
                    tx.status === 'failed' ? 'bg-red-500 text-red-900' :
                    'bg-slate-500 text-slate-900'}
                `}>
                  {tx.status}
                </div>
              </div>
              
              <div className="text-sm mb-1">
                {tx.status === 'pending' && 'Waiting for wallet signature...'}
                {tx.status === 'submitted' && 'Transaction submitted to blockchain...'}
                {tx.status === 'confirmed' && 'Transaction confirmed!'}
                {tx.status === 'rejected' && 'Transaction rejected by user'}
                {tx.status === 'failed' && 'Transaction failed to process'}
              </div>
              
              <div className="text-xs text-slate-400">
                To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 