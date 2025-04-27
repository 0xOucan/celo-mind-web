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
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span role="img" aria-label="brain" className="text-2xl mr-2">🧠</span>
            <h1 className="text-xl font-bold tracking-tight">CeloMAIND</h1>
            <span className="ml-2 bg-yellow-600 text-xs font-medium px-2 py-1 rounded">
              AI-Powered DeFi
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <WalletConnect />
            
            <button 
              onClick={toggleDarkMode}
              className="p-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
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
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 py-3 text-center text-slate-400 text-sm">
        <p className="container mx-auto">🧠 CeloMΔIND - AI-Powered DeFi Interface</p>
      </footer>
    </div>
  );
} 