import { createMulticall, ListenerOptions } from '@uniswap/redux-multicall'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { blocksPerWindow, DATA_REFRESH_WINDOW_MS, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { useInterfaceMulticall, useMainnetInterfaceMulticall } from 'hooks/useContract'
import useBlockNumber, { useFastForwardedBlockNumber, useMainnetBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useMemo, useState } from 'react'

const multicall = createMulticall()

export default multicall

// The redux-multicall Updater cancels every in-flight fetch whenever the block
// number it receives changes, so if a provider's round trip is slower than the
// block interval (common for wallet extensions and WalletConnect, especially
// under RPC rate limits), results are discarded before they ever land and
// pages that block on multicall data (e.g. /pools) load forever. Only
// advancing the block number fed to the Updater once per data refresh window —
// a block count derived from the chain's block time: 6 blocks at today's 2s
// Taiko cadence, 24 if Taiko moves to 0.5s — gives fetches a full window to
// complete while still refreshing at the cadence the interface was designed
// for.
//
// `snapTo` cuts through the window: it carries the block number of a confirmed
// receipt for one of the user's own transactions, proof that state relevant to
// the user changed. Snapping the quantized feed to it makes dependent data
// (balances, allowances, positions) refetch immediately instead of waiting out
// the remainder of the window. Exported for testing.
export function useQuantizedBlockNumber(
  blockNumber: number | undefined,
  step: number,
  snapTo?: number
): number | undefined {
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
  useEffect(() => {
    if (snapTo === undefined) return
    setQuantized((prev) => (prev === undefined || snapTo > prev ? snapTo : prev))
  }, [snapTo])
  return quantized
}

/**
 *
 * @param chainId
 * @returns The number of blocks to wait between multicall fetches: the blocks the chain produces
 * within the app's data refresh window, so refetch cadence is constant wall time (~12s) no matter
 * how fast the chain produces blocks.
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
    default:
      // Derived from the per-chain block time table (config/chains/blockTime):
      // 6 blocks on 2s Taiko chains, 24 at a future 0.5s cadence, 1 on
      // Ethereum-cadence chains.
      return blocksPerWindow(chainId, DATA_REFRESH_WINDOW_MS)
  }
}

export function MulticallUpdater() {
  const { chainId } = useWeb3React()
  const fastForwardedBlock = useFastForwardedBlockNumber()
  const latestBlockNumber = useQuantizedBlockNumber(
    useBlockNumber(),
    blocksPerWindow(chainId, DATA_REFRESH_WINDOW_MS),
    fastForwardedBlock
  )
  // In this Taiko-only fork the "mainnet" feed carries Taiko mainnet blocks
  // (see useMainnetInterfaceMulticall), so it quantizes, snaps, and fetches on
  // the Taiko mainnet cadence rather than Ethereum mainnet's.
  const latestMainnetBlockNumber = useQuantizedBlockNumber(
    useMainnetBlockNumber(),
    blocksPerWindow(TAIKO_MAINNET_CHAIN_ID, DATA_REFRESH_WINDOW_MS),
    chainId === TAIKO_MAINNET_CHAIN_ID ? fastForwardedBlock : undefined
  )
  const contract = useInterfaceMulticall()
  const mainnetContract = useMainnetInterfaceMulticall()
  const listenerOptions: ListenerOptions = useMemo(
    () => ({
      blocksPerFetch: getBlocksPerFetchForChainId(chainId),
    }),
    [chainId]
  )
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
