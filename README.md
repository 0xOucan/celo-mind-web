# 🧠 CeloMΔIND Web Interface

A modern, responsive web interface for the CeloMΔIND AI-powered DeFi agent, enabling seamless interaction with the Celo blockchain ecosystem.

## 🌟 Features

- 💬 Natural language AI chat interface for DeFi interactions
- 💰 Real-time wallet balance tracking with USD conversion
- 🏦 Integration with AAVE, ICHI, and Mento protocols
- 🌓 Light/Dark theme toggle with system preference detection
- 📱 Responsive design optimized for both desktop and mobile
- 💫 Smooth animations and transitions for enhanced UX
- 🔒 Secure local storage for user preferences

## 🚀 Getting Started

### Prerequisites

- Node.js v16+ and npm/yarn
- CeloMΔIND backend API running (refer to the [celo-mind-dn](../celo-mind-dn) repository)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/celo-mind-web.git
cd celo-mind-web
```

2. Install dependencies:
```bash
npm install
# or with yarn
yarn
```

3. Create a `.env` file in the project root:
```
VITE_API_URL=http://localhost:4000
VITE_CELO_EXPLORER_URL=https://celoscan.io
```

4. Start the development server:
```bash
npm run dev
# or with yarn
yarn dev
```

5. Open your browser and navigate to:
```
http://localhost:5173
```

## 🔧 Project Structure

```
celo-mind-web/
├── src/
│   ├── components/             # React components
│   │   ├── ChatInterface.tsx   # AI chat interface component
│   │   ├── Header.tsx          # App header with theme toggle
│   │   ├── InfoPanel.tsx       # Welcome/information panel
│   │   └── WalletBalances.tsx  # Wallet balance display
│   ├── config.ts               # Configuration constants
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles (Tailwind)
├── public/                     # Static assets
├── .env                        # Environment variables (create locally)
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

## 🧩 How It Works

1. The frontend connects to the CeloMΔIND AI agent backend API
2. Users can send natural language commands through the chat interface
3. The AI processes requests and returns formatted responses
4. The interface provides real-time wallet balance updates and protocol interactions

## 🌐 Deploying to Production

### Build for Production

```bash
npm run build
# or with yarn
yarn build
```

This creates a `dist` directory with optimized assets ready for deployment to any static hosting provider.

### Deployment Options

- **Vercel/Netlify**: Connect your GitHub repository for automatic deployments
- **GitHub Pages**: Deploy the static build using GitHub Actions
- **AWS S3/CloudFront**: For scalable, CDN-backed hosting
- **Docker**: Use the included Dockerfile for containerized deployment

## 🔐 Security Considerations

- API keys and private keys are managed by the backend only
- No sensitive wallet data is stored in the browser
- Secure connection between frontend and backend via HTTPS
- Input validation for all user commands

## 📦 Dependencies

- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast build tool and dev server

## 🧪 Testing

```bash
npm run test
# or with yarn
yarn test
```

## 🤝 Contributing

We welcome contributions to improve CeloMΔIND Web! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Contact

- GitHub: [your-username](https://github.com/your-username)
- Twitter: [@your-handle](https://twitter.com/your-handle) 