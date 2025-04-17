import React from 'react';
import { useWallet } from '../providers/WalletContext';
import { LoadingIcon } from './Icons';

export default function WalletConnect() {
  const { 
    connectedAddress, 
    isConnected, 
    isConnecting, 
    isBackendSynced, 
    syncStatus, 
    connect, 
    wallets 
  } = useWallet();
  
  // Wait for wallet to be ready
  if (isConnecting) return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-slate-200 dark:bg-slate-700 h-12 w-12"></div>
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
      <h2 className="text-lg font-bold mb-4 flex items-center">
        <span className="mr-2">👛</span> Wallet Connection
      </h2>
      
      {!isConnected ? (
        <div className="text-center">
          <p className="mb-4 text-slate-600 dark:text-slate-400">Connect your wallet to interact with CeloMΔIND AI agent</p>
          <button 
            onClick={connect} 
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-slate-900 rounded-lg font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-sm text-green-700 dark:text-green-400">
              ✅ Wallet Connected
            </div>
            
            <div className={`text-xs mt-1 ${isBackendSynced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isBackendSynced ? '✓ Synced with backend' : '⚠ Not synced with backend'}
            </div>
          </div>
          
          <h3 className="font-medium mb-2 text-slate-700 dark:text-slate-300">Your Wallets:</h3>
          <ul className="space-y-2">
            {wallets.map((wallet) => (
              <li key={wallet.address} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-center">
                <div className="flex items-center">
                  <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-mono text-sm">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{wallet.walletClientType}</div>
                  </div>
                </div>
                <a 
                  href={`https://celoscan.io/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 