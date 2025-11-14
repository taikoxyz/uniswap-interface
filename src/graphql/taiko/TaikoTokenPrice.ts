/**
 * Taiko Token Price History Queries
 *
 * Queries historical price data from Goldsky's Taiko subgraph.
 * Uses tokenHourDatas for short timeframes (HOUR, DAY) and tokenDayDatas for longer timeframes (WEEK, MONTH, YEAR).
 */

import { gql, useQuery, ApolloError } from '@apollo/client'
import { useMemo } from 'react'
import { getTokenClientForChain } from './apollo'
import { TimePeriod, PricePoint } from '../data/util'

/**
 * Token hour data structure from Goldsky subgraph
 * Provides OHLC (Open, High, Low, Close) data for each hour
 */
export interface TaikoTokenHourData {
  periodStartUnix: number
  priceUSD: string
  open: string
  high: string
  low: string
  close: string
  volumeUSD: string
}

/**
 * Token day data structure from Goldsky subgraph
 * Provides OHLC data for each day
 */
export interface TaikoTokenDayData {
  date: number
  priceUSD: string
  volumeUSD: string
  open: string
  high: string
  low: string
  close: string
}

/**
 * GraphQL query for hourly token data
 * Used for HOUR and DAY timeframes
 */
const TAIKO_TOKEN_HOUR_DATA_QUERY = gql`
  query TaikoTokenHourData($tokenAddress: Bytes!, $startTime: Int!) {
    tokenHourDatas(
      where: { token: $tokenAddress, periodStartUnix_gte: $startTime }
      orderBy: periodStartUnix
      orderDirection: asc
      first: 1000
    ) {
      periodStartUnix
      priceUSD
      open
      high
      low
      close
      volumeUSD
    }
  }
`

/**
 * GraphQL query for daily token data
 * Used for WEEK, MONTH, and YEAR timeframes
 */
const TAIKO_TOKEN_DAY_DATA_QUERY = gql`
  query TaikoTokenDayData($tokenAddress: Bytes!, $startDate: Int!) {
    tokenDayDatas(
      where: { token: $tokenAddress, date_gte: $startDate }
      orderBy: date
      orderDirection: asc
      first: 1000
    ) {
      date
      priceUSD
      volumeUSD
      open
      high
      low
      close
    }
  }
`

/**
 * Calculate the start timestamp based on the time period
 * @param duration - The time period to calculate the start time for
 * @returns Unix timestamp (in seconds) for the start of the time period
 */
function getStartTimestamp(duration: TimePeriod): number {
  const now = Math.floor(Date.now() / 1000)

  switch (duration) {
    case TimePeriod.HOUR:
      return now - 60 * 60 // 1 hour ago
    case TimePeriod.DAY:
      return now - 24 * 60 * 60 // 1 day ago
    case TimePeriod.WEEK:
      return now - 7 * 24 * 60 * 60 // 1 week ago
    case TimePeriod.MONTH:
      return now - 30 * 24 * 60 * 60 // 30 days ago
    case TimePeriod.YEAR:
      return now - 365 * 24 * 60 * 60 // 365 days ago
    default:
      return now - 24 * 60 * 60 // Default to 1 day
  }
}

/**
 * Determine if we should use hourly or daily data based on the time period
 * @param duration - The time period
 * @returns true if hourly data should be used, false for daily data
 */
function shouldUseHourlyData(duration: TimePeriod): boolean {
  return duration === TimePeriod.HOUR || duration === TimePeriod.DAY
}

/**
 * Transform hourly data to PricePoint array
 */
function transformHourlyData(data: TaikoTokenHourData[]): PricePoint[] {
  return data.map((point) => ({
    timestamp: point.periodStartUnix,
    value: parseFloat(point.priceUSD || point.close || '0'),
  }))
}

/**
 * Transform daily data to PricePoint array
 */
function transformDailyData(data: TaikoTokenDayData[]): PricePoint[] {
  return data.map((point) => ({
    timestamp: point.date,
    value: parseFloat(point.priceUSD || point.close || '0'),
  }))
}

export interface UseTaikoTokenPriceHistoryResult {
  priceHistory: PricePoint[] | undefined
  loading: boolean
  error: ApolloError | undefined
}

/**
 * Hook to fetch historical price data for a token from Taiko Goldsky subgraph
 *
 * @param chainId - Chain ID for the Taiko network (167000 for Mainnet, 167013 for Hoodi)
 * @param tokenAddress - Token contract address (checksummed or lowercase)
 * @param duration - Time period for historical data (HOUR, DAY, WEEK, MONTH, YEAR)
 * @returns Object containing priceHistory array, loading state, and error
 *
 * @example
 * ```tsx
 * const { priceHistory, loading, error } = useTaikoTokenPriceHistory(
 *   167013,
 *   '0x1234567890123456789012345678901234567890',
 *   TimePeriod.DAY
 * )
 * ```
 */
export function useTaikoTokenPriceHistory(
  chainId: number,
  tokenAddress: string,
  duration: TimePeriod
): UseTaikoTokenPriceHistoryResult {
  const client = getTokenClientForChain(chainId)
  const useHourlyData = shouldUseHourlyData(duration)
  const startTime = getStartTimestamp(duration)

  // Query for hourly data
  const {
    data: hourlyData,
    loading: hourlyLoading,
    error: hourlyError,
  } = useQuery<{ tokenHourDatas: TaikoTokenHourData[] }>(TAIKO_TOKEN_HOUR_DATA_QUERY, {
    client,
    variables: {
      tokenAddress: tokenAddress.toLowerCase(),
      startTime,
    },
    skip: !client || !tokenAddress || !useHourlyData,
    pollInterval: 60000, // Poll every 60 seconds
  })

  // Query for daily data
  const {
    data: dailyData,
    loading: dailyLoading,
    error: dailyError,
  } = useQuery<{ tokenDayDatas: TaikoTokenDayData[] }>(TAIKO_TOKEN_DAY_DATA_QUERY, {
    client,
    variables: {
      tokenAddress: tokenAddress.toLowerCase(),
      startDate: startTime,
    },
    skip: !client || !tokenAddress || useHourlyData,
    pollInterval: 60000, // Poll every 60 seconds
  })

  // Transform the data to PricePoint format
  const priceHistory = useMemo(() => {
    if (useHourlyData && hourlyData?.tokenHourDatas) {
      return transformHourlyData(hourlyData.tokenHourDatas)
    } else if (!useHourlyData && dailyData?.tokenDayDatas) {
      return transformDailyData(dailyData.tokenDayDatas)
    }
    return undefined
  }, [useHourlyData, hourlyData, dailyData])

  return {
    priceHistory,
    loading: useHourlyData ? hourlyLoading : dailyLoading,
    error: useHourlyData ? hourlyError : dailyError,
  }
}

/**
 * Hook variant that returns data in the same format as the Uniswap API
 * This is an alias for useTaikoTokenPriceHistory for consistency with existing code
 */
export function useTaikoPriceHistory(
  chainId: number,
  tokenAddress: string,
  duration: TimePeriod
): UseTaikoTokenPriceHistoryResult {
  return useTaikoTokenPriceHistory(chainId, tokenAddress, duration)
}
