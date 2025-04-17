/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_API_URL: string;
  readonly VITE_CELO_RPC_URL: string;
  readonly VITE_CELO_EXPLORER_URL: string;
  readonly VITE_CELO_CHAIN_ID: string;
  readonly VITE_DEFAULT_THEME: string;
  readonly VITE_DEBUG_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 