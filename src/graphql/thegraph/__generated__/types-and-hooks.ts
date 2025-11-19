// Generated hooks for GraphQL queries
import { useQuery, QueryResult, ApolloClient } from '@apollo/client'
import gql from 'graphql-tag'

export interface AllV3TicksQuery {
  ticks: Array<{
    tickIdx: string
    liquidityNet: string
    price0: string
    price1: string
  }>
}

export interface FeeTierDistributionQuery {
  pools: Array<{
    feeTier: string
    totalValueLockedToken0: string
    totalValueLockedToken1: string
  }>
}

export interface PoolDataQuery {
  data: Array<{
    id: string
    feeTier: string
    liquidity: string
    sqrtPrice: string
    tick: string
    token0: {
      id: string
      symbol: string
      name: string
      decimals: string
      derivedETH: string
    }
    token1: {
      id: string
      symbol: string
      name: string
      decimals: string
      derivedETH: string
    }
    token0Price: string
    token1Price: string
    volumeUSD: string
    volumeToken0: string
    volumeToken1: string
    txCount: string
    totalValueLockedToken0: string
    totalValueLockedToken1: string
    totalValueLockedUSD: string
  }>
  bundles: Array<{
    ethPriceUSD: string
  }>
}

const POOL_DATA_QUERY = gql`
  query PoolData($poolId: [ID!]) {
    data: pools(where: { id_in: $poolId }, orderBy: totalValueLockedUSD, orderDirection: desc, subgraphError: allow) {
      id
      feeTier
      liquidity
      sqrtPrice
      tick
      token0 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      token0Price
      token1Price
      volumeUSD
      volumeToken0
      volumeToken1
      txCount
      totalValueLockedToken0
      totalValueLockedToken1
      totalValueLockedUSD
    }
    bundles(where: { id: "1" }) {
      ethPriceUSD
    }
  }
`

const ALL_V3_TICKS_QUERY = gql`
  query AllV3Ticks($poolAddress: String!, $skip: Int!) {
    ticks(first: 1000, skip: $skip, where: { poolAddress: $poolAddress }, orderBy: tickIdx) {
      tickIdx
      liquidityNet
      price0
      price1
    }
  }
`

const FEE_TIER_DISTRIBUTION_QUERY = gql`
  query FeeTierDistribution($token0: String!, $token1: String!) {
    pools(
      orderBy: totalValueLockedToken0
      orderDirection: desc
      where: { token0: $token0, token1: $token1 }
    ) {
      feeTier
      totalValueLockedToken0
      totalValueLockedToken1
    }
  }
`

export function usePoolDataQuery(options: {
  variables: { poolId: string[] }
  client?: ApolloClient<any>
}): QueryResult<PoolDataQuery> {
  return useQuery<PoolDataQuery>(POOL_DATA_QUERY, {
    ...options,
    client: options.client,
  })
}

export function useAllV3TicksQuery(options: {
  variables: { poolAddress: string; skip: number }
  client?: ApolloClient<any>
}): QueryResult<AllV3TicksQuery> {
  return useQuery<AllV3TicksQuery>(ALL_V3_TICKS_QUERY, {
    ...options,
    client: options.client,
  })
}

export function useFeeTierDistributionQuery(options: {
  variables: { token0: string; token1: string }
  client?: ApolloClient<any>
}): QueryResult<FeeTierDistributionQuery> {
  return useQuery<FeeTierDistributionQuery>(FEE_TIER_DISTRIBUTION_QUERY, {
    ...options,
    client: options.client,
  })
}

// Pool Transactions Types
export enum TransactionType {
  SWAP = 'SWAP',
  MINT = 'MINT',
  BURN = 'BURN',
}

export interface Transaction {
  id: string
  timestamp: string
}

export interface PoolSwap {
  id: string
  timestamp: string
  amountUSD: string
  amount0: string
  amount1: string
  origin: string
  transaction: Transaction
}

export interface PoolMint {
  id: string
  timestamp: string
  amountUSD: string
  amount0: string
  amount1: string
  origin: string
  transaction: Transaction
}

export interface PoolBurn {
  id: string
  timestamp: string
  amountUSD: string
  amount0: string
  amount1: string
  origin: string
  transaction: Transaction
}

export interface PoolTransactionsQuery {
  swaps: PoolSwap[]
  mints: PoolMint[]
  burns: PoolBurn[]
}

// Pool Chart Data Types
export interface PoolDayData {
  id: string
  date: number
  volumeUSD: string
  tvlUSD: string
  feesUSD: string
}

export interface PoolHourData {
  id: string
  periodStartUnix: number
  volumeUSD: string
  tvlUSD: string
}

export interface PoolDayDataQuery {
  poolDayDatas: PoolDayData[]
}

export interface PoolHourDataQuery {
  poolHourDatas: PoolHourData[]
}

const POOL_DAY_DATA_QUERY = gql`
  query PoolDayData($poolAddress: String!, $startTime: Int!, $endTime: Int!) {
    poolDayDatas(
      where: { pool: $poolAddress, date_gte: $startTime, date_lte: $endTime }
      orderBy: date
      orderDirection: asc
      first: 1000
    ) {
      id
      date
      volumeUSD
      tvlUSD
      feesUSD
    }
  }
`

const POOL_HOUR_DATA_QUERY = gql`
  query PoolHourData($poolAddress: String!, $startTime: Int!, $endTime: Int!) {
    poolHourDatas(
      where: { pool: $poolAddress, periodStartUnix_gte: $startTime, periodStartUnix_lte: $endTime }
      orderBy: periodStartUnix
      orderDirection: asc
      first: 1000
    ) {
      id
      periodStartUnix
      volumeUSD
      tvlUSD
    }
  }
`

const POOL_TRANSACTIONS_QUERY = gql`
  query PoolTransactions($poolAddress: String!, $first: Int!) {
    swaps(
      where: { pool: $poolAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      timestamp
      amountUSD
      amount0
      amount1
      origin
      transaction {
        id
      }
    }
    mints(
      where: { pool: $poolAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      timestamp
      amountUSD
      amount0
      amount1
      origin
      transaction {
        id
      }
    }
    burns(
      where: { pool: $poolAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      timestamp
      amountUSD
      amount0
      amount1
      origin
      transaction {
        id
      }
    }
  }
`

export function usePoolTransactionsQuery(options: {
  variables: { poolAddress: string; first: number }
  client?: ApolloClient<any>
}): QueryResult<PoolTransactionsQuery> {
  return useQuery<PoolTransactionsQuery>(POOL_TRANSACTIONS_QUERY, {
    ...options,
    client: options.client,
  })
}

export function usePoolDayDataQuery(options: {
  variables: { poolAddress: string; startTime: number; endTime: number }
  client?: ApolloClient<any>
}): QueryResult<PoolDayDataQuery> {
  return useQuery<PoolDayDataQuery>(POOL_DAY_DATA_QUERY, {
    ...options,
    client: options.client,
  })
}

export function usePoolHourDataQuery(options: {
  variables: { poolAddress: string; startTime: number; endTime: number }
  client?: ApolloClient<any>
}): QueryResult<PoolHourDataQuery> {
  return useQuery<PoolHourDataQuery>(POOL_HOUR_DATA_QUERY, {
    ...options,
    client: options.client,
  })
}
