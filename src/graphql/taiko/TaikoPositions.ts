import { gql, useQuery } from '@apollo/client'
import { isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { AddressZero } from '@ethersproject/constants'
import { isTaikoChain } from 'config/chains/taiko'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { useMemo } from 'react'
import { PositionDetails } from 'types/position'

import { getPoolClientForChain } from './apollo'

const MAX_SUBGRAPH_BLOCK_LAG = 20
const MAX_SUBGRAPH_POSITIONS = 1_000
const ZERO = BigNumber.from(0)

const TAIKO_USER_POSITIONS_QUERY = gql`
  query TaikoUserPositionsForPools($account: Bytes!) {
    _meta {
      block {
        number
      }
      hasIndexingErrors
    }
    positions(first: 1000, orderBy: id, orderDirection: asc, where: { owner: $account }) {
      id
      liquidity
      feeTier
      tickLower
      tickUpper
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`

interface TaikoPosition {
  id: string
  liquidity: string
  feeTier: string
  tickLower: string
  tickUpper: string
  token0: { id: string }
  token1: { id: string }
}

interface TaikoPositionsData {
  _meta?: {
    block?: { number: number }
    hasIndexingErrors?: boolean
  }
  positions: TaikoPosition[]
}

interface TaikoPositionsResult {
  loading: boolean
  positions?: PositionDetails[]
  fallbackToRpc: boolean
}

function mapPosition(position: TaikoPosition): PositionDetails {
  const fee = Number(position.feeTier)
  const tickLower = Number(position.tickLower)
  const tickUpper = Number(position.tickUpper)
  if (
    ![fee, tickLower, tickUpper].every(Number.isSafeInteger) ||
    !isAddress(position.token0.id) ||
    !isAddress(position.token1.id)
  ) {
    throw new Error('Invalid Taiko position value')
  }

  return {
    tokenId: BigNumber.from(position.id),
    fee,
    liquidity: BigNumber.from(position.liquidity),
    tickLower,
    tickUpper,
    token0: position.token0.id,
    token1: position.token1.id,
    nonce: ZERO,
    operator: AddressZero,
    feeGrowthInside0LastX128: ZERO,
    feeGrowthInside1LastX128: ZERO,
    tokensOwed0: ZERO,
    tokensOwed1: ZERO,
  }
}

export function useTaikoV3Positions(
  chainId: number | undefined,
  account: string | null | undefined
): TaikoPositionsResult {
  const latestBlock = useBlockNumber()
  const enabled = !!chainId && isTaikoChain(chainId) && !!account
  const client = enabled ? getPoolClientForChain(chainId) : undefined
  const { data, loading, error } = useQuery<TaikoPositionsData>(TAIKO_USER_POSITIONS_QUERY, {
    client,
    variables: { account: account?.toLowerCase() ?? '' },
    skip: !client || !account,
    fetchPolicy: 'cache-and-network',
  })

  return useMemo(() => {
    if (!enabled) return { loading: false, fallbackToRpc: false }
    if (!client || error) return { loading: false, fallbackToRpc: true }
    if (loading && !data) return { loading: true, fallbackToRpc: false }

    const indexedBlock = data?._meta?.block?.number
    const isStale =
      latestBlock !== undefined && indexedBlock !== undefined && latestBlock - indexedBlock > MAX_SUBGRAPH_BLOCK_LAG
    if (
      !data ||
      !Number.isSafeInteger(indexedBlock) ||
      data._meta?.hasIndexingErrors ||
      isStale ||
      !Array.isArray(data.positions) ||
      data.positions.length >= MAX_SUBGRAPH_POSITIONS
    ) {
      return { loading: false, fallbackToRpc: true }
    }

    try {
      return {
        loading: false,
        positions: data.positions.map(mapPosition),
        fallbackToRpc: false,
      }
    } catch {
      return { loading: false, fallbackToRpc: true }
    }
  }, [client, data, enabled, error, latestBlock, loading])
}
