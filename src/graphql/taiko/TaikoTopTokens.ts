/**
 * Taiko Top Tokens Query
 *
 * Queries token data from Goldsky's Taiko subgraph.
 * The Goldsky token subgraph uses The Graph's standard schema for Uniswap V3 tokens.
 */

import { ApolloError, gql, useQuery } from '@apollo/client'
import { filterStringAtom } from 'components/Tokens/state'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains/taiko'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { TimePeriod } from '../data/util'
import { getPoolClientForChain, getTokenClientForChain } from './apollo'

/**
 * Token data structure from Goldsky subgraph
 * Based on Uniswap V3 subgraph schema
 */
export interface TaikoToken {
  id: string // token address (lowercase)
  symbol: string
  name: string
  decimals: string
  volumeUSD: string
  totalValueLockedUSD: string
  feesUSD: string
  txCount: string
  // Derived fields
  derivedETH?: string
  priceUSD?: string
}

/**
 * Token day data structure from Goldsky pool subgraph
 */
export interface TaikoTokenDayData {
  id: string
  date: number
  token: {
    id: string  // Token address
  }
  priceUSD: string
}

/**
 * GraphQL query for top tokens on Taiko
 * Orders by volumeUSD to match the TopTokens behavior on other chains
 * Also fetches bundle for ETH price in USD
 */
const TAIKO_TOP_TOKENS_QUERY = gql`
  query TaikoTopTokens($orderBy: String!, $orderDirection: String!) {
    tokens(
      first: 100
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      symbol
      name
      decimals
      volumeUSD
      totalValueLockedUSD
      feesUSD
      txCount
      derivedETH
    }
    bundle(id: "1") {
      ethPriceUSD
    }
  }
`

/**
 * GraphQL query for token day data to calculate price changes
 * Note: This query uses the POOL subgraph, not the token subgraph,
 * as tokenDayDatas with date field is only available in the pool subgraph
 */
const TAIKO_TOKEN_DAY_DATA_QUERY = gql`
  query TaikoTopTokensDayData($tokenIds: [String!]!, $startDate: Int!) {
    tokenDayDatas(
      where: { token_in: $tokenIds, date_gte: $startDate }
      orderBy: date
      orderDirection: desc
      first: 200
    ) {
      id
      date
      token {
        id
      }
      priceUSD
    }
  }
`

/**
 * Token data normalized to match the interface expected by TokenTable
 */
export interface NormalizedTaikoToken {
  __typename?: 'Token'
  id: string
  address: string
  chain: any  // 'TAIKO' | 'TAIKO_HOODI' - typed as any to match GraphQL Chain enum
  symbol?: string
  name?: string
  decimals?: number
  standard?: any  // 'ERC20' - typed as any to match GraphQL TokenStandard enum
  project?: {
    logoUrl?: string
  }
  market?: {
    price?: {
      value: number
    }
    pricePercentChange?: {
      value: number
    }
    volume?: {
      value: number
    }
    totalValueLocked?: {
      value: number
    }
  }
}

export interface UseTopTokensTaikoResult {
  tokens?: readonly NormalizedTaikoToken[]
  tokenSortRank: Record<string, number>
  loadingTokens: boolean
  sparklines: Record<string, any>
  error?: ApolloError
}

/**
 * Hook to fetch and normalize top tokens from Taiko Goldsky subgraph
 *
 * @param chainId - Chain ID for the Taiko network
 * @param timePeriod - Time period for filtering (note: current implementation doesn't filter by time)
 * @returns Normalized token data compatible with TokenTable component
 */
