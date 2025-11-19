/**
 * Taiko Top Tokens Query
 *
 * Queries token data from Goldsky's Taiko subgraph.
 * The Goldsky token subgraph uses The Graph's standard schema for Uniswap V3 tokens.
 */

import { ApolloError, gql, useQuery } from '@apollo/client'
import { filterStringAtom, sortAscendingAtom, sortMethodAtom, TokenSortMethod } from 'components/Tokens/state'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains/taiko'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { PricePoint, TimePeriod } from '../data/util'
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

export type SparklineMap = { [key: string]: PricePoint[] | undefined }

export interface UseTopTokensTaikoResult {
  tokens?: readonly NormalizedTaikoToken[]
  tokenSortRank: Record<string, number>
  loadingTokens: boolean
  sparklines: SparklineMap
  error?: ApolloError
}

/**
 * Calculate the number of days to look back based on time period
 */
function getDaysForTimePeriod(timePeriod: TimePeriod): number {
  switch (timePeriod) {
    case TimePeriod.HOUR:
      return 1 // Need at least 2 data points within a day
    case TimePeriod.DAY:
      return 2 // Compare current day with previous day
    case TimePeriod.WEEK:
      return 8 // Compare current week with previous week
    case TimePeriod.MONTH:
      return 31 // Compare current month with previous month
    case TimePeriod.YEAR:
      return 366 // Compare current year with previous year
    default:
      return 2
  }
}

/**
 * Sort tokens based on the selected sort method and direction
 */
function useSortedTokens(tokens: readonly NormalizedTaikoToken[] | undefined) {
  const sortMethod = useAtomValue(sortMethodAtom)
  const sortAscending = useAtomValue(sortAscendingAtom)

  return useMemo(() => {
    if (!tokens) return undefined
    let tokenArray = Array.from(tokens)
    switch (sortMethod) {
      case TokenSortMethod.PRICE:
        tokenArray = tokenArray.sort((a, b) => (b?.market?.price?.value ?? 0) - (a?.market?.price?.value ?? 0))
        break
      case TokenSortMethod.PERCENT_CHANGE:
        tokenArray = tokenArray.sort(
          (a, b) => (b?.market?.pricePercentChange?.value ?? 0) - (a?.market?.pricePercentChange?.value ?? 0)
        )
        break
      case TokenSortMethod.TOTAL_VALUE_LOCKED:
        tokenArray = tokenArray.sort(
          (a, b) => (b?.market?.totalValueLocked?.value ?? 0) - (a?.market?.totalValueLocked?.value ?? 0)
        )
        break
      case TokenSortMethod.VOLUME:
        tokenArray = tokenArray.sort((a, b) => (b?.market?.volume?.value ?? 0) - (a?.market?.volume?.value ?? 0))
        break
    }

    return sortAscending ? tokenArray.reverse() : tokenArray
  }, [tokens, sortMethod, sortAscending])
}

