import { gql, useQuery } from '@apollo/client'
import { getClient } from 'graphql/thegraph/apollo'
import { useMemo } from 'react'

const TAIKO_USER_ACTIVITY_QUERY = gql`
  query TaikoUserActivity($account: Bytes!, $first: Int = 100) {
    swaps(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { origin: $account }
    ) {
      id
      timestamp
      sender
      origin
      amount0
      amount1
      amountUSD
      pool {
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
      }
      transaction {
        id
        blockNumber
        timestamp
      }
    }
    mints(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { origin: $account }
    ) {
      id
      timestamp
      sender
      origin
      amount0
      amount1
      amountUSD
      pool {
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
      }
      transaction {
        id
        blockNumber
        timestamp
      }
    }
    burns(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { origin: $account }
    ) {
      id
      timestamp
      owner
      origin
      amount0
      amount1
      amountUSD
      pool {
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
      }
      transaction {
        id
        blockNumber
        timestamp
      }
    }
    collects(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { owner: $account }
    ) {
      id
      timestamp
      owner
      amount0
      amount1
      amountUSD
      pool {
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
      }
      transaction {
        id
        blockNumber
        timestamp
      }
    }
  }
`

export interface TaikoActivityToken {
  id: string
  symbol: string
  name: string
  decimals: string
}

export interface TaikoActivityPool {
  id: string
  token0: TaikoActivityToken
  token1: TaikoActivityToken
}

export interface TaikoActivityTransaction {
  id: string
  blockNumber: string
  timestamp: string
}

export interface TaikoSwap {
  id: string
  timestamp: string
  sender: string
  origin: string
  amount0: string
  amount1: string
  amountUSD: string
  pool: TaikoActivityPool
  transaction: TaikoActivityTransaction
}

export interface TaikoMint {
  id: string
  timestamp: string
  sender: string
  origin: string
  amount0: string
  amount1: string
  amountUSD: string
  pool: TaikoActivityPool
  transaction: TaikoActivityTransaction
}

export interface TaikoBurn {
  id: string
  timestamp: string
  owner: string
  origin: string
  amount0: string
  amount1: string
  amountUSD: string
  pool: TaikoActivityPool
  transaction: TaikoActivityTransaction
}

export interface TaikoCollect {
  id: string
  timestamp: string
  owner: string
  amount0: string
  amount1: string
  amountUSD: string
  pool: TaikoActivityPool
  transaction: TaikoActivityTransaction
}

export interface TaikoActivityData {
  swaps: TaikoSwap[]
  mints: TaikoMint[]
  burns: TaikoBurn[]
  collects: TaikoCollect[]
}

export interface UseTaikoActivityResult {
  activities: TaikoActivityData | undefined
  loading: boolean
  error: Error | undefined
  refetch: () => void
}

/**
 * Hook to fetch user activity (swaps, mints, burns, collects) from Taiko subgraph
 * @param chainId - The Taiko chain ID (167000 for Mainnet, 167013 for Hoodi)
 * @param account - User wallet address
 * @param first - Number of items to fetch per activity type (default: 100)
 */
export function useTaikoActivity(chainId: number, account: string, first: number = 100): UseTaikoActivityResult {
  const client = getClient(chainId)

  const { data, loading, error, refetch } = useQuery<TaikoActivityData>(TAIKO_USER_ACTIVITY_QUERY, {
    client,
    variables: {
      account: account.toLowerCase(), // Subgraph stores addresses in lowercase
      first,
    },
    skip: !client || !account,
    fetchPolicy: 'cache-and-network',
  })

  return useMemo(
    () => ({
      activities: data,
      loading,
      error: error as Error | undefined,
      refetch,
    }),
    [data, loading, error, refetch]
  )
}
