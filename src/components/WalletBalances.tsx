import React, { useEffect, useState } from 'react';
import { WalletIcon, LoadingIcon } from './Icons';
import { tokenIcons, apiUrl } from '../config';

interface TokenBalance {
  symbol: string;
  balance: string;
  balanceFormatted: string;
  balanceUsd: string;
  icon: string;
}

export default function WalletBalances() {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalValue, setTotalValue] = useState<string>('$0.00');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userInput: 'check wallet balances' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch wallet balances');
      }
      
      const data = await response.json();
      const responseText = data.response || '';
      
      // Parse the token balances from the response
      // This is a simplified approach - in a production app, you'd want more robust parsing
      const parsedBalances: TokenBalance[] = [];
      let total = 0;
      
      const lines = responseText.split('\n');
      for (const line of lines) {
        // Looking for lines with token balances like "CELO: 1.32 ($0.66)"
        const match = line.match(/- ([\w\s]+) \*\*([\w]+)\*\*: ([0-9.]+) \(\$([0-9.]+)\)/);
        if (match) {
          const icon = match[1].trim();
          const symbol = match[2];
          const balance = match[3];
          const usdValue = match[4];
          
          parsedBalances.push({
            symbol,
            balance,
            balanceFormatted: balance,
            balanceUsd: `$${usdValue}`,
            icon: tokenIcons[symbol as keyof typeof tokenIcons] || '💰'
          });
          
          total += parseFloat(usdValue);
        }
      }
      
      // If we couldn't parse any balances, try an alternate format
      if (parsedBalances.length === 0) {
        for (const line of lines) {
          const match = line.match(/([0-9.]+) ([\w]+) \(\$([0-9.]+)\)/);
          if (match) {
            const balance = match[1];
            const symbol = match[2]; 
            const usdValue = match[3];
            
            parsedBalances.push({
              symbol,
              balance,
              balanceFormatted: balance,
              balanceUsd: `$${usdValue}`,
              icon: tokenIcons[symbol as keyof typeof tokenIcons] || '💰'
            });
            
            total += parseFloat(usdValue);
          }
        }
      }
      
      if (parsedBalances.length > 0) {
        setBalances(parsedBalances);
        setTotalValue(`$${total.toFixed(2)}`);
        setLastUpdated(new Date());
      } else {
        setError('Could not parse balance information. Please try again.');
      }
    } catch (err) {
      setError('Failed to fetch wallet balances. Please try again.');
      console.error('Error fetching balances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch balances on component mount
  useEffect(() => {
    fetchBalances();
    
    // Optional: Set up a refresh interval
    const interval = setInterval(fetchBalances, 5 * 60 * 1000); // Refresh every 5 minutes
    
    return () => clearInterval(interval);
  }, []);

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
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-slate-700 rounded-lg">
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Portfolio Value</div>
              <div className="text-2xl font-bold">{totalValue}</div>
            </div>
            
            <div className="space-y-3">
              {balances.map((token, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{token.icon}</span>
                    <div>
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{token.balanceFormatted}</div>
                    </div>
                  </div>
                  <div className="font-medium">{token.balanceUsd}</div>
                </div>
              ))}
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