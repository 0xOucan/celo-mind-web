import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, LoadingIcon } from './Icons';
import { apiUrl } from '../config';
import { 
  sendChatMessage, 
  AgentResponseType, 
  ParsedAgentResponse, 
  fetchTransactionNotifications,
  TransactionNotification 
} from '../services/agentService';
import { useWallet } from '../providers/WalletContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: number;
  type?: AgentResponseType;
  requiresAction?: boolean;
  data?: any;
}

// Component to render message content with clickable links and transaction UI
const MessageDisplay = ({ message }: { message: Message }) => {
  const content = message.content;
  
  // Process content to make links clickable and handle transaction links
  const processContent = () => {
    let processed = content;
    
    // Clean up any HTML that might already be in the content
    processed = processed.replace(/<\/?[^>]+(>|$)/g, '');
    
    // Fix any doubly nested transaction URLs
    const nestedTxUrlRegex = /(https?:\/\/(?:celoscan\.io|explorer\.celo\.org)\/tx\/)(https?:\/\/(?:celoscan\.io|explorer\.celo\.org)\/tx\/)(0x[a-fA-F0-9]{64})/g;
    processed = processed.replace(nestedTxUrlRegex, (_, __, ___, hash) => {
      return `https://celoscan.io/tx/${hash}`;
    });
    
    // First handle View on Celoscan markdown links with proper formatting
    processed = processed.replace(/\[View on Celoscan\]\((https?:\/\/(?:celoscan\.io|explorer\.celo\.org)\/tx\/)(0x[a-fA-F0-9]{64})\)/g, 
      '<a href="$1$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">View on Celoscan</a>');
    
    // Replace broken/invalid transaction links with transaction panel reference
    processed = processed.replace(/https?:\/\/(?:celoscan\.io|explorer\.celo\.org)\/tx\/(?:undefined|null|0x[a-zA-Z0-9-]{1,20}|[a-zA-Z0-9-]{1,30})(?![a-zA-Z0-9])/g, 
      'You can monitor this transaction in the Transactions panel');
    
    // Find standalone Celoscan URLs that aren't already in links
    processed = processed.replace(/(?<!")(https?:\/\/(?:celoscan\.io|explorer\.celo\.org)\/tx\/)(0x[a-fA-F0-9]{64})(?!")/g, 
      '<a href="$1$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">View on Celoscan</a>');
    
    // Extract valid transaction hashes and create proper links
    const validTxHashRegex = /(?:Transaction hash|Hash|Transaction):\s*(0x[a-fA-F0-9]{64})/g;
    processed = processed.replace(validTxHashRegex, (match, hash) => {
      return `Transaction: <a href="https://celoscan.io/tx/${hash}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">View on Celoscan</a>`;
    });
    
    // Look for standalone transaction hashes (0x + 64 hex chars)
    const standaloneHashRegex = /\b(0x[a-fA-F0-9]{64})\b/g;
    processed = processed.replace(standaloneHashRegex, (match, hash) => {
      // Only replace if not already part of a link
      if (!processed.includes(`href="https://celoscan.io/tx/${hash}"`)) {
        return `<a href="https://celoscan.io/tx/${hash}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}</a>`;
      }
      return match;
    });
    
    // Process other markdown-style links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    processed = processed.replace(markdownLinkRegex, (match, text, url) => {
      // Remove any trailing punctuation from the URL
      const cleanUrl = url.replace(/[,.)]$/, '');
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${text}</a>`;
    });
    
    // Look for plain URLs that haven't been processed yet
    const urlRegex = /(?<!")(https?:\/\/[^\s),."]+)(?!")/g;
    processed = processed.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');
    
    return processed;
  };
  
  // Add special UI for transaction messages
  if (message.type === AgentResponseType.TRANSACTION || message.type === AgentResponseType.APPROVAL) {
    return (
      <div>
        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processContent() }} />
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
  } else if (message.type === AgentResponseType.APPROVAL_PENDING) {
    return (
      <div>
        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processContent() }} />
        <div className="mt-2 p-2 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            This transaction is waiting for a prior approval to be confirmed.
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            The system will automatically proceed with this transaction once the approval is confirmed.
            You can monitor all transaction statuses in the Transaction panel.
          </p>
        </div>
      </div>
    );
  }
  
  // Use dangerouslySetInnerHTML for all link rendering to avoid mixing approaches
  return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processContent() }} />;
};

export default function ChatInterface() {
  const { connectedAddress, isConnected } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [notificationCheckTime, setNotificationCheckTime] = useState<Date>(new Date());

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
          content: `👋 Hello! I'm CeloMΔIND, your AI-powered DeFi assistant for Celo blockchain. 
          
How can I help you today? You can ask me to:
- 💰 Check your wallet balances
- 🏦 Interact with AAVE lending protocol
- 🌊 Manage your ICHI vault investments
- 💱 Execute swaps on Mento

Just type your request below!`,
          sender: 'agent',
          timestamp: Date.now(),
          type: AgentResponseType.INFO
        }
      ]);
    }
  }, []);

  // Poll for transaction notifications
  useEffect(() => {
    if (!isConnected) return;
    
    const checkNotifications = async () => {
      try {
        const notifications = await fetchTransactionNotifications();
        
        if (notifications.length > 0) {
          console.log(`📢 Received ${notifications.length} new transaction notifications`);
          
          // Add notifications as agent messages
          notifications.forEach((notification: TransactionNotification) => {
            console.log(`📣 Notification: ${notification.message}`);
            
            setMessages(prev => {
              // Check if we already have this notification (avoid duplicates)
              const notificationId = `notification-${notification.id}`;
              if (prev.some(msg => msg.id === notificationId)) {
                return prev;
              }
              
              // Determine message type based on content
              let messageType = AgentResponseType.INFO;
              if (notification.message.includes('✅')) {
                messageType = AgentResponseType.SUCCESS;
              } else if (notification.message.includes('❌')) {
                messageType = AgentResponseType.ERROR;
              } else if (notification.message.includes('🔄')) {
                messageType = AgentResponseType.TRANSACTION;
              } else if (notification.message.includes('⏳')) {
                // Check if this is a pending approval or a regular pending transaction
                if (notification.message.includes('approval') && 
                    (notification.message.includes('waiting for approval') || 
                     notification.message.includes('approval is confirmed'))) {
                  messageType = AgentResponseType.APPROVAL_PENDING;
                } else {
                  messageType = AgentResponseType.TRANSACTION;
                }
              } else if (notification.message.includes('🚫')) {
                messageType = AgentResponseType.ERROR;
              } else if (notification.message.includes('approval') && 
                        notification.message.includes('confirmed')) {
                messageType = AgentResponseType.APPROVAL;
              }
              
              return [...prev, {
                id: notificationId,
                content: notification.message,
                sender: 'agent',
                timestamp: Date.now(),
                type: messageType
              }];
            });
          });
          
          // Update check time
          setNotificationCheckTime(new Date());
        }
      } catch (error) {
        console.error('Error fetching transaction notifications:', error);
      }
    };
    
    // Check for notifications immediately and then every 5 seconds
    checkNotifications();
    const intervalId = setInterval(checkNotifications, 5000);
    
    return () => clearInterval(intervalId);
  }, [isConnected]);

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