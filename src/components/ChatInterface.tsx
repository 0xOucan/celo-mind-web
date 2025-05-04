import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, LoadingIcon } from './Icons';
import { apiUrl } from '../config';
import { sendChatMessage, AgentResponseType, ParsedAgentResponse } from '../services/agentService';
import { useWallet } from '../providers/WalletContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getPendingTransactions, PendingTransaction } from '../services/transactionService';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: number;
  type?: AgentResponseType;
  requiresAction?: boolean;
  data?: any;
}

// Component to dynamically update transaction links when they are confirmed
const TransactionLink = ({ txId }: { txId: string }) => {
  const [transaction, setTransaction] = useState<PendingTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const transactions = await getPendingTransactions();
        const tx = transactions.find(t => t.id === txId) || 
                   transactions.find(t => t.id.includes(txId.substring(3, 10)));
        
        if (tx) {
          setTransaction(tx);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching transaction:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchTransaction();
    
    // Poll for updates
    const intervalId = setInterval(fetchTransaction, 3000);
    
    return () => clearInterval(intervalId);
  }, [txId]);

  if (isLoading) {
    return <span className="text-blue-400">Loading transaction status...</span>;
  }

  if (!transaction) {
    return <span className="text-blue-400">Check transaction panel for updates</span>;
  }

  if (transaction.status === 'confirmed' && transaction.hash) {
    // Determine which explorer to use based on chain
    let explorerUrl = `https://celoscan.io/tx/${transaction.hash}`;
    let explorerName = 'Celoscan';
    
    if (transaction.metadata?.chain) {
      switch(transaction.metadata.chain) {
        case 'base':
          explorerUrl = `https://basescan.org/tx/${transaction.hash}`;
          explorerName = 'Basescan';
          break;
        case 'arbitrum':
          explorerUrl = `https://arbiscan.io/tx/${transaction.hash}`;
          explorerName = 'Arbiscan';
          break;
        case 'mantle':
          explorerUrl = `https://explorer.mantle.xyz/tx/${transaction.hash}`;
          explorerName = 'Mantle Explorer';
          break;
        case 'zksync':
          explorerUrl = `https://explorer.zksync.io/tx/${transaction.hash}`;
          explorerName = 'zkSync Explorer';
          break;
      }
    }
    
    return (
      <a 
        href={explorerUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-400 hover:underline"
      >
        View on {explorerName}: {transaction.hash.substring(0, 6)}...{transaction.hash.substring(transaction.hash.length - 4)}
      </a>
    );
  }

  if (transaction.status === 'pending') {
    return <span className="text-yellow-400">Waiting for wallet signature...</span>;
  }
  
  if (transaction.status === 'submitted') {
    return <span className="text-blue-400">Transaction submitted, waiting for confirmation...</span>;
  }

  if (transaction.status === 'rejected') {
    return <span className="text-red-400">Transaction rejected by user</span>;
  }

  if (transaction.status === 'failed') {
    return <span className="text-red-400">Transaction failed</span>;
  }

  return <span className="text-blue-400">Check transaction panel for latest status</span>;
};

