import { ChainId } from '@uniswap/sdk-core'
import gql from 'graphql-tag'
import { useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { chainToApolloClient } from './apollo'
import { getClient as getTaikoPoolClient } from '../taiko/apollo'
import { isTaikoChain } from 'config/chains/taiko'

const POOL_HISTORICAL_DATA_QUERY = gql`
  query PoolHistoricalData($poolId: ID!, $date: Int!) {
    poolDayDatas(
      first: 1
      where: { pool: $poolId, date: $date }
      orderBy: date
      orderDirection: desc
    ) {
      date
      volumeUSD
      tvlUSD
      feesUSD
    }
  }
`

export interface PoolHistoricalData {
  date: number
  volumeUSD: string
  tvlUSD: string
  feesUSD: string
}

export interface PoolHistoricalDataQuery {
  poolDayDatas: PoolHistoricalData[]
}

/**
 * Hook to fetch historical pool data for a specific date
 * @param poolAddress - The pool address
 * @param chainId - The chain ID
 * @param daysAgo - Number of days ago to fetch data for (default: 1 for yesterday)
 */
export function usePoolHistoricalData(poolAddress: string, chainId?: ChainId, daysAgo: number = 1) {
  // Calculate the timestamp for the target date (start of day UTC)
  const targetDate = useMemo(() => {
    const now = new Date()
    const target = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    // Round down to start of day (UTC)
    return Math.floor(target.getTime() / 1000 / 86400) * 86400
  }, [daysAgo])

  // Use Taiko-specific Apollo client for Taiko chains, otherwise use standard client
  const isTaiko = chainId && isTaikoChain(chainId)
  const apolloClient = isTaiko
    ? getTaikoPoolClient(chainId)
    : chainToApolloClient[chainId || ChainId.MAINNET]

  const { data, loading, error } = useQuery<PoolHistoricalDataQuery>(POOL_HISTORICAL_DATA_QUERY, {
    variables: {
      poolId: poolAddress.toLowerCase(),
      date: targetDate,
    },
    client: apolloClient,
    skip: !poolAddress || !chainId,
  })

  return useMemo(() => {
    return {
      data: data?.poolDayDatas?.[0],
      loading,
      error,
    }
  }, [data, loading, error])
}
