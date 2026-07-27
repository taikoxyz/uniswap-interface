import { useWeb3React } from '@web3-react/core'
import { DATA_REFRESH_WINDOW_MS, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { RPC_PROVIDERS } from 'constants/providers'
import useIsWindowVisible from 'hooks/useIsWindowVisible'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const MISSING_PROVIDER = Symbol()
const BlockNumberContext = createContext<
  | {
      fastForward(block: number): void
      block?: number
      mainnetBlock?: number
      fastForwardedBlock?: number
      refetchBlock?: number
      mainnetRefetchBlock?: number
    }
  | typeof MISSING_PROVIDER
>(MISSING_PROVIDER)

function useBlockNumberContext() {
  const blockNumber = useContext(BlockNumberContext)
  if (blockNumber === MISSING_PROVIDER) {
    throw new Error('BlockNumber hooks must be wrapped in a <BlockNumberProvider>')
  }
  return blockNumber
}

export function useFastForwardBlockNumber(): (block: number) => void {
  return useBlockNumberContext().fastForward
}

/** Requires that BlockUpdater be installed in the DOM tree. */
export default function useBlockNumber(): number | undefined {
  return useBlockNumberContext().block
}

/**
 * The highest block number observed via a confirmed transaction receipt on the active chain
 * (see useFastForwardBlockNumber). Unlike the raw block feed, this only moves when one of the
 * user's own transactions confirms, so consumers that deliberately lag the raw feed (e.g. the
 * refetch feed below) can use it to refresh immediately after a user action.
 */
export function useFastForwardedBlockNumber(): number | undefined {
  return useBlockNumberContext().fastForwardedBlock
}

/**
 * The block number chain-data refetching should key on. Unlike the raw feed, which moves on
 * every block the provider reports (~every second on Taiko), this advances at most once per
 * DATA_REFRESH_WINDOW_MS of wall-clock time: when block N is adopted at time T, later blocks are
 * ignored until a block arrives at or after T + DATA_REFRESH_WINDOW_MS. Anything keyed on it
 * (multicall reads, log fetches, position-fee simulations) therefore refetches on a fixed time
 * budget no matter how fast the chain produces blocks.
 *
 * Two events cut through the window, because waiting would show the user wrong data:
 * - a receipt for one of the user's own transactions (useFastForwardBlockNumber) proves state
 *   relevant to them changed, and snaps this feed to the receipt's block immediately;
 * - a lower block number (reorg) is adopted immediately.
 * Both also restart the window from the moment they are adopted.
 */
export function useRefetchBlockNumber(): number | undefined {
  return useBlockNumberContext().refetchBlock
}

/** The Taiko-mainnet counterpart of useRefetchBlockNumber, independent of the wallet's chain. */
export function useMainnetRefetchBlockNumber(): number | undefined {
  return useBlockNumberContext().mainnetRefetchBlock
}

// The wall-clock gate behind useRefetchBlockNumber. The gated value is keyed by `chainId`: block
// numbers from different chains are not comparable, so after a chain switch this returns
// undefined until the new chain's feed produces a block (adopted directly, so a fresh page or
// chain never waits out a window for its first data), rather than leaking the previous chain's
// number to the new chain's consumers. Exported for testing.
export function useTimeGatedBlockNumber(
  chainId: number | undefined,
  blockNumber: number | undefined,
  snapTo?: number
): number | undefined {
  const [gated, setGated] = useState<{ chainId?: number; block?: number; adoptedAtMs?: number }>({})
  useEffect(() => {
    if (chainId === undefined || blockNumber === undefined) return
    setGated((prev) => {
      // The first block observed for a chain is adopted directly; afterwards advance only when
      // the refresh window has elapsed since the last adoption, and take the new number directly
      // if it moved backwards (reorg).
      if (
        prev.chainId !== chainId ||
        prev.block === undefined ||
        prev.adoptedAtMs === undefined ||
        blockNumber < prev.block ||
        (blockNumber > prev.block && Date.now() - prev.adoptedAtMs >= DATA_REFRESH_WINDOW_MS)
      ) {
        return { chainId, block: blockNumber, adoptedAtMs: Date.now() }
      }
      return prev
    })
  }, [chainId, blockNumber])
  useEffect(() => {
    if (chainId === undefined || snapTo === undefined) return
    setGated((prev) =>
      prev.chainId === chainId && prev.block !== undefined && snapTo <= prev.block
        ? prev
        : { chainId, block: snapTo, adoptedAtMs: Date.now() }
    )
  }, [chainId, snapTo])
  return gated.chainId === chainId ? gated.block : undefined
}

export function BlockNumberProvider({ children }: { children: ReactNode }) {
  const { chainId: activeChainId, provider } = useWeb3React()
  const [{ chainId, block, mainnetBlock }, setChainBlock] = useState<{
    chainId?: number
    block?: number
    mainnetBlock?: number
  }>({})
  const activeBlock = chainId === activeChainId ? block : undefined
  const [fastForwarded, setFastForwarded] = useState<{ chainId: number; block: number }>()
  const fastForwardedBlock = fastForwarded && fastForwarded.chainId === activeChainId ? fastForwarded.block : undefined

  // Wall-clock-gated feeds for data refetching (see useRefetchBlockNumber). In this Taiko-only
  // fork the "mainnet" feed carries Taiko mainnet blocks no matter which chain the wallet is on,
  // so it gates and snaps on its own clock, keyed to Taiko mainnet.
  const refetchBlock = useTimeGatedBlockNumber(activeChainId, activeBlock, fastForwardedBlock)
  const mainnetRefetchBlock = useTimeGatedBlockNumber(
    TAIKO_MAINNET_CHAIN_ID,
    mainnetBlock,
    activeChainId === TAIKO_MAINNET_CHAIN_ID ? fastForwardedBlock : undefined
  )

  const onChainBlock = useCallback((chainId: number, block: number) => {
    setChainBlock((chainBlock) => {
      if (chainBlock.chainId === chainId) {
        if (!chainBlock.block || chainBlock.block < block) {
          return { chainId, block, mainnetBlock: chainId === TAIKO_MAINNET_CHAIN_ID ? block : chainBlock.mainnetBlock }
        }
      } else if (chainId === TAIKO_MAINNET_CHAIN_ID) {
        if (!chainBlock.mainnetBlock || chainBlock.mainnetBlock < block) {
          return { ...chainBlock, mainnetBlock: block }
        }
      }
      return chainBlock
    })
  }, [])

  const windowVisible = useIsWindowVisible()
  useEffect(() => {
    let stale = false

    if (provider && activeChainId && windowVisible) {
      setChainBlock((chainBlock) => {
        // If chainId hasn't changed, don't clear the block. This prevents re-fetching still valid data.
        if (chainBlock.chainId !== activeChainId) {
          return { chainId: activeChainId, mainnetBlock: chainBlock.mainnetBlock }
        }
        return chainBlock
      })

      provider
        .getBlockNumber()
        .then((block) => {
          if (!stale) onChainBlock(activeChainId, block)
        })
        .catch((error) => {
          console.error(`Failed to get block number for chainId ${activeChainId}`, error)
        })

      const onBlock = (block: number) => onChainBlock(activeChainId, block)
      provider.on('block', onBlock)
      return () => {
        stale = true
        provider.removeListener('block', onBlock)
      }
    }

    return void 0
  }, [activeChainId, provider, windowVisible, onChainBlock])

  useEffect(() => {
    if (mainnetBlock === undefined) {
      RPC_PROVIDERS[TAIKO_MAINNET_CHAIN_ID].getBlockNumber()
        .then((block) => {
          onChainBlock(TAIKO_MAINNET_CHAIN_ID, block)
        })
        // swallow errors - it's ok if this fails, as we'll try again if we activate Taiko mainnet
        .catch(() => undefined)
    }
  }, [mainnetBlock, onChainBlock])

  // Kept identity-stable (only the chain id can invalidate it): consumers key effects on it, and
  // an identity that churned with every block state update would cancel and restart their
  // in-flight work (e.g. the transaction updater's receipt retry loop) once per block event.
  const fastForward = useCallback(
    (update: number) => {
      if (!activeChainId) return
      // Record the receipt-confirmed block even when it does not advance the raw feed (the
      // block event may already have arrived): the raw feed only proves a block exists, while
      // this proves the user's own state changed in it. See useFastForwardedBlockNumber.
      setFastForwarded((prev) =>
        prev?.chainId === activeChainId && prev.block >= update ? prev : { chainId: activeChainId, block: update }
      )
      setChainBlock((chainBlock) => {
        if (chainBlock.chainId === activeChainId && chainBlock.block && update > chainBlock.block) {
          return {
            chainId: activeChainId,
            block: update,
            mainnetBlock: activeChainId === TAIKO_MAINNET_CHAIN_ID ? update : chainBlock.mainnetBlock,
          }
        }
        return chainBlock
      })
    },
    [activeChainId]
  )

  const value = useMemo(
    () => ({
      fastForward,
      block: activeBlock,
      mainnetBlock,
      fastForwardedBlock,
      refetchBlock,
      mainnetRefetchBlock,
    }),
    [activeBlock, fastForward, fastForwardedBlock, mainnetBlock, mainnetRefetchBlock, refetchBlock]
  )
  return <BlockNumberContext.Provider value={value}>{children}</BlockNumberContext.Provider>
}
