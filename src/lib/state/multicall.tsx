import { createMulticall, ListenerOptions } from '@uniswap/redux-multicall'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { useInterfaceMulticall, useMainnetInterfaceMulticall } from 'hooks/useContract'
import { useMainnetRefetchBlockNumber, useRefetchBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useState } from 'react'
import { useAppSelector } from 'state/hooks'

const multicall = createMulticall()

export default multicall

// The redux-multicall Updater refetches every listening call whenever the block number it
// receives advances past `blocksPerFetch`, and cancels in-flight fetches whenever it changes at
// all — so on a chain producing a block every second or two it must not be fed the raw block
// feed. It is fed the wall-clock-gated feed (useRefetchBlockNumber) instead, which advances at
// most once per data refresh window (~12s) regardless of block cadence, and snaps forward when a
// receipt for one of the user's own transactions confirms so user-relevant data (balances,
// allowances, positions) refetches immediately instead of waiting out the window.
//
// With cadence owned by that time gate, `blocksPerFetch` must be 1: every advance of the gated
// feed means "a window has elapsed (or a receipt landed) — refetch now". Any larger value would
// re-introduce a block-count dependency and skip windows whenever the chain happened to produce
// fewer blocks than that per window.
const LISTENER_OPTIONS: ListenerOptions = { blocksPerFetch: 1 }

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

export function MulticallUpdater() {
  const { chainId } = useWeb3React()
  const latestBlockNumber = useRefetchBlockNumber()
  // In this Taiko-only fork the "mainnet" feed carries Taiko mainnet blocks
  // (see useMainnetInterfaceMulticall), so it gates, snaps, and fetches on
  // the Taiko mainnet cadence rather than Ethereum mainnet's. Its feed is
  // always Taiko-mainnet-keyed, no matter which chain the wallet is on.
  const latestMainnetBlockNumber = useMainnetRefetchBlockNumber()
  const isFetching = useMulticallFetching(chainId)
  const isMainnetFetching = useMulticallFetching(ChainId.MAINNET)
  const settledBlockNumber = useSettledBlockNumber(chainId, latestBlockNumber, isFetching)
  const settledMainnetBlockNumber = useSettledBlockNumber(ChainId.MAINNET, latestMainnetBlockNumber, isMainnetFetching)
  const contract = useInterfaceMulticall()
  const mainnetContract = useMainnetInterfaceMulticall()

  return (
    <>
      <multicall.Updater
        chainId={ChainId.MAINNET}
        latestBlockNumber={settledMainnetBlockNumber}
        contract={mainnetContract}
        listenerOptions={LISTENER_OPTIONS}
      />
      {chainId !== ChainId.MAINNET && (
        // redux-multicall stores cancellation callbacks on the updater
        // instance, so remount it to keep callbacks from crossing chains.
        <multicall.Updater
          key={chainId}
          chainId={chainId}
          latestBlockNumber={settledBlockNumber}
          contract={contract}
          listenerOptions={LISTENER_OPTIONS}
        />
      )}
    </>
  )
}
