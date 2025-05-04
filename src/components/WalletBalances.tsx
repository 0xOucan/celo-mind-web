import React, { useEffect, useState } from 'react';
import { WalletIcon, LoadingIcon, CoinIcon } from './Icons';
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
    <div className="bg-mictlai-obsidian border-3 border-mictlai-gold shadow-pixel-lg pixel-panel">
      <div className="p-4 bg-black border-b-3 border-mictlai-gold/70 flex justify-between items-center">
        <h2 className="text-lg font-bold flex items-center font-pixel text-mictlai-gold">
          <CoinIcon className="w-5 h-5 mr-2" />
          WALLET BALANCES
        </h2>
        
        <button 
          onClick={fetchBalances}
          disabled={isLoading}
          className="p-1.5 border-2 border-mictlai-gold/70 hover:bg-mictlai-blood transition-colors shadow-pixel"
          title="Refresh balances"
        >
          {isLoading ? (
            <LoadingIcon className="w-4 h-4 text-mictlai-gold" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-4 h-4 text-mictlai-gold">
              <rect x="7" y="1" width="2" height="2" fill="currentColor" />
              <rect x="9" y="3" width="2" height="2" fill="currentColor" />
              <rect x="11" y="5" width="2" height="2" fill="currentColor" />
              <rect x="13" y="7" width="2" height="2" fill="currentColor" />
              <rect x="3" y="7" width="2" height="2" fill="currentColor" />
              <rect x="5" y="9" width="2" height="2" fill="currentColor" />
              <rect x="7" y="11" width="2" height="2" fill="currentColor" />
              <rect x="9" y="13" width="2" height="2" fill="currentColor" />
              <rect x="11" y="11" width="2" height="2" fill="currentColor" />
              <rect x="13" y="9" width="2" height="2" fill="currentColor" />
              <rect x="1" y="9" width="2" height="2" fill="currentColor" />
              <rect x="3" y="11" width="2" height="2" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="p-4">
        {isLoading && balances.length === 0 ? (
          <div className="py-4 flex justify-center">
            <LoadingIcon className="w-6 h-6 text-mictlai-gold" />
          </div>
        ) : error ? (
          <div className="text-mictlai-blood text-center py-2 font-pixel border-2 border-mictlai-blood p-3">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 px-3 py-2 bg-black border-3 border-mictlai-gold/50 text-center shadow-pixel-inner">
              <div className="text-xs text-mictlai-bone/70 mb-1 font-pixel">CONNECTED WALLET</div>
              <a 
                href={`https://celoscan.io/address/${walletAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-mictlai-turquoise font-pixel text-sm hover:text-mictlai-gold"
                title={walletAddress}
              >
                {shortenAddress(walletAddress)}
              </a>
            </div>
            
            <div className="space-y-3">
              {balances.map((token, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-black/40 border-3 border-mictlai-gold/50 shadow-pixel">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3 pixel-pulse">{token.icon}</span>
                    <div>
                      <div className="font-bold text-mictlai-gold font-pixel">{token.symbol}</div>
                      <div className="text-sm text-mictlai-bone/80 font-pixel">{token.balanceFormatted}</div>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-mictlai-turquoise font-pixel">{token.balanceUsd}</div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-3 bg-black border-3 border-mictlai-gold/70 text-center shadow-pixel">
              <div className="text-sm text-mictlai-bone/70 font-pixel">TOTAL PORTFOLIO VALUE</div>
              <div className="text-2xl font-bold text-mictlai-gold font-pixel">{totalValue}</div>
            </div>
            
            {lastUpdated && (
              <div className="mt-4 text-xs text-center text-mictlai-bone/50 font-pixel">
                LAST UPDATED: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 