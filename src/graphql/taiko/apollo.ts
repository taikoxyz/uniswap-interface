/**
 * Apollo Client for Taiko Goldsky Subgraphs
 *
 * This module provides GraphQL clients for querying Taiko-specific data
 * from Goldsky subgraphs.
 */

import { ApolloClient, InMemoryCache, HttpLink, NormalizedCacheObject } from '@apollo/client'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

/**
 * Goldsky subgraph URLs for Taiko networks
 * Configurable via environment variables
 */
const TAIKO_MAINNET_SUBGRAPH_URLS = {
  tokens: process.env.REACT_APP_TAIKO_MAINNET_SUBGRAPH_TOKENS || '',
  pools: process.env.REACT_APP_TAIKO_MAINNET_SUBGRAPH_POOLS || '',
} as const

const TAIKO_HOODI_SUBGRAPH_URLS = {
  tokens: process.env.REACT_APP_TAIKO_HOODI_SUBGRAPH_TOKENS || 'https://api.goldsky.com/api/public/project_clz85cxrvng3n01ughcv5e7hg/subgraphs/v3-tokens-taiko-hoodi-testnet/7060ecc/gn',
  pools: process.env.REACT_APP_TAIKO_HOODI_SUBGRAPH_POOLS || 'https://api.goldsky.com/api/public/project_clz85cxrvng3n01ughcv5e7hg/subgraphs/uniswap-v3-taiko-hoodi-testnet/7060ecc/gn',
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
export const taikoHoodiTokenClient = createTokenClient(TAIKO_HOODI_SUBGRAPH_URLS.tokens)

/**
 * Backward compatibility: export Hoodi client as default taikoTokenClient
 * @deprecated Use taikoHoodiTokenClient or getTokenClientForChain instead
 */
export const taikoTokenClient = taikoHoodiTokenClient

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
