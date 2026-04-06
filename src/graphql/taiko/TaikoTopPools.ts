/**
 * Taiko Top Pools Query
 *
 * Custom implementation for querying pool data from Goldsky's Taiko V3 subgraph.
 */

import { useQuery, gql, ApolloError } from '@apollo/client'
import { useMemo } from 'react'
import { getClient } from '../thegraph/apollo'
import { TAIKO_HOODI_CHAIN_ID } from 'config/chains'

/**
 * Pool data structure from Goldsky V3 subgraph
 */
export interface TaikoPool {
  id: string // pool address
  token0: {
    id: string
    symbol: string
    name: string
    decimals: string
  }
  token1: {
    id: string
    symbol: string
    name: string
    decimals: string
  }
  feeTier: string
  liquidity: string
  sqrtPrice: string
  token0Price: string
  token1Price: string
  volumeUSD: string
  feesUSD: string
  txCount: string
  totalValueLockedUSD: string
  totalValueLockedToken0: string
  totalValueLockedToken1: string
  liquidityProviderCount: string
}

/**
 * GraphQL query for top pools on Taiko
 */
const TAIKO_TOP_POOLS_QUERY = gql`
  query TaikoTopPools($first: Int!, $orderBy: String!, $orderDirection: String!) {
    pools(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      liquidity
      sqrtPrice
      token0Price
      token1Price
      volumeUSD
      feesUSD
      txCount
      totalValueLockedUSD
      totalValueLockedToken0
      totalValueLockedToken1
      liquidityProviderCount
    }
  }
`

/**
 * Pool data normalized for display
 */
export interface NormalizedTaikoPool {
  id: string
  token0Address: string
  token1Address: string
  token0Symbol: string
  token1Symbol: string
  token0Name: string
  token1Name: string
  feeTier: number // in basis points (500 = 0.05%)
  tvlUSD: number
  volumeUSD: number
  feesUSD: number
  txCount: number
  liquidityProviderCount: number
  token0Price: number
  token1Price: number
  apr?: number // Annual percentage rate (calculated from fees)
}

export interface UseTopPoolsTaikoResult {
  pools?: readonly NormalizedTaikoPool[]
  loadingPools: boolean
  error?: ApolloError
  refetch: () => void
}

/**
 * Hook to fetch and normalize top pools from Taiko Goldsky V3 subgraph
 */
export function useTopPoolsTaiko(
  chainId: number,
  first: number = 100,
  orderBy: 'totalValueLockedUSD' | 'volumeUSD' = 'totalValueLockedUSD'
): UseTopPoolsTaikoResult {
  // Get the Apollo client for the specified Taiko chain
  const client = getClient(chainId)

  const { data, loading, error, refetch } = useQuery<{ pools: TaikoPool[] }>(TAIKO_TOP_POOLS_QUERY, {
    client,
    variables: {
      first,
      orderBy,
      orderDirection: 'desc',
    },
    pollInterval: 60000, // Poll every 60 seconds
  })

  // Normalize pools for display
  const normalizedPools = useMemo(() => {
    if (!data?.pools) return undefined

    return data.pools.map((pool): NormalizedTaikoPool => {
      const tvlUSD = parseFloat(pool.totalValueLockedUSD)
      // Cap corrupted pool volumes: USDC/TAIKO 0.3% pool has $8.1e+32 phantom volume
      // from two bad subgraph events. TODO: Remove after subgraph reindex.
      const rawVolumeUSD = parseFloat(pool.volumeUSD)
      const rawFeesUSD = parseFloat(pool.feesUSD)
      const volumeUSD = rawVolumeUSD > 1e9 ? 0 : rawVolumeUSD
      const feesUSD = rawFeesUSD > 1e9 ? 0 : rawFeesUSD
      const feeTier = parseInt(pool.feeTier)

      // Calculate APR: (annual fees / TVL) * 100
      // Assuming current fees represent daily fees, multiply by 365
      const dailyFees = feesUSD // This is cumulative, so we'd need historical data for true daily
      const estimatedApr = tvlUSD > 0 ? (dailyFees / tvlUSD) * 100 : 0

      return {
        id: pool.id.toLowerCase(),
        token0Address: pool.token0.id.toLowerCase(),
        token1Address: pool.token1.id.toLowerCase(),
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        token0Name: pool.token0.name,
        token1Name: pool.token1.name,
        feeTier,
        tvlUSD,
        volumeUSD,
        feesUSD,
        txCount: parseInt(pool.txCount),
        liquidityProviderCount: parseInt(pool.liquidityProviderCount),
        token0Price: parseFloat(pool.token0Price),
        token1Price: parseFloat(pool.token1Price),
        apr: estimatedApr,
      }
    })
  }, [data])

  return {
    pools: normalizedPools,
    loadingPools: loading,
    error,
    refetch,
  }
}