// Component to render message content with clickable links and transaction UI
const MessageDisplay = ({ message }: { message: Message }) => {
  const content = message.content;
  
  // Check if the message contains a transaction ID
  const extractTransactionId = (content: string): string | null => {
    // Look for the temporary transaction ID format in the response
    const txIdMatch = content.match(/Transaction ID: (tx-[\w-]+)/i);
    if (txIdMatch && txIdMatch[1]) {
      return txIdMatch[1];
    }
    
    // Hidden transaction ID in message data
    if (message.data && message.data.transactionId) {
      return message.data.transactionId;
    }
    
    return null;
  };
  
  const transactionId = extractTransactionId(content);
  
  // Process content to make links clickable and handle transaction links
  const processContent = () => {
    let processed = content;
    
    // If we have a transaction ID, replace any "View Transaction" text with a dynamic component
    if (transactionId) {
      // We'll use a special placeholder that will be replaced with the TransactionLink component in the JSX
      processed = processed.replace(/🔍 Transaction: View Transaction|🔍 Transaction: View in transaction panel \(bottom right\)/g, 
        '🔍 Transaction: [[TRANSACTION_LINK_PLACEHOLDER]]');
    } else {
      // Replace "Transaction: View Transaction" with a better message
      // that provides guidance about the transaction panel
      const txViewRegex = /🔍 Transaction: View Transaction/g;
      processed = processed.replace(txViewRegex, '🔍 Transaction: View in transaction panel (bottom right)');
    }
    
    // Replace any remaining Celoscan links with a cleaner format
    const celoscanRegex = /https:\/\/celoscan\.io\/tx\/([a-zA-Z0-9]+)/g;
    processed = processed.replace(celoscanRegex, (match, txHash) => {
      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">View on Celoscan (${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)})</a>`;
    });
    
    // Process Markdown-style links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    processed = processed.replace(markdownLinkRegex, (match, text, url) => {
        // Remove any trailing punctuation from the URL
        const cleanUrl = url.replace(/[,.)]$/, '');
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${text}</a>`;
      });
    
    // Process plain URLs that aren't already in HTML tags
    const urlRegex = /(?<!href="|">)(https?:\/\/[^\s),.]+)/g;
    processed = processed.replace(urlRegex, '<a href="$&" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$&</a>');
    
    return processed;
  };
  
  const processedContent = processContent();
  
  // If we have a transaction ID, render with the dynamic TransactionLink component
  if (transactionId) {
    const parts = processedContent.split('[[TRANSACTION_LINK_PLACEHOLDER]]');
    
    const contentWithTxLink = (
      <>
        {parts.length > 0 && <span dangerouslySetInnerHTML={{ __html: parts[0] }} />}
        {parts.length > 1 && (
          <>
            <TransactionLink txId={transactionId} />
            <span dangerouslySetInnerHTML={{ __html: parts[1] }} />
          </>
        )}
      </>
    );
    
    // Add special UI for transaction messages
    if (message.type === AgentResponseType.TRANSACTION || message.type === AgentResponseType.APPROVAL) {
      return (
        <div>
          <div className="whitespace-pre-wrap">{contentWithTxLink}</div>
          <div className="mt-2 p-2 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              This operation requires a wallet transaction. Please check your wallet extension for a signature request.
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              You can monitor the status of your transaction in the Transaction panel at the bottom right.
            </p>
          </div>
        </div>
      );
    }
    
    // Enhanced rendering for cUSD escrow messages 
    if (content.includes('selling order') && content.includes('cUSD') && content.includes('iAmigo P2P')) {
      return (
        <div>
          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />
          <div className="mt-2 p-2 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Your transaction is being processed. Check the transaction panel at the bottom right for status and Celoscan link.
            </p>
          </div>
        </div>
      );
    }
    
    // Enhanced rendering for buying order messages
    if (content.includes('buying order') && content.includes('QR') && (content.includes('OXXO') || content.includes('MXN'))) {
      return (
        <div>
          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />
          <div className="mt-2 p-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Buying order has been processed. The funds have been transferred from escrow to the buyer's wallet.
            </p>
          </div>
        </div>
      );
    }
    
    return <div className="whitespace-pre-wrap">{contentWithTxLink}</div>;
  }
  
  // Add special UI for transaction messages
  if (message.type === AgentResponseType.TRANSACTION || message.type === AgentResponseType.APPROVAL) {
    return (
      <div>
        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />
        <div className="mt-2 p-2 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            This operation requires a wallet transaction. Please check your wallet extension for a signature request.
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
            You can monitor the status of your transaction in the Transaction panel at the bottom right.
          </p>
        </div>
      </div>
    );
  }
  
  // Enhanced rendering for cUSD escrow messages 
  if (content.includes('selling order') && content.includes('cUSD') && content.includes('iAmigo P2P')) {
    return (
      <div>
        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />
        <div className="mt-2 p-2 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Your transaction is being processed. Check the transaction panel at the bottom right for status and Celoscan link.
          </p>
        </div>
      </div>
    );
  }
  
  // Enhanced rendering for buying order messages
  if (content.includes('buying order') && content.includes('QR') && (content.includes('OXXO') || content.includes('MXN'))) {
    return (
      <div>
        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />
        <div className="mt-2 p-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Buying order has been processed. The funds have been transferred from escrow to the buyer's wallet.
          </p>
        </div>
      </div>
    );
  }
  
  // Use dangerouslySetInnerHTML for all link rendering to avoid mixing approaches
  return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedContent }} />;
};

export default function ChatInterface() {
  const { connectedAddress, isConnected } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          content: `👋 Hello! I'm MictlAI, your AI-powered cross-chain bridge assistant for Base, Arbitrum, and Mantle networks. 
          
How can I help you today? You can ask me to:
- 💰 Check your wallet balances
- 🌉 Transfer tokens between networks
- 🔄 Swap tokens across chains
- 📊 Get quotes for cross-chain swaps

Just type your request below!`,
          sender: 'agent',
          timestamp: Date.now(),
          type: AgentResponseType.INFO
        }
      ]);
    }
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Check if wallet is connected before allowing DeFi operations
    if (!isConnected && 
        (input.toLowerCase().includes('swap') || 
         input.toLowerCase().includes('aave') || 
         input.toLowerCase().includes('ichi') || 
         input.toLowerCase().includes('approve'))) {
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: "Please connect your wallet first to perform DeFi operations.",
        sender: 'agent',
        timestamp: Date.now(),
        type: AgentResponseType.ERROR
      }]);
      return;
    }
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      sender: 'user',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await sendChatMessage(input);
      
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        content: response.message,
        sender: 'agent',
        timestamp: Date.now(),
        type: response.type,
        data: response.data
      };
      
      // Add explanatory note for transaction requests
      if (response.type === AgentResponseType.TRANSACTION) {
        const enhancedMessage = `${response.message}\n\n*This transaction requires your wallet to sign it. If you approve, your wallet should prompt you to sign the transaction.*`;
        
        agentMessage.content = enhancedMessage;
      }
      
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: error instanceof Error ? error.message : 'An unknown error occurred',
        sender: 'agent',
        timestamp: Date.now(),
        type: AgentResponseType.ERROR
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to automatically check transaction status
  const sendStatusCheck = async () => {
    try {
      setIsLoading(true);
      const statusMessage = "What's the status of my transaction?";
      
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: statusMessage,
        sender: 'user',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      const response = await sendChatMessage(statusMessage);
      
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        content: response.message,
        sender: 'agent',
        timestamp: Date.now(),
        type: response.type
      };
      
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error("Failed to check transaction status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 bg-yellow-100 dark:bg-slate-700 border-b border-yellow-200 dark:border-slate-600">
        <h2 className="text-lg font-bold flex items-center">
          <span className="mr-2">🤖</span> AI Agent Chat
          {!isConnected && (
            <span className="ml-auto text-xs text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-100 dark:bg-red-900/20">
              Wallet Not Connected
            </span>
          )}
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-xl p-3 ${
                message.sender === 'user' 
                  ? 'bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-100' 
                  : message.type === AgentResponseType.ERROR
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    : message.type === AgentResponseType.SUCCESS
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                      : message.type === AgentResponseType.TRANSACTION || message.type === AgentResponseType.APPROVAL
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-100 dark:bg-slate-700'
              }`}
            >
              <MessageDisplay message={message} />
              <div className={`text-xs mt-1 ${
                message.sender === 'user' 
                  ? 'text-yellow-700 dark:text-yellow-300' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 p-3 bg-white dark:bg-slate-700 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-4 bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-slate-900 transition-colors duration-200"
            disabled={isLoading}
          >
            {isLoading ? <LoadingIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          Example commands: "check wallet balances", "aave dashboard", "swap 1 CELO to cUSD"
        </div>
      </form>
    </div>
  );
} 