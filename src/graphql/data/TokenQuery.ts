/**
 * Token Query Wrapper
 *
 * This module provides a unified interface for querying token data
 * that routes Taiko chains to Goldsky subgraph and other chains to Uniswap API.
 */

import { useMemo } from 'react'
import { isTaikoChain, TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID } from 'config/chains/taiko'
import { useTaikoToken } from 'graphql/taiko/TaikoToken'
import { supportedChainIdFromGQLChain } from './util'
import { useTokenQuery as useGeneratedTokenQuery } from './__generated__/types-and-hooks'
import type { Chain, TokenQuery } from './__generated__/types-and-hooks'

/**
 * Options for useTokenQuery
 */
interface TokenQueryOptions {
  variables: {
    address?: string
    chain: Chain | string
  }
  errorPolicy?: 'all' | 'none' | 'ignore'
  skip?: boolean
}

/**
 * Unified hook for querying token data
 * Routes Taiko chains to Goldsky subgraph, other chains to Uniswap API
 */
export function useTokenQuery(options: TokenQueryOptions): {
  data: TokenQuery | undefined
  loading: boolean
  error?: Error
} {
  // Use page chain parameter, not wallet's connected chain
  const pageChainId = supportedChainIdFromGQLChain(options.variables.chain)
  const isTaiko = pageChainId && isTaikoChain(pageChainId)

  // Use Taiko subgraph for Taiko chains
  const { token: taikoToken, loading: taikoLoading, error: taikoError } = useTaikoToken(
    pageChainId || 167013, // Default to Hoodi if pageChainId is undefined
    options.variables.address
  )

  // Use Uniswap API for other chains
  const { data: apiData, loading: apiLoading, error: apiError } = useGeneratedTokenQuery({
    variables: {
      address: options.variables.address,
      chain: options.variables.chain as Chain,
    },
    errorPolicy: options.errorPolicy,
    skip: isTaiko || options.skip || !options.variables.address, // Skip API query on Taiko or if no address
  })

  const { address, chain } = options.variables

  return useMemo(() => {
    if (isTaiko) {
      // Transform Taiko data to match TokenQuery format
      if (!taikoToken || !address) {
        return {
          data: undefined,
          loading: taikoLoading,
          error: taikoError,
        }
      }

      // Determine chain name based on chainId
      const chainName = pageChainId === TAIKO_MAINNET_CHAIN_ID ? 'TAIKO' : 'TAIKO_HOODI'

      const transformedData: TokenQuery = {
        token: {
          __typename: 'Token',
          id: `${taikoToken.address}-${chainName}`,
          address: taikoToken.address,
          chain: chainName as any,
          decimals: taikoToken.decimals,
          name: taikoToken.name,
          symbol: taikoToken.symbol,
          standard: 'ERC20' as any,
          market: {
            __typename: 'TokenMarket',
            id: `${taikoToken.address}-${chainName}-USD`,
            totalValueLocked: {
              __typename: 'Amount',
              id: `${taikoToken.address}-${chainName}-tvl`,
              value: taikoToken.totalValueLockedUSD,
              currency: 'USD' as any,
            },
            price: {
              __typename: 'Amount',
              id: `${taikoToken.address}-${chainName}-price`,
              value: taikoToken.priceUSD,
              currency: 'USD' as any,
            },
            volume24H: {
              __typename: 'Amount',
              id: `${taikoToken.address}-${chainName}-volume24h`,
              value: taikoToken.volumeUSD,
              currency: 'USD' as any,
            },
            priceHigh52W: undefined,
            priceLow52W: undefined,
          },
          project: undefined,
        },
      }

      return {
        data: transformedData,
        loading: taikoLoading,
        error: taikoError,
      }
    }

    // Return Uniswap API data for non-Taiko chains
    return {
      data: apiData,
      loading: apiLoading,
      error: apiError,
    }
  }, [isTaiko, taikoToken, taikoLoading, taikoError, apiData, apiLoading, apiError, address, chain, pageChainId])
}
