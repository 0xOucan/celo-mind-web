# 🧠 CeloMΔIND Web Interface

A modern, responsive web interface for the CeloMΔIND AI-powered DeFi interface on the Celo blockchain.

## 🌟 Features

- 💬 Natural language AI chat interface for DeFi operations
- 💰 Real-time wallet balance tracking with USD conversion
- 🌓 Light/Dark theme toggle with system preference detection
- 📱 Responsive design for desktop and mobile devices
- 🔒 Direct blockchain connection for verification
- ⚡ Integration with multiple DeFi protocols (AAVE, ICHI, Mento)

## 🚀 Getting Started

### Prerequisites

- Node.js v16+ and npm v7+
- CeloMΔIND backend API running and accessible
- Web browser with JavaScript enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/0xOucan/celo-mind-web.git
cd celo-mind-web

# Install dependencies
npm install

# Create environment file with API URL
echo "VITE_API_URL=http://localhost:4000" > .env

# Start the development server
npm run dev
```

### Configuration

The application requires the following environment variables:

```
# API endpoint for the CeloMΔIND backend
VITE_API_URL=http://localhost:4000
```

## 🔌 Backend Integration

This web interface connects to the [CeloMΔIND backend API](https://github.com/0xOucan/celo-mind-dn) to process commands and execute blockchain operations.

### Communication Flow

1. **User Interface**: The web frontend collects user inputs through a conversational interface
2. **API Requests**: Frontend sends natural language commands to the `/api/agent/chat` endpoint
3. **AI Processing**: Backend processes commands using advanced AI and Agent Orchestration
4. **Blockchain Operations**: Backend executes necessary blockchain transactions
5. **Response Handling**: Frontend displays results and updates wallet balances

### Direct Blockchain Interaction

The web interface also connects directly to the Celo blockchain via the `blockchainService.ts` module to:

- Query token balances in real-time
- Calculate portfolio value in USD
- Verify transactions executed by the backend

## 📂 Project Structure

```
celo-mind-web/
├── src/
│   ├── components/           # React UI components
│   │   ├── ChatInterface.tsx # AI chat interface
│   │   ├── Header.tsx        # Application header
│   │   ├── Icons.tsx         # SVG icon components
│   │   ├── InfoPanel.tsx     # Welcome/information panel
│   │   └── WalletBalances.tsx # Wallet balance display
│   ├── services/
│   │   └── blockchainService.ts # Blockchain connection services
│   ├── App.tsx               # Main application component
│   ├── config.ts             # Application configuration
│   ├── index.css             # Global CSS
│   └── main.tsx              # Application entry point
├── index.html                # HTML template
├── package.json              # Project dependencies and scripts
├── postcss.config.js         # PostCSS configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite bundler configuration
```

## 🌐 Running the Complete Stack

For the best experience, run both the frontend and backend together:

```bash
# Start both servers using the launch script
./launch.sh
```

This will start:
- Backend API server at http://localhost:4000
- Frontend development server at http://localhost:5173

## 🔐 Security Considerations

- The web interface never has access to private keys
- All sensitive operations are performed by the backend
- Transactions require explicit user confirmation
- Connection to the Celo blockchain uses secure RPC endpoints

## 👨‍💻 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔗 Related Projects

- [CeloMΔIND Backend (DN)](https://github.com/0xOucan/celo-mind-dn) - AI agent backend for Celo DeFi operations

## 📧 Contact

- Twitter: [@0xoucan](https://x.com/0xoucan)

## 📄 License

This project is licensed under the MIT License.
