import gql from 'graphql-tag'
import { useMemo } from 'react'
import { isTaikoChain } from 'config/chains/taiko'
import { useTaikoTokenPriceHistory } from 'graphql/taiko/TaikoTokenPrice'
import { supportedChainIdFromGQLChain } from './util'
import { useTokenPriceQuery as useGeneratedTokenPriceQuery } from './__generated__/types-and-hooks'
import type { Chain, HistoryDuration, TokenPriceQuery } from './__generated__/types-and-hooks'

gql`
  query TokenPrice($chain: Chain!, $address: String = null, $duration: HistoryDuration!) {
    token(chain: $chain, address: $address) {
      id
      address
      chain
      market(currency: USD) {
        id
        price {
          id
          value
        }
        priceHistory(duration: $duration) {
          id
          timestamp
          value
        }
      }
    }
  }
`

gql`
  query UniswapPrices($contracts: [ContractInput!]!) {
    tokens(contracts: $contracts) {
      id
      address
      chain
      standard
      project {
        id
        markets(currencies: [USD]) {
          id
          price {
            id
            value
          }
        }
      }
    }
  }
`

export type { TokenPriceQuery } from './__generated__/types-and-hooks'

/**
 * Wrapper hook for useTokenPriceQuery that routes to Taiko subgraph for Taiko chains
 * and Uniswap API for other chains
 */
export function useTokenPriceQuery(options: {
  variables: {
    address?: string
    chain: Chain
    duration: HistoryDuration
  }
  errorPolicy?: 'all' | 'none' | 'ignore'
  skip?: boolean
}): { data: TokenPriceQuery | undefined; loading: boolean; error?: Error } {
  // Use page chain parameter, not wallet's connected chain
  const pageChainId = supportedChainIdFromGQLChain(options.variables.chain)
  const isTaiko = pageChainId && isTaikoChain(pageChainId)

  // Convert HistoryDuration to TimePeriod for Taiko hook
  const timePeriod = useMemo(() => {
    // Map HistoryDuration to TimePeriod (reverse of toHistoryDuration)
    switch (options.variables.duration) {
      case 'HOUR':
        return 0 // TimePeriod.HOUR
      case 'DAY':
        return 1 // TimePeriod.DAY
      case 'WEEK':
        return 2 // TimePeriod.WEEK
      case 'MONTH':
        return 3 // TimePeriod.MONTH
      case 'YEAR':
        return 4 // TimePeriod.YEAR
      default:
        return 1 // Default to DAY
    }
  }, [options.variables.duration])

  // Use Taiko subgraph for Taiko chains
  const { priceHistory: taikoPrices, loading: taikoLoading } = useTaikoTokenPriceHistory(
    pageChainId || 167013, // Default to Hoodi if pageChainId is undefined
    options.variables.address || '',
    timePeriod
  )

  // Use Uniswap API for other chains
  const { data: apiData, loading: apiLoading, error: apiError } = useGeneratedTokenPriceQuery({
    ...options,
    skip: isTaiko || options.skip || !options.variables.address, // Skip API query on Taiko or if no address
  })

  const { address, chain } = options.variables

  return useMemo(() => {
    if (isTaiko) {
      // Transform Taiko data to match TokenPriceQuery format
      if (!taikoPrices || taikoPrices.length === 0 || !address) {
        return {
          data: undefined,
          loading: taikoLoading,
        }
      }

      // Get the latest price
      const latestPrice = taikoPrices[taikoPrices.length - 1]

      const transformedData: TokenPriceQuery = {
        token: {
          __typename: 'Token',
          id: `${address}-${chain}`,
          address,
          chain: chain,
          market: {
            __typename: 'TokenMarket',
            id: `${address}-${chain}-USD`,
            price: latestPrice
              ? {
                  __typename: 'Amount',
                  id: `${address}-${chain}-USD-price`,
                  value: latestPrice.value,
                }
              : undefined,
            priceHistory: taikoPrices.map((point) => ({
              __typename: 'TimestampedAmount' as const,
              id: `${address}-${point.timestamp}`,
              timestamp: point.timestamp,
              value: point.value,
            })),
          },
        },
      }

      return {
        data: transformedData,
        loading: taikoLoading,
      }
    }

    return {
      data: apiData,
      loading: apiLoading,
      error: apiError,
    }
  }, [isTaiko, taikoPrices, taikoLoading, apiData, apiLoading, apiError, address, chain])
}
