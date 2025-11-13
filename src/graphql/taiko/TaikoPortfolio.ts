import { gql, useQuery } from '@apollo/client'
import { getClient } from 'graphql/thegraph/apollo'
import { useMemo } from 'react'

// Query to get token prices from the subgraph
const TAIKO_TOKEN_PRICES_QUERY = gql`
  query TaikoTokenPrices($tokenAddresses: [Bytes!]!) {
    tokens(where: { id_in: $tokenAddresses }) {
      id
      symbol
      name
      decimals
      derivedETH
    }
    bundle(id: "1") {
      ethPriceUSD
    }
  }
`

// Query to get user's positions
const TAIKO_USER_POSITIONS_QUERY = gql`
  query TaikoUserPositions($account: Bytes!) {
    positions(where: { owner: $account, liquidity_gt: "0" }) {
      id
      owner
      liquidity
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
      pool {
        id
        token0Price
        token1Price
        totalValueLockedUSD
        totalValueLockedToken0
        totalValueLockedToken1
      }
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
    }
  }
`

export interface TaikoToken {
  id: string
  symbol: string
  name: string
  decimals: string
  derivedETH: string
}

export interface TaikoBundle {
  ethPriceUSD: string
}

export interface TaikoTokenPricesData {
  tokens: TaikoToken[]
  bundle: TaikoBundle | null
}

export interface TaikoTokenDayData {
  id: string
  date: number
  token: TaikoToken
  priceUSD: string
  volumeUSD: string
  totalValueLockedUSD: string
}

export interface TaikoPool {
  id: string
  token0Price: string
  token1Price: string
  totalValueLockedUSD: string
  totalValueLockedToken0: string
  totalValueLockedToken1: string
}

export interface TaikoPosition {
  id: string
  owner: string
  liquidity: string
  token0: TaikoToken
  token1: TaikoToken
  pool: TaikoPool
  depositedToken0: string
  depositedToken1: string
  withdrawnToken0: string
  withdrawnToken1: string
  collectedFeesToken0: string
  collectedFeesToken1: string
}

export interface TaikoPortfolioData {
  positions: TaikoPosition[]
}

export interface UseTaikoPortfolioResult {
  positions: TaikoPosition[] | undefined
  loading: boolean
  error: Error | undefined
  refetch: () => void
  totalValueUSD: number
}

/**
 * Hook to fetch user's portfolio (LP positions) from Taiko subgraph
 * @param chainId - The Taiko chain ID (167000 for Mainnet, 167013 for Hoodi)
 * @param account - User wallet address
 */
export function useTaikoPortfolio(chainId: number, account: string): UseTaikoPortfolioResult {
  const client = getClient(chainId)

  const { data, loading, error, refetch } = useQuery<TaikoPortfolioData>(TAIKO_USER_POSITIONS_QUERY, {
    client,
    variables: {
      account: account.toLowerCase(),
    },
    skip: !client || !account,
    fetchPolicy: 'cache-and-network',
  })

  const totalValueUSD = useMemo(() => {
    if (!data?.positions) return 0

    return data.positions.reduce((total, position) => {
      // Calculate the current value of the position
      const depositedToken0 = parseFloat(position.depositedToken0 || '0')
      const depositedToken1 = parseFloat(position.depositedToken1 || '0')
      const withdrawnToken0 = parseFloat(position.withdrawnToken0 || '0')
      const withdrawnToken1 = parseFloat(position.withdrawnToken1 || '0')
      const collectedFeesToken0 = parseFloat(position.collectedFeesToken0 || '0')
      const collectedFeesToken1 = parseFloat(position.collectedFeesToken1 || '0')

      // Net position = deposited - withdrawn - collected fees
      const netToken0 = depositedToken0 - withdrawnToken0 - collectedFeesToken0
      const netToken1 = depositedToken1 - withdrawnToken1 - collectedFeesToken1

      // Get token prices from pool
      const token0Price = parseFloat(position.pool.token0Price || '0')
      const token1Price = parseFloat(position.pool.token1Price || '0')

      // Calculate USD value (token1 is the quote, so token1Price is in terms of token0)
      // For a rough estimate, we can use the pool's total value locked
      const poolTVL = parseFloat(position.pool.totalValueLockedUSD || '0')
      const poolToken0 = parseFloat(position.pool.totalValueLockedToken0 || '1')
      const poolToken1 = parseFloat(position.pool.totalValueLockedToken1 || '1')

      // Estimate USD value per token
      const token0PriceUSD = poolTVL / 2 / poolToken0 // Rough estimate: half the TVL / token0 amount
      const token1PriceUSD = poolTVL / 2 / poolToken1 // Rough estimate: half the TVL / token1 amount

      const positionValueUSD = netToken0 * token0PriceUSD + netToken1 * token1PriceUSD

      return total + (positionValueUSD > 0 ? positionValueUSD : 0)
    }, 0)
  }, [data?.positions])

  return useMemo(
    () => ({
      positions: data?.positions,
      loading,
      error: error as Error | undefined,
      refetch,
      totalValueUSD,
    }),
    [data?.positions, loading, error, refetch, totalValueUSD]
  )
}

export interface TokenPriceInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  priceUSD: number
}

export interface UseTaikoTokenPricesResult {
  tokenPrices: Map<string, TokenPriceInfo>
  loading: boolean
  error: Error | undefined
  refetch: () => void
}

/**
 * Hook to fetch token prices from Taiko subgraph
 * @param chainId - The Taiko chain ID (167000 for Mainnet, 167013 for Hoodi)
 * @param tokenAddresses - Array of token addresses to fetch prices for
 */
export function useTaikoTokenPrices(chainId: number, tokenAddresses: string[]): UseTaikoTokenPricesResult {
  const client = getClient(chainId)

  const { data, loading, error, refetch } = useQuery<TaikoTokenPricesData>(TAIKO_TOKEN_PRICES_QUERY, {
    client,
    variables: {
      tokenAddresses: tokenAddresses.map((addr) => addr.toLowerCase()),
    },
    skip: !client || tokenAddresses.length === 0,
    fetchPolicy: 'cache-and-network',
  })

  const tokenPrices = useMemo(() => {
    const priceMap = new Map<string, TokenPriceInfo>()

    if (!data?.tokens || !data?.bundle?.ethPriceUSD) return priceMap

    const ethPriceUSD = parseFloat(data.bundle.ethPriceUSD)

    data.tokens.forEach((token) => {
      const derivedETH = parseFloat(token.derivedETH || '0')
      const priceUSD = derivedETH * ethPriceUSD

      priceMap.set(token.id.toLowerCase(), {
        address: token.id,
        symbol: token.symbol,
        name: token.name,
        decimals: parseInt(token.decimals),
        priceUSD,
      })
    })

    return priceMap
  }, [data])

  return useMemo(
    () => ({
      tokenPrices,
      loading,
      error: error as Error | undefined,
      refetch,
    }),
    [tokenPrices, loading, error, refetch]
  )
}