export function useTopTokensTaiko(chainId: number, timePeriod: TimePeriod = TimePeriod.DAY): UseTopTokensTaikoResult {
  const tokenClient = getTokenClientForChain(chainId)
  const poolClient = getPoolClientForChain(chainId)

  const { data, loading, error } = useQuery<{ tokens: TaikoToken[]; bundle: { ethPriceUSD: string } }>(
    TAIKO_TOP_TOKENS_QUERY,
    {
      client: tokenClient,
      variables: {
        // Use TVL for ordering since volume may be zero on new testnets
        orderBy: 'totalValueLockedUSD',
        orderDirection: 'desc',
      },
      pollInterval: 60000, // Poll every 60 seconds
      skip: !tokenClient, // Skip if no client available for this chain
    }
  )  
  
  // Calculate the start date for fetching historical data (2 days ago to get yesterday's data)
  const dayStartTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const startTime = Math.floor((now - 2 * 24 * 60 * 60) / 86400) * 86400 // 2 days ago, rounded to start of day
    console.log(`TaikoTopTokens [chainId: ${chainId}]: dayStartTime:`, startTime, new Date(startTime * 1000).toISOString())
    return startTime
  }, [chainId])

  // Get token IDs for fetching day data
  const tokenIds = useMemo(() => {
    const ids = data?.tokens?.map(t => t.id.toLowerCase()) || []
    console.log(`TaikoTopTokens [chainId: ${chainId}]: Token IDs for day data query:`, ids.length, ids.slice(0, 3))
    return ids
  }, [data?.tokens, chainId])

  // Fetch token day data for price change calculation
  // NOTE: This uses the POOL subgraph client, not the token subgraph client
  const { data: dayData, error: dayDataError } = useQuery<{ tokenDayDatas: TaikoTokenDayData[] }>(
    TAIKO_TOKEN_DAY_DATA_QUERY,
    {
      client: poolClient,
      variables: {
        tokenIds,
        startDate: dayStartTime,
      },
      skip: !poolClient || tokenIds.length === 0,
      pollInterval: 60000,
      onCompleted: (data) => {
        console.log(`TaikoTopTokens [chainId: ${chainId}]: Day data query completed:`, data?.tokenDayDatas?.length || 0, 'entries')
        if (data?.tokenDayDatas && data.tokenDayDatas.length > 0) {
          console.log(`TaikoTopTokens [chainId: ${chainId}]: Sample day data:`, data.tokenDayDatas[0])
        }
      },
      onError: (error) => {
        console.error(`TaikoTopTokens [chainId: ${chainId}]: Day data query error:`, error)
        console.error(`TaikoTopTokens [chainId: ${chainId}]: Error message:`, error.message)
        console.error(`TaikoTopTokens [chainId: ${chainId}]: Query variables:`, { tokenIds: tokenIds.slice(0, 3), startDate: dayStartTime })
      },
    }
  )

  // Log any persistent errors
  if (dayDataError) {
    console.error(`TaikoTopTokens [chainId: ${chainId}]: Persistent day data error:`, dayDataError.message)
  }

  // Normalize tokens to match the format expected by TokenTable
  const normalizedTokens = useMemo(() => {
    if (!data?.tokens || !data?.bundle) return undefined

    const ethPriceUSD = parseFloat(data.bundle.ethPriceUSD)

    // Create a map of token price changes from dayData
    const priceChangeMap = new Map<string, number>()
    if (dayData?.tokenDayDatas) {
      console.log(`TaikoTopTokens [chainId: ${chainId}]: Received tokenDayDatas:`, dayData.tokenDayDatas.length)
      
      // Group day data by token
      const tokenDayDataByToken = new Map<string, TaikoTokenDayData[]>()
      dayData.tokenDayDatas.forEach(dd => {
        const tokenId = dd.token.id.toLowerCase()  // token.id is the address
        if (!tokenDayDataByToken.has(tokenId)) {
          tokenDayDataByToken.set(tokenId, [])
        }
        tokenDayDataByToken.get(tokenId)!.push(dd)
      })

      console.log(`TaikoTopTokens [chainId: ${chainId}]: Grouped data for tokens:`, tokenDayDataByToken.size)

      // Calculate price change for each token
      tokenDayDataByToken.forEach((dayDatas, tokenId) => {
        if (dayDatas.length >= 2) {
          // Data is ordered descending by date, so [0] is most recent, [1] is previous
          const currentPrice = parseFloat(dayDatas[0]?.priceUSD || '0')
          const previousPrice = parseFloat(dayDatas[1]?.priceUSD || '0')
          
          if (previousPrice > 0 && currentPrice > 0) {
            const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100
            priceChangeMap.set(tokenId, percentChange)
            console.log(`TaikoTopTokens [chainId: ${chainId}]: Token ${tokenId.slice(0, 10)}... - change: ${percentChange.toFixed(2)}%`, {
              current: currentPrice,
              previous: previousPrice,
              currentDate: dayDatas[0].date,
              previousDate: dayDatas[1].date
            })
          }
        } else {
          console.log(`TaikoTopTokens [chainId: ${chainId}]: Token ${tokenId.slice(0, 10)}... - insufficient data (${dayDatas.length} entries)`)
        }
      })
    } else {
      console.log(`TaikoTopTokens [chainId: ${chainId}]: No tokenDayDatas available`)
    }

    return data.tokens.map((token): NormalizedTaikoToken => {
      const volumeUSD = parseFloat(token.volumeUSD)
      const tvlUSD = parseFloat(token.totalValueLockedUSD)
      const derivedETH = parseFloat(token.derivedETH || '0')
      // Calculate USD price: derivedETH * ethPriceUSD
      const priceUSD = derivedETH * ethPriceUSD

      // Get price percent change from the map
      const tokenId = token.id.toLowerCase()
      const pricePercentChange = priceChangeMap.get(tokenId) || 0

      // Determine chain name based on chainId
      const chainName = chainId === TAIKO_MAINNET_CHAIN_ID ? 'TAIKO' : 'TAIKO_HOODI'

      return {
        __typename: 'Token' as const,
        id: `${token.id.toLowerCase()}-${chainName}`,
        address: token.id.toLowerCase(),
        chain: chainName,
        symbol: token.symbol,
        name: token.name,
        decimals: parseInt(token.decimals),
        standard: 'ERC20' as const,
        project: {
          // Token logos would need to be added separately
          logoUrl: undefined,
        },
        market: {
          price: {
            value: priceUSD, // Correct USD price calculation
          },
          pricePercentChange: {
            value: pricePercentChange,
          },
          volume: {
            value: volumeUSD,
          },
          totalValueLocked: {
            value: tvlUSD,
          },
        },
      }
    })
  }, [data, dayData, chainId])

  // Create token sort rank mapping (by volume)
  const tokenSortRank = useMemo(() => {
    if (!normalizedTokens) return {}

    return normalizedTokens.reduce((acc, token, index) => {
      acc[token.address] = index + 1
      return acc
    }, {} as Record<string, number>)
  }, [normalizedTokens])

  // Apply search filter
  const filterString = useAtomValue(filterStringAtom)
  const lowercaseFilterString = useMemo(() => filterString.toLowerCase(), [filterString])

  const filteredTokens = useMemo(() => {
    if (!normalizedTokens) return undefined
    if (!lowercaseFilterString) return normalizedTokens

    return normalizedTokens.filter((token) => {
      const addressIncludesFilterString = token.address.toLowerCase().includes(lowercaseFilterString)
      const nameIncludesFilterString = token.name?.toLowerCase().includes(lowercaseFilterString)
      const symbolIncludesFilterString = token.symbol?.toLowerCase().includes(lowercaseFilterString)
      return nameIncludesFilterString || symbolIncludesFilterString || addressIncludesFilterString
    })
  }, [normalizedTokens, lowercaseFilterString])

  // Sparklines are not supported in the current Goldsky token subgraph
  // This would require historical price data queries
  const sparklines = useMemo(() => ({}), [])

  return {
    tokens: filteredTokens,
    tokenSortRank,
    loadingTokens: loading,
    sparklines,
    error,
  }
}
