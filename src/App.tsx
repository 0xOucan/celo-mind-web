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
    
    localStorage.setItem('mictlai-theme', darkMode ? 'light' : 'dark');
  };

  // Initialize theme from localStorage on mount
  useEffect(() => {
    // Check for saved theme or use system preference
    const savedTheme = localStorage.getItem('mictlai-theme');
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
        <div className="min-h-screen bg-mictlai-obsidian text-mictlai-bone">
          {/* Main header */}
          <header className="bg-black px-6 py-3 border-b border-mictlai-gold/50 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
              {/* Branding Section - Left */}
              <div className="flex items-center">
                {/* Skull icon instead of brain emoji */}
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                  <rect width="32" height="32" rx="4" fill="#0D0D0D" />
                  <path d="M16 6C10.477 6 6 10.477 6 16C6 18.559 7.074 20.893 8.845 22.567C9.473 23.148 9.95 23.899 9.95 24.95C9.95 25.503 10.397 25.95 10.95 25.95H14.06C14.585 25.95 15.017 25.546 15.05 25.022C15.05 25.014 15.05 25.007 15.05 25C15.05 24.172 15.672 23.5 16.5 23.5C17.328 23.5 18 24.172 18 25V25.037C18.033 25.551 18.465 25.95 18.989 25.95H21.05C21.603 25.95 22.05 25.503 22.05 24.95C22.05 23.899 22.527 23.148 23.155 22.567C24.926 20.893 26 18.559 26 16C26 10.477 21.523 6 16 6Z" fill="#FFD700" />
                  <path d="M13 16C13 17.1046 12.1046 18 11 18C9.89543 18 9 17.1046 9 16C9 14.8954 9.89543 14 11 14C12.1046 14 13 14.8954 13 16Z" fill="#0D0D0D" />
                  <path d="M23 16C23 17.1046 22.1046 18 21 18C19.8954 18 19 17.1046 19 16C19 14.8954 19.8954 14 21 14C22.1046 14 23 14.8954 23 16Z" fill="#0D0D0D" />
                  <rect x="14" y="14" width="4" height="4" rx="2" fill="#40E0D0" />
                </svg>
                <h1 className="text-xl font-aztec font-bold tracking-tight text-mictlai-gold">MictlAI</h1>
                <span className="ml-2 bg-mictlai-blood text-xs font-medium px-2 py-1 rounded">
                  AI-Powered Bridge
                </span>
              </div>
              
              {/* Controls Section - Right */}
              <div className="flex items-center space-x-4">
                <WalletConnect />
                
                <button 
                  onClick={toggleDarkMode}
                  className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-mictlai-bone"
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
          
          <footer className="bg-black py-3 text-center text-mictlai-gold/70 text-sm border-t border-mictlai-gold/20">
            <p className="container mx-auto">⛧ MictlAI - Bridging Worlds Beyond Time</p>
          </footer>
        </div>
      </WalletProvider>
    </PrivyProvider>
  );
} 