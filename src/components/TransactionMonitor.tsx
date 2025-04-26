import React, { useEffect, useState } from 'react';
import { useWallet } from '../providers/WalletContext';
import { useWallets } from '@privy-io/react-auth';
import { 
  getPendingTransactions, 
  processPendingTransactions, 
  createPrivyWalletClient,
  updateTransactionStatus,
  PendingTransaction,
  TransactionStatus,
  switchToceloChain
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
          await switchToceloChain(provider);
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

  // Don't render UI if not connected
  if (!isConnected) return null;

  // Render the transaction monitor UI (minimal)
  return (
    <div className="transaction-monitor" style={{ 
      display: (pendingTransactions.length > 0 || networkError) ? 'block' : 'none',
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '300px',
      padding: '10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '5px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      {networkError && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          marginBottom: '10px',
          borderRadius: '5px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Network Error</div>
          <div>{networkError.replace('Network Error: ', '')}</div>
          <button 
            onClick={ensureCorrectNetwork}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              marginTop: '5px',
              cursor: 'pointer'
            }}
          >
            Switch to Celo
          </button>
        </div>
      )}
      
      {pendingTransactions.length > 0 && (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Pending Transactions</div>
          <ul style={{ padding: '0 0 0 20px', margin: '0' }}>
            {pendingTransactions.map(tx => (
              <li key={tx.id} style={{ marginBottom: '5px' }}>
                {tx.status === 'pending' && 'Waiting for signature...'}
                {tx.status === 'submitted' && 'Transaction submitted...'}
                {tx.status === 'confirmed' && 'Transaction confirmed'}
                {tx.status === 'rejected' && 'Transaction rejected'}
                {tx.status === 'failed' && 'Transaction failed'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 