import { createMulticall, ListenerOptions } from '@uniswap/redux-multicall'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { blocksPerWindow, DATA_REFRESH_WINDOW_MS, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { useInterfaceMulticall, useMainnetInterfaceMulticall } from 'hooks/useContract'
import useBlockNumber, { useFastForwardedBlockNumber, useMainnetBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useMemo, useState } from 'react'
import { useAppSelector } from 'state/hooks'

const multicall = createMulticall()

export default multicall

// The redux-multicall Updater cancels every in-flight fetch whenever the block
// number it receives changes, so if a provider's round trip is slower than the
// block interval (common for wallet extensions and WalletConnect, especially
// under RPC rate limits), results are discarded before they ever land and
// pages that block on multicall data (e.g. /pools) load forever. Advancing the
// desired block once per data refresh window — a block count derived from the
// chain's block time: 6 blocks at today's 2s Taiko cadence, 24 if Taiko moves
// to 0.5s — preserves the interface's intended refresh cadence.
// `useSettledBlockNumber` below then prevents even slower fetches from being
// cancelled at a window boundary.
//
// `snapTo` cuts through the window: it carries the block number of a confirmed
// receipt for one of the user's own transactions, proof that state relevant to
// the user changed. Snapping the quantized feed to it makes dependent data
// (balances, allowances, positions) refetch immediately instead of waiting out
// the remainder of the window.
//
// The quantized value is keyed by `chainId`: block numbers from different
// chains are not comparable, so after a chain switch the hook returns
// undefined until the new chain's feed produces a block (which is adopted
// directly), rather than leaking the previous chain's number to the new
// chain's updater. Exported for testing.
export function useQuantizedBlockNumber(
  chainId: number | undefined,
  blockNumber: number | undefined,
  step: number,
  snapTo?: number
): number | undefined {
  const [quantized, setQuantized] = useState<{ chainId?: number; block?: number }>({})
  useEffect(() => {
    if (chainId === undefined || blockNumber === undefined) return
    setQuantized((prev) => {
      // The first block observed for a chain is adopted directly; afterwards
      // advance only in `step` increments, and take the new number directly if
      // it moved backwards (reorg).
      if (
        prev.chainId !== chainId ||
        prev.block === undefined ||
        blockNumber >= prev.block + step ||
        blockNumber < prev.block
      ) {
        return { chainId, block: blockNumber }
      }
      return prev
    })
  }, [chainId, blockNumber, step])
  useEffect(() => {
    if (chainId === undefined || snapTo === undefined) return
    setQuantized((prev) =>
      prev.chainId === chainId && prev.block !== undefined && snapTo <= prev.block ? prev : { chainId, block: snapTo }
    )
  }, [chainId, snapTo])
  return quantized.chainId === chainId ? quantized.block : undefined
}

// Keep the block given to redux-multicall stable until its current request
// settles. The dependency cancels in-flight work when this value changes; once
// fetching clears, forwarding the latest desired block exposes the settled
// result first and then starts a background refresh.
export function useSettledBlockNumber(
  chainId: number | undefined,
  desiredBlockNumber: number | undefined,
  isFetching: boolean
): number | undefined {
  const [settled, setSettled] = useState<{ chainId?: number; block?: number }>({})
  useEffect(() => {
    // While fetching, the desired block keeps changing; adopt its latest value
    // on the first render after fetching clears.
    if (!isFetching) {
      setSettled({ chainId, block: desiredBlockNumber })
    }
  }, [chainId, desiredBlockNumber, isFetching])
  return settled.chainId === chainId ? settled.block : undefined
}

function useMulticallFetching(chainId: number | undefined): boolean {
  return useAppSelector((state) => {
    if (chainId === undefined) return false
    const callResults = state.multicall.callResults[chainId] ?? {}
    for (const callKey in callResults) {
      if (typeof callResults[callKey].fetchingBlockNumber === 'number') return true
    }
    return false
  })
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
    chainId,
    useBlockNumber(),
    blocksPerWindow(chainId, DATA_REFRESH_WINDOW_MS),
    fastForwardedBlock
  )
  // In this Taiko-only fork the "mainnet" feed carries Taiko mainnet blocks
  // (see useMainnetInterfaceMulticall), so it quantizes, snaps, and fetches on
  // the Taiko mainnet cadence rather than Ethereum mainnet's. Its feed is
  // always Taiko-mainnet-keyed, no matter which chain the wallet is on.
  const latestMainnetBlockNumber = useQuantizedBlockNumber(
    TAIKO_MAINNET_CHAIN_ID,
    useMainnetBlockNumber(),
    blocksPerWindow(TAIKO_MAINNET_CHAIN_ID, DATA_REFRESH_WINDOW_MS),
    chainId === TAIKO_MAINNET_CHAIN_ID ? fastForwardedBlock : undefined
  )
  const isFetching = useMulticallFetching(chainId)
  const isMainnetFetching = useMulticallFetching(ChainId.MAINNET)
  const settledBlockNumber = useSettledBlockNumber(chainId, latestBlockNumber, isFetching)
  const settledMainnetBlockNumber = useSettledBlockNumber(ChainId.MAINNET, latestMainnetBlockNumber, isMainnetFetching)
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
        latestBlockNumber={settledMainnetBlockNumber}
        contract={mainnetContract}
        listenerOptions={mainnetListener}
      />
      {chainId !== ChainId.MAINNET && (
        // redux-multicall stores cancellation callbacks on the updater
        // instance, so remount it to keep callbacks from crossing chains.
        <multicall.Updater
          key={chainId}
          chainId={chainId}
          latestBlockNumber={settledBlockNumber}
          contract={contract}
          listenerOptions={listenerOptions}
        />
      )}
    </>
  )
}
