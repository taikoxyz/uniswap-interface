import { useWeb3React } from '@web3-react/core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
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

export function useMainnetBlockNumber(): number | undefined {
  return useBlockNumberContext().mainnetBlock
}

/**
 * The highest block number observed via a confirmed transaction receipt on the active chain
 * (see useFastForwardBlockNumber). Unlike the raw block feed, this only moves when one of the
 * user's own transactions confirms, so consumers that deliberately lag the raw feed (e.g. the
 * quantized multicall feed) can use it to refresh immediately after a user action.
 */
export function useFastForwardedBlockNumber(): number | undefined {
  return useBlockNumberContext().fastForwardedBlock
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
  const fastForwardedBlock =
    fastForwarded && fastForwarded.chainId === activeChainId ? fastForwarded.block : undefined

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

  const value = useMemo(
    () => ({
      fastForward: (update: number) => {
        // Record the receipt-confirmed block even when it does not advance the raw feed (the
        // block event may already have arrived): the raw feed only proves a block exists, while
        // this proves the user's own state changed in it. See useFastForwardedBlockNumber.
        if (activeChainId) {
          setFastForwarded((prev) =>
            prev?.chainId === activeChainId && prev.block >= update ? prev : { chainId: activeChainId, block: update }
          )
        }
        if (activeBlock && update > activeBlock) {
          setChainBlock({
            chainId: activeChainId,
            block: update,
            mainnetBlock: activeChainId === TAIKO_MAINNET_CHAIN_ID ? update : mainnetBlock,
          })
        }
      },
      block: activeBlock,
      mainnetBlock,
      fastForwardedBlock,
    }),
    [activeBlock, activeChainId, fastForwardedBlock, mainnetBlock]
  )
  return <BlockNumberContext.Provider value={value}>{children}</BlockNumberContext.Provider>
}
