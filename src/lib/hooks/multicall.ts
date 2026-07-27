import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { useMainnetRefetchBlockNumber, useRefetchBlockNumber } from 'lib/hooks/useBlockNumber'
import multicall from 'lib/state/multicall'
import { SkipFirst } from 'types/tuple'

export type { CallStateResult } from '@uniswap/redux-multicall' // re-export for convenience
export { NEVER_RELOAD } from '@uniswap/redux-multicall' // re-export for convenience

// Create wrappers for hooks so consumers don't need to get latest block themselves

type SkipFirstTwoParams<T extends (...args: any) => any> = SkipFirst<Parameters<T>, 2>

export function useMultipleContractSingleData(
  ...args: SkipFirstTwoParams<typeof multicall.hooks.useMultipleContractSingleData>
) {
  const { chainId, latestBlock } = useCallContext()
  return multicall.hooks.useMultipleContractSingleData(chainId, latestBlock, ...args)
}

export function useSingleCallResult(...args: SkipFirstTwoParams<typeof multicall.hooks.useSingleCallResult>) {
  const { chainId, latestBlock } = useCallContext()
  return multicall.hooks.useSingleCallResult(chainId, latestBlock, ...args)
}

export function useMainnetSingleCallResult(...args: SkipFirstTwoParams<typeof multicall.hooks.useSingleCallResult>) {
  const latestMainnetBlock = useMainnetRefetchBlockNumber()
  return multicall.hooks.useSingleCallResult(ChainId.MAINNET, latestMainnetBlock, ...args)
}

export function useSingleContractMultipleData(
  ...args: SkipFirstTwoParams<typeof multicall.hooks.useSingleContractMultipleData>
) {
  const { chainId, latestBlock } = useCallContext()
  return multicall.hooks.useSingleContractMultipleData(chainId, latestBlock, ...args)
}

function useCallContext() {
  const { chainId } = useWeb3React()
  // The block fed to the hooks must be the one that drives the MulticallUpdater's fetches: the
  // hooks compare each result's block against it to derive `valid`/`syncing`, so feeding them
  // the raw per-block feed on a ~1s chain would mark every result out of sync ~always.
  const latestBlock = useRefetchBlockNumber()
  return { chainId, latestBlock }
}
