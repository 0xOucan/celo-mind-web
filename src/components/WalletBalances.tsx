import React, { useEffect, useState } from 'react';
import { WalletIcon, LoadingIcon } from './Icons';
import { getAllTokenBalances, TokenBalance } from '../services/blockchainService';
import { DEFAULT_WALLET_ADDRESS } from '../config';
import { useWallet } from '../providers/WalletContext';

export default function WalletBalances() {
  const { connectedAddress, isConnected } = useWallet();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState<string>('$0.00');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>(DEFAULT_WALLET_ADDRESS);

  const fetchBalances = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use connected wallet address from context if available
      const address = connectedAddress || DEFAULT_WALLET_ADDRESS;
      setWalletAddress(address);
      
      console.log('Fetching balances for address:', address);
      
      // Fetch balances directly from the blockchain using viem
      const tokenBalances = await getAllTokenBalances(address);
      
      if (tokenBalances.length > 0) {
        // Calculate total value
        const total = tokenBalances.reduce(
          (sum, token) => sum + Number(token.balanceUsd.replace('$', '')), 
          0
        );
        
        setBalances(tokenBalances);
        setTotalValue(`$${total.toFixed(2)}`);
        setLastUpdated(new Date());
      } else {
        setError('Could not retrieve any token balances.');
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Failed to fetch wallet balances. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch balances when connected wallet changes
  useEffect(() => {
    if (connectedAddress !== walletAddress) {
      fetchBalances();
    }
  }, [connectedAddress]);

  // Fetch balances on component mount
  useEffect(() => {
    fetchBalances();
    
    // Optional: Set up a refresh interval
    const interval = setInterval(fetchBalances, 5 * 60 * 1000); // Refresh every 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Function to shorten wallet address for display
  const shortenAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 bg-yellow-100 dark:bg-slate-700 border-b border-yellow-200 dark:border-slate-600 flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center">
          <WalletIcon className="w-5 h-5 mr-2" />
          Wallet Balances
        </h2>
        
        <button 
          onClick={fetchBalances}
          disabled={isLoading}
          className="p-1.5 rounded-md hover:bg-yellow-200 dark:hover:bg-slate-600 transition-colors"
          title="Refresh balances"
        >
          {isLoading ? (
            <LoadingIcon className="w-4 h-4" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="p-4">
        {isLoading && balances.length === 0 ? (
          <div className="py-4 flex justify-center">
            <LoadingIcon className="w-6 h-6" />
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400 text-center py-2">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 px-3 py-2 bg-yellow-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Connected Wallet</div>
              <a 
                href={`https://celoscan.io/address/${walletAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 font-mono text-sm hover:underline"
                title={walletAddress}
              >
                {shortenAddress(walletAddress)}
              </a>
            </div>
            
            <div className="space-y-3">
              {balances.map((token, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{token.icon}</span>
                    <div>
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{token.balanceFormatted}</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{token.balanceUsd}</div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-3 bg-yellow-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Portfolio Value</div>
              <div className="text-2xl font-bold">{totalValue}</div>
            </div>
            
            {lastUpdated && (
              <div className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 