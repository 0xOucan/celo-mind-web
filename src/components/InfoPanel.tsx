import React from 'react';
import { PlayIcon } from './Icons';

interface InfoPanelProps {
  onActivateAgent: () => void;
}

export default function InfoPanel({ onActivateAgent }: InfoPanelProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
        {/* Hero Section */}
        <div className="p-8 text-center">
          <div className="text-6xl mb-4">🧠</div>
          <h1 className="text-4xl font-bold mb-2">CeloMΔIND</h1>
          <h2 className="text-xl text-slate-600 dark:text-slate-300 mb-8">AI-Powered DeFi Interface for Celo</h2>
          
          <button 
            onClick={onActivateAgent}
            className="flex items-center space-x-2 mx-auto px-6 py-3 bg-yellow-400 hover:bg-yellow-500 
                      dark:bg-yellow-500 dark:hover:bg-yellow-600 text-slate-900 font-medium 
                      rounded-lg transition-colors duration-200"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Launch AI Agent</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-gray-200 dark:border-slate-700">
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-bold text-lg mb-2">Balance Checker</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Check balances of all tokens in your wallet with accurate USD values
            </p>
          </div>
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🏦</div>
            <h3 className="font-bold text-lg mb-2">DeFi Protocols</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Interact with AAVE lending, ICHI vaults, and Mento swap protocols
            </p>
          </div>
          <div className="p-6">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-bold text-lg mb-2">AI-Powered</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Get personalized investment strategies and portfolio management
            </p>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="mt-10 px-4 md:px-8 py-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">About CeloMΔIND</h2>
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          CeloMΔIND is an AI-powered DeFi web interface that simplifies access to the Celo blockchain ecosystem. 
          Our platform uses AI and Agent Orchestration to provide users with personalized investment strategies, 
          real-time market insights, and optional automated portfolio management.
        </p>
        
        <h3 className="text-xl font-bold mt-6 mb-3">Supported Protocols:</h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
          <li><span className="font-medium">AAVE Lending Protocol:</span> Supply assets as collateral, borrow against your collateral, and manage your lending positions</li>
          <li><span className="font-medium">ICHI Vault Strategies:</span> Deposit assets into yield-generating vaults and earn trading fees</li>
          <li><span className="font-medium">Mento Swap:</span> Swap CELO for cUSD and cEUR with real-time price quotes and slippage protection</li>
        </ul>
        
        <div className="mt-8 text-center">
          <button 
            onClick={onActivateAgent}
            className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 
                    dark:bg-yellow-500 dark:hover:bg-yellow-600 text-slate-900 font-medium 
                    rounded-lg transition-colors duration-200"
          >
            Start Using CeloMΔIND
          </button>
        </div>
      </section>
    </div>
  );
} 