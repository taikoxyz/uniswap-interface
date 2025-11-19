import { ChainId } from '@uniswap/sdk-core'
import { TimePeriod } from 'graphql/data/util'
import { useMemo } from 'react'

import { isTaikoChain } from 'config/chains/taiko'
import { getPoolClientForChain as getTaikoPoolClient } from '../taiko/apollo'
import { usePoolDayDataQuery, usePoolHourDataQuery } from './__generated__/types-and-hooks'
import { chainToApolloClient } from './apollo'

export interface ChartDataPoint {
  timestamp: number
  volumeUSD: number
  tvlUSD: number
}

function getTimeRange(timePeriod: TimePeriod): { startTime: number; endTime: number; useHourData: boolean } {
  const endTime = Math.floor(Date.now() / 1000)
  let startTime: number
  let useHourData = false

  switch (timePeriod) {
    case TimePeriod.HOUR:
      startTime = endTime - 3600 // 1 hour
      useHourData = true
      break
    case TimePeriod.DAY:
      startTime = endTime - 86400 // 24 hours
      useHourData = true
      break
    case TimePeriod.WEEK:
      startTime = endTime - 604800 // 7 days
      useHourData = false
      break
    case TimePeriod.MONTH:
      startTime = endTime - 2592000 // 30 days
      useHourData = false
      break
    case TimePeriod.YEAR:
      startTime = endTime - 31536000 // 365 days
      useHourData = false
      break
    default:
      startTime = endTime - 86400 // Default to 24 hours
      useHourData = true
  }

  return { startTime, endTime, useHourData }
}

export function usePoolChartData(poolAddress: string, chainId: ChainId | undefined, timePeriod: TimePeriod) {
  const { startTime, endTime, useHourData } = getTimeRange(timePeriod)

  // Use Taiko-specific Apollo client for Taiko chains, otherwise use standard client
  const isTaiko = chainId && isTaikoChain(chainId)
  const apolloClient = isTaiko
    ? getTaikoPoolClient(chainId)
    : chainToApolloClient[chainId || ChainId.MAINNET]

  // Fetch hour data for short time periods
  const shouldFetchHourData = useHourData && !!poolAddress
  const { data: hourData, loading: hourLoading } = usePoolHourDataQuery({
    variables: { poolAddress: poolAddress || '', startTime, endTime },
    client: apolloClient,
  })

  // Fetch day data for longer time periods
  const shouldFetchDayData = !useHourData && !!poolAddress
  const { data: dayData, loading: dayLoading } = usePoolDayDataQuery({
    variables: { poolAddress: poolAddress || '', startTime, endTime },
    client: apolloClient,
  })

  const chartData = useMemo(() => {
    if (useHourData && hourData?.poolHourDatas) {
      return hourData.poolHourDatas.map((data) => ({
        timestamp: data.periodStartUnix,
        volumeUSD: parseFloat(data.volumeUSD),
        tvlUSD: parseFloat(data.tvlUSD),
      }))
    } else if (!useHourData && dayData?.poolDayDatas) {
      return dayData.poolDayDatas.map((data) => ({
        timestamp: data.date,
        volumeUSD: parseFloat(data.volumeUSD),
        tvlUSD: parseFloat(data.tvlUSD),
      }))
    }
    return []
  }, [useHourData, hourData, dayData])

  return {
    data: chartData,
    loading: useHourData ? hourLoading : dayLoading,
  }
}
