import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import WalletBalances from './components/WalletBalances';
import InfoPanel from './components/InfoPanel';
import WalletConnect from './components/WalletConnect';
import { PrivyProvider } from './providers/PrivyProvider';
import { WalletProvider } from './providers/WalletContext';
import TransactionMonitor from './components/TransactionMonitor';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAgentActive, setIsAgentActive] = useState(false);

  // Handle theme switching
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Force immediate DOM update to reflect theme change
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    localStorage.setItem('celo-mind-theme', newTheme);
    
    // Log theme change to help with debugging
    console.log(`Theme changed to: ${newTheme}`);
  };

  // Initialize theme from localStorage on mount
  useEffect(() => {
    // Check for saved theme or use system preference
    const savedTheme = localStorage.getItem('celo-mind-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <PrivyProvider>
      <WalletProvider>
        <div className="min-h-screen bg-yellow-50 dark:bg-slate-900 text-slate-900 dark:text-yellow-50 transition-colors duration-200">
          <Header theme={theme} toggleTheme={toggleTheme} isAgentActive={isAgentActive} setIsAgentActive={setIsAgentActive} />
          
          <main className="container mx-auto px-4 py-8">
            {/* Always show wallet connection at the top */}
            <div className="mb-6">
              <WalletConnect />
            </div>
            
            {!isAgentActive ? (
              <InfoPanel onActivateAgent={() => setIsAgentActive(true)} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ChatInterface />
                </div>
                <div className="space-y-6">
                  <WalletBalances />
                </div>
              </div>
            )}
          </main>
          
          {/* Transaction monitoring component */}
          <TransactionMonitor />
          
          <footer className="container mx-auto p-4 text-center text-sm text-slate-600 dark:text-slate-400">
            <p>🧠 CeloMΔIND - AI-Powered DeFi Interface - <a href="https://github.com/0xOucan/celo-mind-web" className="underline hover:text-yellow-600 dark:hover:text-yellow-400">GitHub</a></p>
          </footer>
        </div>
      </WalletProvider>
    </PrivyProvider>
  );
} 