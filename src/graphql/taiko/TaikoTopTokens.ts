/**
 * Taiko Top Tokens Query
 *
 * Queries token data from Goldsky's Taiko subgraph.
 * The Goldsky token subgraph uses The Graph's standard schema for Uniswap V3 tokens.
 */

import { useQuery, gql, ApolloError } from '@apollo/client'
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { getTokenClientForChain } from './apollo'
import { TimePeriod } from '../data/util'
import { TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID } from 'config/chains/taiko'
import { filterStringAtom } from 'components/Tokens/state'

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
  const client = getTokenClientForChain(chainId)

  const { data, loading, error } = useQuery<{ tokens: TaikoToken[]; bundle: { ethPriceUSD: string } }>(
    TAIKO_TOP_TOKENS_QUERY,
    {
      client,
      variables: {
        // Use TVL for ordering since volume may be zero on new testnets
        orderBy: 'totalValueLockedUSD',
        orderDirection: 'desc',
      },
      pollInterval: 60000, // Poll every 60 seconds
      skip: !client, // Skip if no client available for this chain
    }
  )

  // Normalize tokens to match the format expected by TokenTable
  const normalizedTokens = useMemo(() => {
    if (!data?.tokens || !data?.bundle) return undefined

    const ethPriceUSD = parseFloat(data.bundle.ethPriceUSD)

    return data.tokens.map((token): NormalizedTaikoToken => {
      const volumeUSD = parseFloat(token.volumeUSD)
      const tvlUSD = parseFloat(token.totalValueLockedUSD)
      const derivedETH = parseFloat(token.derivedETH || '0')
      // Calculate USD price: derivedETH * ethPriceUSD
      const priceUSD = derivedETH * ethPriceUSD

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
            // Note: Goldsky token subgraph may not have historical price data
            // This would require additional queries or a different subgraph
            value: 0,
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
  }, [data])

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
