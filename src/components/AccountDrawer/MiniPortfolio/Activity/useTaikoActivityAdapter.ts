import { Token } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { isTaikoChain } from 'config/chains/taiko'
import { TransactionStatus } from 'graphql/data/__generated__/types-and-hooks'
import { useTaikoActivity } from 'graphql/taiko/TaikoActivity'
import { useMemo } from 'react'

import { Activity } from './types'

/**
 * Converts Taiko subgraph activity data to the Activity format used by the UI
 */
export function useTaikoActivityAdapter(account: string): {
  activities?: Activity[]
  loading: boolean
  refetch: () => void
} {
  const { chainId } = useWeb3React()
  const isTaiko = chainId && isTaikoChain(chainId)

  const { activities: taikoData, loading, refetch } = useTaikoActivity(chainId || 167000, account, 100)

  const activities = useMemo(() => {
    if (!isTaiko || !taikoData) return undefined

    const allActivities: Activity[] = []

    // Convert swaps
    taikoData.swaps.forEach((swap) => {
      const token0 = new Token(
        chainId!,
        swap.pool.token0.id,
        parseInt(swap.pool.token0.decimals),
        swap.pool.token0.symbol,
        swap.pool.token0.name
      )
      const token1 = new Token(
        chainId!,
        swap.pool.token1.id,
        parseInt(swap.pool.token1.decimals),
        swap.pool.token1.symbol,
        swap.pool.token1.name
      )

      // Uniswap V3 swap amounts are signed from the pool's perspective: the token with a
      // positive amount was sold INTO the pool (the trade input), the token with a negative
      // amount was bought OUT of the pool (the trade output). Label the activity in the user's
      // actual trade direction instead of a fixed token0 -> token1, which rendered ~half of all
      // swaps backwards (e.g. a TAIKO->ETH swap shown as "Swap WETH for TAIKO").
      const amount0 = parseFloat(swap.amount0)
      const amount1 = parseFloat(swap.amount1)
      const token0IsInput = amount0 >= 0
      const inputToken = token0IsInput ? token0 : token1
      const outputToken = token0IsInput ? token1 : token0
      const inputInfo = token0IsInput ? swap.pool.token0 : swap.pool.token1
      const outputInfo = token0IsInput ? swap.pool.token1 : swap.pool.token0
      const inputAmount = Math.abs(token0IsInput ? amount0 : amount1)
      const outputAmount = Math.abs(token0IsInput ? amount1 : amount0)

      allActivities.push({
        hash: swap.transaction.id,
        chainId: chainId!,
        status: TransactionStatus.Confirmed, // Confirmed since it's from subgraph
        timestamp: parseInt(swap.timestamp),
        from: swap.origin,
        nonce: undefined,
        title: `Swap ${inputInfo.symbol} for ${outputInfo.symbol}`,
        descriptor: `${inputAmount} ${inputInfo.symbol} → ${outputAmount} ${outputInfo.symbol}`,
        logos: [inputInfo.id, outputInfo.id],
        currencies: [inputToken, outputToken],
      } as Activity)
    })

    // Convert mints (liquidity additions)
    taikoData.mints.forEach((mint) => {
      const token0 = new Token(
        chainId!,
        mint.pool.token0.id,
        parseInt(mint.pool.token0.decimals),
        mint.pool.token0.symbol,
        mint.pool.token0.name
      )
      const token1 = new Token(
        chainId!,
        mint.pool.token1.id,
        parseInt(mint.pool.token1.decimals),
        mint.pool.token1.symbol,
        mint.pool.token1.name
      )

      allActivities.push({
        hash: mint.transaction.id,
        chainId: chainId!,
        status: TransactionStatus.Confirmed,
        timestamp: parseInt(mint.timestamp),
        from: mint.origin,
        nonce: undefined,
        title: `Add ${mint.pool.token0.symbol}/${mint.pool.token1.symbol} Liquidity`,
        descriptor: `${parseFloat(mint.amount0).toFixed(4)} ${mint.pool.token0.symbol} + ${parseFloat(
          mint.amount1
        ).toFixed(4)} ${mint.pool.token1.symbol}`,
        logos: [mint.pool.token0.id, mint.pool.token1.id],
        currencies: [token0, token1],
      } as Activity)
    })

    // Convert burns (liquidity removals)
    taikoData.burns.forEach((burn) => {
      const token0 = new Token(
        chainId!,
        burn.pool.token0.id,
        parseInt(burn.pool.token0.decimals),
        burn.pool.token0.symbol,
        burn.pool.token0.name
      )
      const token1 = new Token(
        chainId!,
        burn.pool.token1.id,
        parseInt(burn.pool.token1.decimals),
        burn.pool.token1.symbol,
        burn.pool.token1.name
      )

      allActivities.push({
        hash: burn.transaction.id,
        chainId: chainId!,
        status: TransactionStatus.Confirmed,
        timestamp: parseInt(burn.timestamp),
        from: burn.origin,
        nonce: undefined,
        title: `Remove ${burn.pool.token0.symbol}/${burn.pool.token1.symbol} Liquidity`,
        descriptor: `${parseFloat(burn.amount0).toFixed(4)} ${burn.pool.token0.symbol} + ${parseFloat(
          burn.amount1
        ).toFixed(4)} ${burn.pool.token1.symbol}`,
        logos: [burn.pool.token0.id, burn.pool.token1.id],
        currencies: [token0, token1],
      } as Activity)
    })

    // Convert collects (fee collections)
    taikoData.collects.forEach((collect) => {
      const token0 = new Token(
        chainId!,
        collect.pool.token0.id,
        parseInt(collect.pool.token0.decimals),
        collect.pool.token0.symbol,
        collect.pool.token0.name
      )
      const token1 = new Token(
        chainId!,
        collect.pool.token1.id,
        parseInt(collect.pool.token1.decimals),
        collect.pool.token1.symbol,
        collect.pool.token1.name
      )

      allActivities.push({
        hash: collect.transaction.id,
        chainId: chainId!,
        status: TransactionStatus.Confirmed,
        timestamp: parseInt(collect.timestamp),
        from: collect.owner,
        nonce: undefined,
        title: `Collect ${collect.pool.token0.symbol}/${collect.pool.token1.symbol} Fees`,
        descriptor: `${parseFloat(collect.amount0).toFixed(6)} ${collect.pool.token0.symbol} + ${parseFloat(
          collect.amount1
        ).toFixed(6)} ${collect.pool.token1.symbol}`,
        logos: [collect.pool.token0.id, collect.pool.token1.id],
        currencies: [token0, token1],
      } as Activity)
    })

    // Sort by timestamp descending
    return allActivities.sort((a, b) => b.timestamp - a.timestamp)
  }, [isTaiko, taikoData, chainId])

  return {
    activities: isTaiko ? activities : undefined,
    loading: isTaiko ? loading : false,
    refetch,
  }
}
