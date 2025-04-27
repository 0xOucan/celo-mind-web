import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import WalletBalances from './components/WalletBalances';
import InfoPanel from './components/InfoPanel';
import WalletConnect, { WalletStatusBar } from './components/WalletConnect';
import { PrivyProvider } from './providers/PrivyProvider';
import { WalletProvider } from './providers/WalletContext';
import TransactionMonitor from './components/TransactionMonitor';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [isAgentActive, setIsAgentActive] = useState(false);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    localStorage.setItem('celo-mind-theme', darkMode ? 'light' : 'dark');
  };

  // Initialize theme from localStorage on mount
  useEffect(() => {
    // Check for saved theme or use system preference
    const savedTheme = localStorage.getItem('celo-mind-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <PrivyProvider>
      <WalletProvider>
        <div className="min-h-screen bg-slate-900 text-white">
          {/* Main header */}
          <header className="bg-slate-800 px-6 py-3 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
              {/* Branding Section - Left */}
              <div className="flex items-center">
                <span role="img" aria-label="brain" className="text-2xl mr-2">🧠</span>
                <h1 className="text-xl font-bold tracking-tight">CeloMAIND</h1>
                <span className="ml-2 bg-yellow-600 text-xs font-medium px-2 py-1 rounded">
                  AI-Powered DeFi
                </span>
              </div>
              
              {/* Controls Section - Right */}
              <div className="flex items-center space-x-4">
                <WalletConnect />
                
                <button 
                  onClick={toggleDarkMode}
                  className="p-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200"
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </header>
          
          {/* Wallet status bar */}
          <WalletStatusBar />
          
          {/* Main content */}
          <main className="container mx-auto px-4 py-6">
            {!isAgentActive ? (
              <InfoPanel onActivateAgent={() => setIsAgentActive(true)} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ChatInterface />
                </div>
                <div className="lg:col-span-1">
                  <WalletBalances />
                </div>
              </div>
            )}
          </main>
          
          {/* Transaction monitoring component */}
          <TransactionMonitor />
          
          <footer className="bg-slate-800 py-3 text-center text-slate-400 text-sm">
            <p className="container mx-auto">🧠 CeloMΔIND - AI-Powered DeFi Interface</p>
          </footer>
        </div>
      </WalletProvider>
    </PrivyProvider>
  );
} 