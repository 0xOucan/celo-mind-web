import React, { useState, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import ChatInterface from './components/ChatInterface';
import MainLayout from './components/MainLayout';
import WalletBalances from './components/WalletBalances';
import { WalletProvider } from './providers/WalletContext';
import TransactionMonitor from './components/TransactionMonitor';
import { PRIVY_APP_ID, CELO_CHAIN_ID } from './config';

function App() {
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode
  const [networkWarning, setNetworkWarning] = useState(false);

  // Check if the wallet is on the correct network
  useEffect(() => {
    const checkNetwork = async () => {
      if (!window.ethereum) return;
      
      try {
        // Get current chain ID
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        
        if (chainId !== CELO_CHAIN_ID) {
          console.warn(`Wallet on incorrect network: ${chainId}. Celo network (${CELO_CHAIN_ID}) required.`);
          setNetworkWarning(true);
        } else {
          setNetworkWarning(false);
        }
        
        // Listen for chain change events
        const handleChainChanged = (chainIdHex: string) => {
          const newChainId = parseInt(chainIdHex, 16);
          if (newChainId !== CELO_CHAIN_ID) {
            setNetworkWarning(true);
          } else {
            setNetworkWarning(false);
          }
        };
        
        window.ethereum.on('chainChanged', handleChainChanged);
        
        return () => {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
      } catch (error) {
        console.error('Error checking network:', error);
      }
    };
    
    checkNetwork();
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Always use dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#3ECF8E',
        },
      }}
    >
      <WalletProvider>
        <div className="min-h-screen dark transition-colors">
          {networkWarning && (
            <div className="bg-yellow-600 text-white px-4 py-2 text-center font-medium">
              Warning: Your wallet is not connected to Celo network. Please switch to Celo (Chain ID: {CELO_CHAIN_ID}).
            </div>
          )}
          <MainLayout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <ChatInterface />
              </div>
              <div className="lg:col-span-1">
                <WalletBalances />
              </div>
            </div>
          </MainLayout>
          <TransactionMonitor />
        </div>
      </WalletProvider>
    </PrivyProvider>
  );
}

export default App; 