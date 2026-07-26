/**
 * Apollo Client for Taiko Goldsky Subgraphs
 *
 * This module provides GraphQL clients for querying Taiko-specific data
 * from Goldsky subgraphs.
 */

import { ApolloClient, HttpLink, InMemoryCache, NormalizedCacheObject } from '@apollo/client'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

/**
 * Goldsky subgraph URLs for Taiko networks
 * Configurable via environment variables
 */
const TAIKO_MAINNET_SUBGRAPH_URLS = {
  tokens: process.env.REACT_APP_TAIKO_MAINNET_SUBGRAPH_TOKENS,
  pools: process.env.REACT_APP_TAIKO_MAINNET_SUBGRAPH_POOLS,
} as const

const TAIKO_HOODI_SUBGRAPH_URLS = {
  tokens: process.env.REACT_APP_TAIKO_HOODI_SUBGRAPH_TOKENS,
  pools: process.env.REACT_APP_TAIKO_HOODI_SUBGRAPH_POOLS,
} as const

/**
 * Create Apollo client with token cache configuration
 */
function createTokenClient(uri: string): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Token: {
          // Ensure addresses are always lowercase for consistency
          fields: {
            id: {
              read(id: string): string {
                return id.toLowerCase()
              },
            },
          },
        },
      },
    }),
    link: new HttpLink({ uri }),
  })
}

/**
 * Apollo client for Taiko Mainnet token data
 */
export const taikoMainnetTokenClient = TAIKO_MAINNET_SUBGRAPH_URLS.tokens
  ? createTokenClient(TAIKO_MAINNET_SUBGRAPH_URLS.tokens)
  : undefined

/**
 * Apollo client for Taiko Hoodi token data
 */
export const taikoHoodiTokenClient = TAIKO_HOODI_SUBGRAPH_URLS.tokens
  ? createTokenClient(TAIKO_HOODI_SUBGRAPH_URLS.tokens)
  : undefined

/**
 * Backward compatibility: export mainnet client as default if available, otherwise hoodi
 * @deprecated Use taikoMainnetTokenClient, taikoHoodiTokenClient or getTokenClientForChain instead
 */
export const taikoTokenClient = taikoMainnetTokenClient || taikoHoodiTokenClient

/**
 * Map of chain IDs to their token subgraph clients
 */
export const chainToTokenClient: Record<number, ApolloClient<NormalizedCacheObject> | undefined> = {
  [TAIKO_MAINNET_CHAIN_ID]: taikoMainnetTokenClient,
  [TAIKO_HOODI_CHAIN_ID]: taikoHoodiTokenClient,
}

/**
 * Get token subgraph client for a given chain
 */
export function getTokenClientForChain(chainId: number): ApolloClient<NormalizedCacheObject> | undefined {
  return chainToTokenClient[chainId]
}

/**
 * Create Apollo client for pool data
 */
function createPoolClient(uri: string): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri }),
  })
}

/**
 * Apollo client for Taiko Mainnet pool data
 */
export const taikoMainnetPoolClient = TAIKO_MAINNET_SUBGRAPH_URLS.pools
  ? createPoolClient(TAIKO_MAINNET_SUBGRAPH_URLS.pools)
  : undefined

/**
 * Apollo client for Taiko Hoodi pool data
 */
export const taikoHoodiPoolClient = TAIKO_HOODI_SUBGRAPH_URLS.pools
  ? createPoolClient(TAIKO_HOODI_SUBGRAPH_URLS.pools)
  : undefined

/**
 * Map of chain IDs to their pool subgraph clients
 */
export const chainToPoolClient: Record<number, ApolloClient<NormalizedCacheObject> | undefined> = {
  [TAIKO_MAINNET_CHAIN_ID]: taikoMainnetPoolClient,
  [TAIKO_HOODI_CHAIN_ID]: taikoHoodiPoolClient,
}

/**
 * Get pool subgraph client for a given chain
 * Used by pool data queries and detail pages
 */
export function getPoolClientForChain(chainId: number): ApolloClient<NormalizedCacheObject> | undefined {
  return chainToPoolClient[chainId]
}
