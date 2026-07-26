/**
 * Single Token Query for Taiko Goldsky Subgraph
 *
 * This module provides a hook to fetch individual token data from the Goldsky subgraph
 * for Taiko networks (Mainnet and Hoodi).
 */

import { gql, useQuery, ApolloError } from '@apollo/client'
import { useMemo } from 'react'
import { getTokenClientForChain } from './apollo'

/**
 * GraphQL query for a single token on Taiko
 * Fetches token metadata and market data
 * Also fetches bundle for ETH price in USD to calculate token price
 */
const TAIKO_TOKEN_QUERY = gql`
  query TaikoToken($tokenId: ID!) {
    token(id: $tokenId) {
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
 * Raw token data from Goldsky subgraph
 */
interface TaikoTokenData {
  id: string
  symbol: string
  name: string
  decimals: string
  volumeUSD: string
  totalValueLockedUSD: string
  feesUSD: string
  txCount: string
  derivedETH: string
}

/**
 * Bundle data for ETH price
 */
interface BundleData {
  ethPriceUSD: string
}

/**
 * Response from Goldsky subgraph
 */
interface TaikoTokenResponse {
  token: TaikoTokenData | null
  bundle: BundleData | null
}

/**
 * Hook to fetch single token data from Taiko Goldsky subgraph
 *
 * @param chainId - The Taiko chain ID (167000 for Mainnet, 167013 for Hoodi)
 * @param address - The token address (lowercase)
 * @returns Token data with loading/error states
 */
export function useTaikoToken(chainId: number, address: string | undefined) {
  const client = getTokenClientForChain(chainId)

  // Query the subgraph
  const { data, loading, error } = useQuery<TaikoTokenResponse>(TAIKO_TOKEN_QUERY, {
    variables: {
      tokenId: address?.toLowerCase(),
    },
    skip: !address || !client,
    client,
  })

  // Transform the data
  const tokenData = useMemo(() => {
    if (!data?.token || !data?.bundle) {
      return null
    }

    const token = data.token
    const ethPriceUSD = parseFloat(data.bundle.ethPriceUSD)
    const derivedETH = parseFloat(token.derivedETH)
    const priceUSD = derivedETH * ethPriceUSD

    return {
      id: token.id,
      address: token.id.toLowerCase(),
      symbol: token.symbol,
      name: token.name,
      decimals: parseInt(token.decimals),
      volumeUSD: parseFloat(token.volumeUSD),
      totalValueLockedUSD: parseFloat(token.totalValueLockedUSD),
      feesUSD: parseFloat(token.feesUSD),
      txCount: parseInt(token.txCount),
      priceUSD,
      derivedETH,
      ethPriceUSD,
    }
  }, [data])

  return {
    token: tokenData,
    loading,
    error: error as ApolloError | undefined,
  }
}
