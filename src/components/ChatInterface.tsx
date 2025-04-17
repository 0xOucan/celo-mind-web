import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, LoadingIcon } from './Icons';
import { apiUrl } from '../config';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: number;
}

// Component to render message content with clickable links
const MessageDisplay = ({ content }: { content: string }) => {
  // Process content to make links clickable
  const processContent = () => {
    // First check if we have markdown-style links [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    if (markdownLinkRegex.test(content)) {
      // If markdown links are present, process with markdown formatting
      return content.replace(markdownLinkRegex, (match, text, url) => {
        // Remove any trailing punctuation from the URL
        const cleanUrl = url.replace(/[,.)]$/, '');
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${text}</a>`;
      });
    } else {
      // Otherwise just look for plain URLs
      const urlRegex = /(https?:\/\/[^\s),.]+)/g;
      return content.replace(urlRegex, '<a href="$&" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$&</a>');
    }
  };
  
  // Use dangerouslySetInnerHTML for all link rendering to avoid mixing approaches
  return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processContent() }} />;
};

export default function ChatInterface() {
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
          content: `👋 Hello! I'm CeloMΔIND, your AI-powered DeFi assistant for Celo blockchain. 
          
How can I help you today? You can ask me to:
- 💰 Check your wallet balances
- 🏦 Interact with AAVE lending protocol
- 🌊 Manage your ICHI vault investments
- 💱 Execute swaps on Mento

Just type your request below!`,
          sender: 'agent',
          timestamp: Date.now()
        }
      ]);
    }
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
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
      const response = await fetch(`${apiUrl}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userInput: input })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          content: data.response || 'Sorry, I encountered an error processing your request.',
          sender: 'agent',
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, agentMessage]);
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          content: `Error: ${data.error || 'Failed to get a response'}`,
          sender: 'agent',
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: 'Network error. Please check your connection and try again.',
        sender: 'agent',
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 bg-yellow-100 dark:bg-slate-700 border-b border-yellow-200 dark:border-slate-600">
        <h2 className="text-lg font-bold flex items-center">
          <span className="mr-2">🤖</span> AI Agent Chat
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
                  : 'bg-gray-100 dark:bg-slate-700'
              }`}
            >
              <MessageDisplay content={message.content} />
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