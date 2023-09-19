import type { Chain } from 'wagmi'

// General properties
export const PUBLIC_L1_CHAIN_ID = process.env.REACT_APP_PUBLIC_L1_CHAIN_ID || 'missing L1 chain id'
export const PUBLIC_L1_CHAIN_NAME = process.env.REACT_APP_PUBLIC_L1_CHAIN_NAME || 'missing L1 chain name'
export const PUBLIC_L2_CHAIN_ID = process.env.REACT_APP_PUBLIC_L2_CHAIN_ID || 'missing L2 chain id'
export const PUBLIC_L2_CHAIN_NAME = process.env.REACT_APP_PUBLIC_L2_CHAIN_NAME || 'missing L2 chain name'
export const PUBLIC_L3_CHAIN_ID = process.env.REACT_APP_PUBLIC_L3_CHAIN_ID || 'missing L3 chain id'
export const PUBLIC_L3_CHAIN_NAME = process.env.REACT_APP_PUBLIC_L3_CHAIN_NAME || 'missing L3 chain name'

// Explorer
const PUBLIC_L1_EXPLORER_URL = process.env.REACT_APP_PUBLIC_L1_EXPLORER_URL || 'missing L1 explorer url'
const PUBLIC_L2_EXPLORER_URL = process.env.REACT_APP_PUBLIC_L2_EXPLORER_URL || 'missing L2 explorer url'
const PUBLIC_L3_EXPLORER_URL = process.env.REACT_APP_PUBLIC_L3_EXPLORER_URL || 'missing L3 explorer url'

// RPC
const PUBLIC_L1_RPC_URL = process.env.REACT_APP_PUBLIC_L1_RPC_URL || 'missing L1 rpc url'
const PUBLIC_L2_RPC_URL = process.env.REACT_APP_PUBLIC_L2_RPC_URL || 'missing L2 rpc url'
const PUBLIC_L3_RPC_URL = process.env.REACT_APP_PUBLIC_L3_RPC_URL || 'missing L3 rpc url'

// Bridge
const PUBLIC_L1_BRIDGE_ADDRESS = process.env.REACT_APP_PUBLIC_L1_BRIDGE_ADDRESS || 'missing L1 bridge address'
const PUBLIC_L2_BRIDGE_ADDRESS = process.env.REACT_APP_PUBLIC_L2_BRIDGE_ADDRESS || 'missing L2 bridge address'
const PUBLIC_L3_BRIDGE_ADDRESS = process.env.REACT_APP_PUBLIC_L3_BRIDGE_ADDRESS || 'missing L3 bridge address'

// Cross Chain Sync
const PUBLIC_L1_CROSS_CHAIN_SYNC_ADDRESS =
  process.env.REACT_APP_PUBLIC_L1_CROSS_CHAIN_SYNC_ADDRESS || 'missing L1 cross chain sync address'
const PUBLIC_L2_CROSS_CHAIN_SYNC_ADDRESS =
  process.env.REACT_APP_PUBLIC_L2_CROSS_CHAIN_SYNC_ADDRESS || 'missing L2 cross chain sync address'
const PUBLIC_L3_CROSS_CHAIN_SYNC_ADDRESS =
  process.env.REACT_APP_PUBLIC_L3_CROSS_CHAIN_SYNC_ADDRESS || 'missing L3 cross chain sync address'

// Signal Service
const PUBLIC_L1_SIGNAL_SERVICE_ADDRESS =
  process.env.REACT_APP_PUBLIC_L1_SIGNAL_SERVICE_ADDRESS || 'missing L1 signal service address'
const PUBLIC_L2_SIGNAL_SERVICE_ADDRESS =
  process.env.REACT_APP_PUBLIC_L2_SIGNAL_SERVICE_ADDRESS || 'missing L2 signal service address'
const PUBLIC_L3_SIGNAL_SERVICE_ADDRESS =
  process.env.REACT_APP_PUBLIC_L3_SIGNAL_SERVICE_ADDRESS || 'missing L3 signal service address'

export const mainnetChain: Chain = {
  id: parseInt(PUBLIC_L1_CHAIN_ID),
  name: PUBLIC_L1_CHAIN_NAME,
  network: 'L1',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    public: { http: [PUBLIC_L1_RPC_URL] },
    default: { http: [PUBLIC_L1_RPC_URL] }
  },
  blockExplorers: {
    default: {
      name: 'Main',
      url: PUBLIC_L1_EXPLORER_URL
    }
  }
}

export const taikoChain: Chain = {
  id: parseInt(PUBLIC_L2_CHAIN_ID),
  name: PUBLIC_L2_CHAIN_NAME,
  network: 'L2',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    public: { http: [PUBLIC_L2_RPC_URL] },
    default: { http: [PUBLIC_L2_RPC_URL] }
  },
  blockExplorers: {
    default: {
      name: 'Main',
      url: PUBLIC_L2_EXPLORER_URL
    }
  }
}

export const l3Chain: Chain = {
  id: parseInt(PUBLIC_L3_CHAIN_ID),
  name: PUBLIC_L3_CHAIN_NAME,
  network: 'L2',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    public: { http: [PUBLIC_L3_RPC_URL] },
    default: { http: [PUBLIC_L3_RPC_URL] }
  },
  blockExplorers: {
    default: {
      name: 'Main',
      url: PUBLIC_L3_EXPLORER_URL
    }
  }
}

export const customChains = [mainnetChain, taikoChain]

export const chainContractsMap = {
  [PUBLIC_L1_CHAIN_ID]: {
    bridgeAddress: PUBLIC_L1_BRIDGE_ADDRESS,
    crossChainSyncAddress: PUBLIC_L1_CROSS_CHAIN_SYNC_ADDRESS,
    signalServiceAddress: PUBLIC_L1_SIGNAL_SERVICE_ADDRESS
  },
  [PUBLIC_L2_CHAIN_ID]: {
    bridgeAddress: PUBLIC_L2_BRIDGE_ADDRESS,
    crossChainSyncAddress: PUBLIC_L2_CROSS_CHAIN_SYNC_ADDRESS,
    signalServiceAddress: PUBLIC_L2_SIGNAL_SERVICE_ADDRESS
  },
  [PUBLIC_L3_CHAIN_ID]: {
    bridgeAddress: PUBLIC_L3_BRIDGE_ADDRESS,
    crossChainSyncAddress: PUBLIC_L3_CROSS_CHAIN_SYNC_ADDRESS,
    signalServiceAddress: PUBLIC_L3_SIGNAL_SERVICE_ADDRESS
  }
}
