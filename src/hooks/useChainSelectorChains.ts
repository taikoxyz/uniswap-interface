import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { showTestnetsAtom } from 'components/AccountDrawer/TestnetsToggle'
import { getEnabledChainIds } from 'config/chains'
import { getConnection } from 'connection'
import { ConnectionType } from 'connection/types'
import { WalletConnectV2 } from 'connection/WalletConnectV2'
import { getChainPriority, TESTNET_CHAIN_IDS } from 'constants/chains'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { getSupportedChainIdsFromWalletConnectSession } from 'utils/getSupportedChainIdsFromWalletConnectSession'

export function useWalletSupportedChains(): ChainId[] {
  const { connector } = useWeb3React()
  const connectionType = getConnection(connector).type

  // Get only enabled chains from the registry
  const enabledChains = getEnabledChainIds()

  switch (connectionType) {
    case ConnectionType.WALLET_CONNECT_V2:
    case ConnectionType.UNISWAP_WALLET_V2: {
      const wcChains = getSupportedChainIdsFromWalletConnectSession((connector as WalletConnectV2).provider?.session)
      // Filter WalletConnect chains to only include enabled ones
      return wcChains.filter((chainId) => enabledChains.includes(chainId))
    }
    default:
      return enabledChains
  }
}

// Partitions the enabled chains into those the connected wallet supports and those it does not,
// hiding testnets unless the toggle is on and ordering both lists by chain priority.
export function usePartitionedChains(walletSupportedChains: ChainId[]): [ChainId[], ChainId[]] {
  const showTestnets = useAtomValue(showTestnetsAtom)

  return useMemo(() => {
    const { supported, unsupported } = getEnabledChainIds()
      .filter((chain: number) => {
        return showTestnets || !TESTNET_CHAIN_IDS.includes(chain)
      })
      .sort((a, b) => getChainPriority(a) - getChainPriority(b))
      .reduce(
        (acc, chain) => {
          if (walletSupportedChains.includes(chain)) {
            acc.supported.push(chain)
          } else {
            acc.unsupported.push(chain)
          }
          return acc
        },
        { supported: [], unsupported: [] } as Record<string, ChainId[]>
      )
    return [supported, unsupported]
  }, [showTestnets, walletSupportedChains])
}
