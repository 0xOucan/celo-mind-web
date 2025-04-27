import React from 'react';
import { useWallet } from '../providers/WalletContext';
import { LoadingIcon } from './Icons';

// Main header component for wallet connection
export default function WalletConnect() {
  const { 
    connectedAddress, 
    isConnected, 
    isConnecting, 
    isBackendSynced, 
    connect, 
    wallets 
  } = useWallet();
  
  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Wait for wallet to be ready
  if (isConnecting) return (
    <button className="bg-slate-700 px-3 py-1.5 rounded-md flex items-center text-slate-300">
      <LoadingIcon className="animate-spin h-4 w-4 mr-2" />
      <span className="text-sm">Connecting...</span>
    </button>
  );

  // If not connected, show connect button
  if (!isConnected) {
    return (
      <button 
        onClick={connect} 
        className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1.5 rounded-md text-white text-sm font-medium"
      >
        Connect Wallet
      </button>
    );
  }

  // If connected, show compact status
  return (
    <div className="flex items-center">
      <div className="bg-slate-700 px-3 py-1.5 rounded-md flex items-center">
        <span className={`h-2 w-2 rounded-full ${isBackendSynced ? 'bg-green-500' : 'bg-yellow-500'} mr-2`}></span>
        <span className="text-sm text-white font-medium">{formatAddress(connectedAddress || '')}</span>
      </div>
    </div>
  );
}

// Wallet status bar component
export function WalletStatusBar() {
  const { 
    connectedAddress, 
    isConnected, 
    isBackendSynced,
    wallets 
  } = useWallet();
  
  if (!isConnected) return null;
  
  return (
    <div className="w-full bg-slate-800 px-4 py-1.5 flex justify-between items-center text-sm border-t border-slate-700">
      {/* Left side - status */}
      <div className="flex items-center">
        <span className="text-green-400 mr-1">✓</span>
        <span className="text-white mr-3">Wallet Connected</span>
        
        {isBackendSynced && (
          <>
            <span className="text-green-400 mr-1">✓</span>
            <span className="text-white">Synced with backend</span>
          </>
        )}
      </div>
      
      {/* Right side - wallet info */}
      {wallets.length > 0 && (
        <div className="flex items-center">
          <span className="text-slate-400 mr-2">
            {formatAddress(connectedAddress || wallets[0].address)}
          </span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-slate-300 mr-2">
            rabby_wallet
          </span>
          <a 
            href={`https://celoscan.io/address/${connectedAddress || wallets[0].address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            View
          </a>
        </div>
      )}
    </div>
  );
  
  // Helper function to format address
  function formatAddress(address: string) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
} 