/**
 * Hook to fetch and normalize top tokens from Taiko Goldsky subgraph
 *
 * @param chainId - Chain ID for the Taiko network
 * @param timePeriod - Time period for price change calculations
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
  
  // Calculate the start date for fetching historical data based on timePeriod
  const dayStartTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const daysToLookBack = getDaysForTimePeriod(timePeriod)
    const startTime = Math.floor((now - daysToLookBack * 24 * 60 * 60) / 86400) * 86400 // Round down to start of day
    return startTime
  }, [chainId, timePeriod])

  // Get token IDs for fetching day data
  const tokenIds = useMemo(() => {
    return data?.tokens?.map(t => t.id.toLowerCase()) || []
  }, [data?.tokens])

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
    }
  )

  // Normalize tokens to match the format expected by TokenTable
  const normalizedTokens = useMemo(() => {
    if (!data?.tokens || !data?.bundle) return undefined

    const ethPriceUSD = parseFloat(data.bundle.ethPriceUSD)

    // Create a map of token price changes from dayData
    const priceChangeMap = new Map<string, number>()
    if (dayData?.tokenDayDatas) {
      // Group day data by token
      const tokenDayDataByToken = new Map<string, TaikoTokenDayData[]>()
      dayData.tokenDayDatas.forEach(dd => {
        const tokenId = dd.token.id.toLowerCase()  // token.id is the address
        if (!tokenDayDataByToken.has(tokenId)) {
          tokenDayDataByToken.set(tokenId, [])
        }
        tokenDayDataByToken.get(tokenId)!.push(dd)
      })

      // Calculate price change for each token based on timePeriod
      tokenDayDataByToken.forEach((dayDatas, tokenId) => {
        if (dayDatas.length < 2) {
          return
        }

        // Data is ordered descending by date, so [0] is most recent
        const mostRecentData = dayDatas[0]
        const currentPrice = parseFloat(mostRecentData?.priceUSD || '0')

        // Find the comparison data point based on timePeriod
        let comparisonData: TaikoTokenDayData | undefined
        const now = Math.floor(Date.now() / 1000)
        const currentDayId = Math.floor(now / 86400)

        switch (timePeriod) {
          case TimePeriod.HOUR:
            // For hour, compare with data from ~1 day ago (closest available)
            comparisonData = dayDatas.find(dd => dd.date <= currentDayId - 1) || dayDatas[dayDatas.length - 1]
            break
          case TimePeriod.DAY:
            // For day, compare with previous day
            comparisonData = dayDatas.find(dd => dd.date <= currentDayId - 1) || dayDatas[dayDatas.length - 1]
            break
          case TimePeriod.WEEK:
            // For week, compare with ~7 days ago
            comparisonData = dayDatas.find(dd => dd.date <= currentDayId - 7) || dayDatas[dayDatas.length - 1]
            break
          case TimePeriod.MONTH:
            // For month, compare with ~30 days ago
            comparisonData = dayDatas.find(dd => dd.date <= currentDayId - 30) || dayDatas[dayDatas.length - 1]
            break
          case TimePeriod.YEAR:
            // For year, compare with ~365 days ago
            comparisonData = dayDatas.find(dd => dd.date <= currentDayId - 365) || dayDatas[dayDatas.length - 1]
            break
          default:
            comparisonData = dayDatas[1]
        }

        const previousPrice = parseFloat(comparisonData?.priceUSD || '0')
        
        if (previousPrice > 0 && currentPrice > 0) {
          const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100
          priceChangeMap.set(tokenId, percentChange)
        }
      })
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

  // Apply sorting based on selected sort method
  const sortedTokens = useSortedTokens(normalizedTokens)

  // Create token sort rank mapping (based on sorted order)
  const tokenSortRank = useMemo(() => {
    if (!sortedTokens) return {}

    return sortedTokens.reduce((acc, token, index) => {
      acc[token.address] = index + 1
      return acc
    }, {} as Record<string, number>)
  }, [sortedTokens])

  // Apply search filter
  const filterString = useAtomValue(filterStringAtom)
  const lowercaseFilterString = useMemo(() => filterString.toLowerCase(), [filterString])

  const filteredTokens = useMemo(() => {
    if (!sortedTokens) return undefined
    if (!lowercaseFilterString) return sortedTokens

    return sortedTokens.filter((token) => {
      const addressIncludesFilterString = token.address.toLowerCase().includes(lowercaseFilterString)
      const nameIncludesFilterString = token.name?.toLowerCase().includes(lowercaseFilterString)
      const symbolIncludesFilterString = token.symbol?.toLowerCase().includes(lowercaseFilterString)
      return nameIncludesFilterString || symbolIncludesFilterString || addressIncludesFilterString
    })
  }, [sortedTokens, lowercaseFilterString])

  // Build sparklines from tokenDayDatas
  const sparklines = useMemo(() => {
    const map: SparklineMap = {}
    
    if (!dayData?.tokenDayDatas) {
      return map
    }

    // Group day data by token address
    const tokenDayDataByToken = new Map<string, TaikoTokenDayData[]>()
    dayData.tokenDayDatas.forEach(dd => {
      const tokenId = dd.token.id.toLowerCase()
      if (!tokenDayDataByToken.has(tokenId)) {
        tokenDayDataByToken.set(tokenId, [])
      }
      tokenDayDataByToken.get(tokenId)!.push(dd)
    })

    // Transform each token's day data into PricePoint array
    tokenDayDataByToken.forEach((dayDatas, tokenId) => {
      // Sort by date ascending for sparkline (oldest to newest)
      const sortedDayDatas = [...dayDatas].sort((a, b) => a.date - b.date)
      
      // Convert to PricePoint array
      const pricePoints: PricePoint[] = sortedDayDatas.map(dd => ({
        timestamp: dd.date * 86400, // Convert day ID to Unix timestamp (seconds)
        value: parseFloat(dd.priceUSD || '0')
      })).filter(p => p.value > 0) // Filter out zero prices
      
      if (pricePoints.length > 0) {
        map[tokenId] = pricePoints
      }
    })

    return map
  }, [dayData, chainId])

  return {
    tokens: filteredTokens,
    tokenSortRank,
    loadingTokens: loading,
    sparklines,
    error,
  }
}
