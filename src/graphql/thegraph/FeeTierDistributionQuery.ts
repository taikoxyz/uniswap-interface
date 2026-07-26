import { ApolloError, useQuery } from '@apollo/client'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'constants/taiko'
import gql from 'graphql-tag'
import { useMemo } from 'react'

import { apolloClient } from './apollo'

const query = gql`
  query FeeTierDistribution($token0: String!, $token1: String!) {
    _meta {
      block {
        number
      }
    }
    asToken0: pools(
      orderBy: totalValueLockedToken0
      orderDirection: desc
      where: { token0: $token0, token1: $token1 }
    ) {
      feeTier
      totalValueLockedToken0
      totalValueLockedToken1
    }
    asToken1: pools(
      orderBy: totalValueLockedToken0
      orderDirection: desc
      where: { token0: $token1, token1: $token0 }
    ) {
      feeTier
      totalValueLockedToken0
      totalValueLockedToken1
    }
  }
`

interface FeeTierDistributionPool {
  feeTier: string
  totalValueLockedToken0: string
  totalValueLockedToken1: string
}

// Result shape of the local `query` document above (with the asToken0/asToken1/_meta aliases).
// Note: the FeeTierDistributionQuery type in __generated__/types-and-hooks describes a different
// document (plain `pools`) that this hook does not execute.
export interface FeeTierDistributionQueryData {
  _meta?: { block?: { number: number } }
  asToken0: FeeTierDistributionPool[]
  asToken1: FeeTierDistributionPool[]
}

export default function useFeeTierDistributionQuery(
  token0: string | undefined,
  token1: string | undefined,
  interval: number
): { error?: ApolloError; isLoading: boolean; data: FeeTierDistributionQueryData | undefined } {
  const { chainId } = useWeb3React()

  // Skip subgraph queries for Taiko chains (no subgraph deployed yet)
  const skip = chainId === TAIKO_MAINNET_CHAIN_ID || chainId === TAIKO_HOODI_CHAIN_ID

  const {
    data,
    loading: isLoading,
    error,
  } = useQuery<FeeTierDistributionQueryData>(query, {
    variables: {
      token0: token0?.toLowerCase(),
      token1: token1?.toLowerCase(),
    },
    pollInterval: interval,
    client: apolloClient,
    skip,
  })

  return useMemo(
    () => ({
      error,
      isLoading,
      data,
    }),
    [data, error, isLoading]
  )
}
