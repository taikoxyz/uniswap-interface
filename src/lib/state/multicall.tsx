import { createMulticall, ListenerOptions } from '@uniswap/redux-multicall'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { useInterfaceMulticall, useMainnetInterfaceMulticall } from 'hooks/useContract'
import useBlockNumber, { useMainnetBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useMemo, useState } from 'react'

const multicall = createMulticall()

export default multicall

// Taiko produces a block every ~2s. The redux-multicall Updater cancels every
// in-flight fetch whenever the block number it receives changes, so if a
// provider's round trip is slower than the block interval (common for wallet
// extensions and WalletConnect, especially under RPC rate limits), results are
// discarded before they ever land and pages that block on multicall data
// (e.g. /pools) load forever. Only advancing the block number fed to the
// Updater every N blocks gives fetches an ~N-block window to complete while
// still refreshing data at the ~12s cadence the interface was designed for.
const MULTICALL_BLOCK_QUANTIZATION = 6

function useQuantizedBlockNumber(blockNumber: number | undefined, step: number): number | undefined {
  const [quantized, setQuantized] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (blockNumber === undefined) return
    setQuantized((prev) => {
      // Advance only in `step` increments; take the new number directly if it
      // moved backwards (chain switch or reorg).
      if (prev === undefined || blockNumber >= prev + step || blockNumber < prev) return blockNumber
      return prev
    })
  }, [blockNumber, step])
  return quantized
}

/**
 *
 * @param chainId
 * @returns The approximate whole number of blocks written to the corresponding chainId per Ethereum mainnet epoch.
 */
function getBlocksPerFetchForChainId(chainId: number | undefined): number {
  // TODO(WEB-2437): See if these numbers need to be updated
  switch (chainId) {
    case ChainId.ARBITRUM_ONE:
    case ChainId.OPTIMISM:
      return 15
    case ChainId.AVALANCHE:
    case ChainId.BNB:
    case ChainId.CELO:
    case ChainId.CELO_ALFAJORES:
      return 5
    // Taiko produces a block every ~2s. Refetching on every block makes
    // redux-multicall cancel in-flight batches each time a new block arrives,
    // so a wallet provider whose round trip exceeds the block interval never
    // delivers a result and pages that block on multicall data (e.g. /pools)
    // load forever. Fetching once per ~6 blocks (~12s) restores the cadence
    // the interface was designed around and gives slow providers time to
    // respond.
    case TAIKO_MAINNET_CHAIN_ID:
    case TAIKO_HOODI_CHAIN_ID:
      return 6
    default:
      return 1
  }
}

export function MulticallUpdater() {
  const { chainId } = useWeb3React()
  const latestBlockNumber = useQuantizedBlockNumber(useBlockNumber(), MULTICALL_BLOCK_QUANTIZATION)
  const latestMainnetBlockNumber = useQuantizedBlockNumber(useMainnetBlockNumber(), MULTICALL_BLOCK_QUANTIZATION)
  const contract = useInterfaceMulticall()
  const mainnetContract = useMainnetInterfaceMulticall()
  const listenerOptions: ListenerOptions = useMemo(
    () => ({
      blocksPerFetch: getBlocksPerFetchForChainId(chainId),
    }),
    [chainId]
  )
  // In this Taiko-only fork the "mainnet" updater is fed Taiko mainnet blocks
  // and the Taiko multicall contract (see useMainnetInterfaceMulticall), so it
  // must use the Taiko fetch cadence rather than Ethereum mainnet's.
  const mainnetListener: ListenerOptions = useMemo(
    () => ({
      blocksPerFetch: getBlocksPerFetchForChainId(TAIKO_MAINNET_CHAIN_ID),
    }),
    []
  )

  return (
    <>
      <multicall.Updater
        chainId={ChainId.MAINNET}
        latestBlockNumber={latestMainnetBlockNumber}
        contract={mainnetContract}
        listenerOptions={mainnetListener}
      />
      {chainId !== ChainId.MAINNET && (
        <multicall.Updater
          chainId={chainId}
          latestBlockNumber={latestBlockNumber}
          contract={contract}
          listenerOptions={listenerOptions}
        />
      )}
    </>
  )
}
