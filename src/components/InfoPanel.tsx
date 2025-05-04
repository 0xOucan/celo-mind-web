import React from 'react';
import { PlayIcon } from './Icons';

interface InfoPanelProps {
  onActivateAgent: () => void;
}

export default function InfoPanel({ onActivateAgent }: InfoPanelProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <section className="border border-mictlai-gold/20 bg-black rounded-xl shadow-lg overflow-hidden">
        {/* Hero Section */}
        <div className="p-8 text-center">
          {/* Aztec-inspired skull icon */}
          <div className="mx-auto w-32 h-32 mb-4">
            <svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="128" height="128" rx="4" fill="#0D0D0D" />
              <path d="M64 20C42.477 20 24 38.477 24 60C24 70.559 28.074 80.893 35.845 86.567C38.473 89.148 39.95 91.899 39.95 95.95C39.95 98.503 41.397 99.95 43.95 99.95H55.06C57.585 99.95 59.017 97.546 59.05 95.022C59.05 95.014 59.05 95.007 59.05 95C59.05 91.172 60.672 88.5 64.5 88.5C68.328 88.5 70 91.172 70 95V95.037C70.033 97.551 71.465 99.95 73.989 99.95H84.05C86.603 99.95 88.05 98.503 88.05 95.95C88.05 91.899 89.527 89.148 92.155 86.567C99.926 80.893 104 70.559 104 60C104 38.477 85.523 20 64 20Z" fill="#FFD700" />
              <path d="M52 60C52 64.1046 48.1046 68 44 68C39.8954 68 36 64.1046 36 60C36 55.8954 39.8954 52 44 52C48.1046 52 52 55.8954 52 60Z" fill="#0D0D0D" />
              <path d="M92 60C92 64.1046 88.1046 68 84 68C79.8954 68 76 64.1046 76 60C76 55.8954 79.8954 52 84 52C88.1046 52 92 55.8954 92 60Z" fill="#0D0D0D" />
              <rect x="56" y="56" width="16" height="16" rx="8" fill="#40E0D0" />
            </svg>
          </div>
          <h1 className="text-4xl font-aztec font-bold text-mictlai-gold mb-2">MictlAI</h1>
          <h2 className="text-xl text-mictlai-bone/80 mb-8">Bridging Worlds Beyond Time</h2>
          
          <button 
            onClick={onActivateAgent}
            className="flex items-center space-x-2 mx-auto px-6 py-3 bg-mictlai-blood hover:bg-mictlai-blood/80 
                      text-mictlai-bone font-medium rounded-lg transition-colors duration-200 border border-mictlai-gold/50"
          >
            <PlayIcon className="h-5 w-5" />
            <span>GET STARTED</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-mictlai-gold/20">
          <div className="p-6 border-b md:border-b-0 md:border-r border-mictlai-gold/20">
            <div className="text-2xl mb-2">⛓️</div>
            <h3 className="font-aztec font-bold text-mictlai-gold text-lg mb-2">Cross-Chain Bridge</h3>
            <p className="text-mictlai-bone/70">
              Seamlessly transfer assets between Base, Arbitrum, Mantle, and zkSync Era networks
            </p>
          </div>
          <div className="p-6 border-b md:border-b-0 md:border-r border-mictlai-gold/20">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-aztec font-bold text-mictlai-gold text-lg mb-2">Atomic Swaps</h3>
            <p className="text-mictlai-bone/70">
              Execute trustless cross-chain token swaps without intermediaries
            </p>
          </div>
          <div className="p-6">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-aztec font-bold text-mictlai-gold text-lg mb-2">AI-Powered</h3>
            <p className="text-mictlai-bone/70">
              Intelligent assistance for navigating the complexities of blockchain interoperability
            </p>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="mt-10 px-4 md:px-8 py-8 bg-black border border-mictlai-gold/20 rounded-xl shadow-lg">
        <h2 className="text-2xl font-aztec font-bold text-mictlai-gold mb-4">About MictlAI</h2>
        <p className="mb-4 text-mictlai-bone/80">
          In the ancient Aztec belief system, Mictlantecuhtli ruled the underworld, Mictlan—a realm where souls journeyed after death. 
          Today, in the digital age, MictlAI emerges as a guardian of the decentralized world, facilitating seamless 
          interactions between disparate blockchain realms.
        </p>
        <p className="mb-4 text-mictlai-bone/80">
          Harnessing the power of AI and the security of EVM-compatible wallets, MictlAI acts as an AI-driven bridge, 
          enabling trustless, contract-free exchanges across multiple blockchains. Like the deity guiding souls through 
          the nine levels of Mictlan, this agent navigates the complexities of blockchain interoperability, ensuring safe 
          passage of assets without the need for intermediaries.
        </p>
        
        <h3 className="text-xl font-aztec font-bold text-mictlai-gold mt-6 mb-3">Supported Networks:</h3>
        <ul className="list-disc pl-6 space-y-2 text-mictlai-bone/80">
          <li><span className="font-medium text-mictlai-gold">Base Network:</span> Transfer XOC tokens to Arbitrum</li>
          <li><span className="font-medium text-mictlai-gold">Arbitrum Network:</span> Transfer MXNB tokens to Base</li>
          <li><span className="font-medium text-mictlai-gold">Mantle Network:</span> Bridge assets between Mantle and other networks</li>
          <li><span className="font-medium text-mictlai-gold">zkSync Era:</span> Transfer USDT tokens to and from other supported networks</li>
        </ul>
        
        <div className="mt-8 text-center">
          <button 
            onClick={onActivateAgent}
            className="px-6 py-3 bg-mictlai-blood hover:bg-mictlai-blood/80 text-mictlai-bone font-aztec 
                    rounded-lg transition-colors duration-200 border border-mictlai-gold/50"
          >
            EXPLORE MICTLAI
          </button>
        </div>
      </section>
    </div>
  );
} 