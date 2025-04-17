import React from 'react';
import { SunIcon, MoonIcon, HomeIcon } from './Icons';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isAgentActive: boolean;
  setIsAgentActive: (active: boolean) => void;
}

export default function Header({ theme, toggleTheme, isAgentActive, setIsAgentActive }: HeaderProps) {
  // Handle theme toggle with both click handler and keyboard access
  const handleToggleTheme = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    toggleTheme();
  };

  return (
    <header className="bg-yellow-100 dark:bg-slate-800 shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🧠</span>
          <h1 className="text-2xl font-bold">CeloMΔIND</h1>
          <span className="hidden sm:inline-block text-sm bg-yellow-200 dark:bg-yellow-700 px-2 py-1 rounded-md">
            AI-Powered DeFi
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {isAgentActive && (
            <button 
              onClick={() => setIsAgentActive(false)} 
              className="flex items-center space-x-1 text-sm px-3 py-1.5 rounded-md 
                        bg-yellow-200 dark:bg-slate-700 hover:bg-yellow-300 dark:hover:bg-slate-600 
                        transition-colors duration-200"
            >
              <HomeIcon className="h-4 w-4" />
              <span>Home</span>
            </button>
          )}
          
          <button 
            onClick={handleToggleTheme}
            onKeyDown={(e) => e.key === 'Enter' && handleToggleTheme(e)}
            className="p-2 rounded-full bg-yellow-200 dark:bg-slate-700 hover:bg-yellow-300 dark:hover:bg-slate-600 transition-colors duration-200"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            tabIndex={0}
            role="switch"
            aria-checked={theme === 'dark'}
          >
            {theme === 'light' ? (
              <MoonIcon className="h-5 w-5" />
            ) : (
              <SunIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
} 