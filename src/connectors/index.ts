import { Web3Provider } from '@ethersproject/providers'
import { InjectedConnector } from '@web3-react/injected-connector'

import { NetworkConnector } from './NetworkConnector'

import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'

import { customChains } from '../constants/chains'

export const isL3Swap = process.env.REACT_APP_L3_ENABLED?.toLowerCase() === 'true' || false

export const NETWORK_URL = process.env.REACT_APP_NETWORK_URL

let networkChainId: number
if (isL3Swap) {
  networkChainId = parseInt(process.env.REACT_APP_PUBLIC_L3_CHAIN_ID ?? '1')
} else {
  networkChainId = parseInt(process.env.REACT_APP_PUBLIC_L2_CHAIN_ID ?? '1')
}

export const NETWORK_CHAIN_ID = networkChainId

if (typeof NETWORK_URL === 'undefined') {
  throw new Error(`REACT_APP_NETWORK_URL must be a defined environment variable`)
}

export const network = new NetworkConnector({
  urls: { [NETWORK_CHAIN_ID]: NETWORK_URL }
})

let networkLibrary: Web3Provider | undefined
export function getNetworkLibrary(): Web3Provider {
  return (networkLibrary = networkLibrary ?? new Web3Provider(network.provider as any, 'any'))
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 31337, 167, 167001, 167005, 167006,167007]
})

export const walletconnect = new WalletConnectConnector({
  chains: customChains,
  options: {
    projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID ?? '',
    showQrModal: true
  }
})
