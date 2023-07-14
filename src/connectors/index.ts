import { Web3Provider } from '@ethersproject/providers'
import { InjectedConnector } from '@web3-react/injected-connector'

import { WalletLinkConnector } from '@web3-react/walletlink-connector'

import { NetworkConnector } from './NetworkConnector'

// import { WalletConnect as WalletConnectV2 } from '@web3-react/walletconnect-v2'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'

import { customChains } from '../constants/chains'

export const NETWORK_URL = process.env.REACT_APP_NETWORK_URL
export const NETWORK_CHAIN_ID: number = parseInt(process.env.REACT_APP_CHAIN_ID ?? '1')

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
  supportedChainIds: [1, 3, 4, 5, 42, 31337, 167, 167001, 167005]
})

// mainnet only
export const walletlink = new WalletLinkConnector({
  url: NETWORK_URL,
  appName: 'Taiko',
  appLogoUrl:
    'https://mpng.pngfly.com/20181202/bex/kisspng-emoji-domain-unicorn-pin-badges-sticker-unicorn-tumblr-emoji-unicorn-iphoneemoji-5c046729264a77.5671679315437924251569.jpg'
})

export const walletconnect = new WalletConnectConnector({
  chains: customChains,
  options: {
    projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID ?? '',
    showQrModal: true
  }
})
