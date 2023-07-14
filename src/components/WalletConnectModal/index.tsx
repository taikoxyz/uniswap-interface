import { Web3Modal } from '@web3modal/react'
import { ThemeContext } from 'styled-components'
import { useContext } from 'react'
import { configureChains, createConfig } from 'wagmi'

import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { customChains, PUBLIC_L2_CHAIN_ID, PUBLIC_L1_CHAIN_ID } from '../../constants/chains'
import { useDarkModeManager } from '../../state/user/hooks'

import TaikoIcon from '../../assets/images/taiko-chain.png'
import EthereumIcon from '../../assets/images/ethereum-chain.png'

const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID ?? ''
const chains = [...customChains]

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ chains, projectId }),
  publicClient
})
const ethereumClient = new EthereumClient(wagmiConfig, chains)

export function useStyledTheme() {
  return useContext(ThemeContext)
}

export default function WalletConnectModal() {
  const theme = useStyledTheme()
  const [isDark] = useDarkModeManager()
  //react component to return a headline and a button
  return (
    <Web3Modal
      chainImages={getChainImages()}
      projectId={projectId}
      ethereumClient={ethereumClient}
      themeVariables={{
        '--w3m-overlay-backdrop-filter': 'blur(10px)',
        '--w3m-accent-color': theme.primary1,
        '--w3m-background-color': theme.primary1
      }}
      themeMode={isDark ? 'dark' : 'light'}
    />
  )
}

const getChainImages = (): { [id: number]: string } => {
  const chainImages: { [id: number]: string } = {}
  customChains.forEach((chain) => {
    switch (chain.id) {
      case Number(PUBLIC_L1_CHAIN_ID):
        chainImages[chain.id] = EthereumIcon
        break
      case Number(PUBLIC_L2_CHAIN_ID):
        chainImages[chain.id] = TaikoIcon
        break
      default:
        break
    }
  })
  return chainImages
}
