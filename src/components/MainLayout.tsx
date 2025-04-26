import React, { ReactNode } from 'react';
import { SunIcon, MoonIcon } from './Icons';
import WalletConnect from './WalletConnect';

interface MainLayoutProps {
  children: ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function MainLayout({ children, darkMode, toggleDarkMode }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <header className="bg-yellow-100 dark:bg-slate-800 shadow-md">
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <span className="text-2xl">🧠</span>
            <h1 className="text-2xl font-bold">CeloMΔIND</h1>
            <span className="hidden sm:inline-block text-sm bg-yellow-200 dark:bg-yellow-700 px-2 py-1 rounded-md">
              AI-Powered DeFi
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <WalletConnect />
            
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full bg-yellow-200 dark:bg-slate-700 hover:bg-yellow-300 dark:hover:bg-slate-600 transition-colors duration-200"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              role="switch"
              aria-checked={darkMode}
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-yellow-50 dark:bg-slate-800 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>🧠 CeloMΔIND - AI-Powered DeFi Interface</p>
        </div>
      </footer>
    </div>
  );
} 