/**
 * Query for protocol-wide TVL stats
 *
 * Fetches both factory totals and individual pool data. Factory cumulative
 * volumeUSD/feesUSD are corrupted by two bad swap events (Feb 17 & Mar 2 2026)
 * on the USDC/TAIKO 0.3% pool that recorded ~$8.1e+32 in phantom volume.
 * We compute corrected totals from individual pool volumes, capping each pool
 * at a reasonable maximum. TVL, txCount, and poolCount are unaffected.
 *
 * TODO: Remove this workaround after the subgraph is reindexed with the
 * volume sanity cap fix (taikoxyz/uniswap-v3-subgraph).
 */
const TAIKO_PROTOCOL_STATS_QUERY = gql`
  query TaikoProtocolStats {
    factories(first: 1) {
      id
      totalValueLockedUSD
      txCount
      poolCount
    }
    pools(first: 100) {
      volumeUSD
      feesUSD
    }
  }
`

// Per-pool volume cap: any pool reporting more than $100M cumulative volume
// is almost certainly corrupted given Taiko's current liquidity (~$5.6M TVL).
// Corrupted values are zeroed (not capped) since the real value can't be
// recovered from the pool entity — it requires summing daily data.
const MAX_POOL_VOLUME_USD = 1e8

export interface TaikoProtocolStats {
  totalVolumeUSD: number
  totalValueLockedUSD: number
  totalFeesUSD: number
  txCount: number
  poolCount: number
}

export interface UseProtocolStatsTaikoResult {
  stats?: TaikoProtocolStats
  loading: boolean
  error?: ApolloError
}

/**
 * Hook to fetch protocol-wide statistics
 */
export function useProtocolStatsTaiko(chainId: number): UseProtocolStatsTaikoResult {
  const client = getClient(chainId)

  const { data, loading, error } = useQuery<{
    factories: Array<{
      totalValueLockedUSD: string
      txCount: string
      poolCount: string
    }>
    pools: Array<{
      volumeUSD: string
      feesUSD: string
    }>
  }>(TAIKO_PROTOCOL_STATS_QUERY, {
    client,
    pollInterval: 60000,
  })

  const stats = useMemo(() => {
    if (!data?.factories?.[0]) return undefined

    const factory = data.factories[0]

    // Sum volume/fees from individual pools, zeroing corrupted entries
    const totalVolumeUSD = (data.pools || []).reduce((sum, pool) => {
      const vol = parseFloat(pool.volumeUSD)
      return sum + (vol > MAX_POOL_VOLUME_USD ? 0 : vol)
    }, 0)

    const totalFeesUSD = (data.pools || []).reduce((sum, pool) => {
      const fees = parseFloat(pool.feesUSD)
      return sum + (fees > MAX_POOL_VOLUME_USD ? 0 : fees)
    }, 0)

    return {
      totalVolumeUSD,
      totalValueLockedUSD: parseFloat(factory.totalValueLockedUSD),
      totalFeesUSD,
      txCount: parseInt(factory.txCount),
      poolCount: parseInt(factory.poolCount),
    }
  }, [data])

  return {
    stats,
    loading,
    error,
  }
}
