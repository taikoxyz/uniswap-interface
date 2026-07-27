import { gql, useQuery } from '@apollo/client'
import { isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { FeeAmount, TICK_SPACINGS, TickMath } from '@uniswap/v3-sdk'
import { isTaikoChain } from 'config/chains/taiko'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { useEffect, useMemo, useState } from 'react'
import { PositionDetails } from 'types/position'

import { getPoolClientForChain } from './apollo'

const MAX_SUBGRAPH_BLOCK_LAG = 20
const MAX_SUBGRAPH_FUTURE_BLOCKS = 2
const MAX_SUBGRAPH_POSITIONS = 1_000
const SUBGRAPH_POLL_INTERVAL = 30_000
const SUBGRAPH_REQUEST_TIMEOUT = 10_000
const ZERO = BigNumber.from(0)
const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1)

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
  const tickSpacing = TICK_SPACINGS[fee as FeeAmount]
  const tokenId = BigNumber.from(position.id)
  const liquidity = BigNumber.from(position.liquidity)
  const token0 = position.token0.id.toLowerCase()
  const token1 = position.token1.id.toLowerCase()
  if (
    ![fee, tickLower, tickUpper].every(Number.isSafeInteger) ||
    tickSpacing === undefined ||
    tickLower < TickMath.MIN_TICK ||
    tickLower > TickMath.MAX_TICK ||
    tickUpper < TickMath.MIN_TICK ||
    tickUpper > TickMath.MAX_TICK ||
    tickLower >= tickUpper ||
    tickLower % tickSpacing !== 0 ||
    tickUpper % tickSpacing !== 0 ||
    tokenId.lt(ZERO) ||
    tokenId.gt(MaxUint256) ||
    liquidity.lt(ZERO) ||
    liquidity.gt(MAX_UINT128) ||
    !isAddress(token0) ||
    !isAddress(token1) ||
    token0 === AddressZero ||
    token1 === AddressZero ||
    token0 === token1
  ) {
    throw new Error('Invalid Taiko position value')
  }

  return {
    tokenId,
    fee,
    liquidity,
    tickLower,
    tickUpper,
    token0,
    token1,
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
  const requestKey = enabled && client ? `${chainId}:${account?.toLowerCase()}` : undefined
  const [timedOutRequest, setTimedOutRequest] = useState<string>()
  const { data, loading, error } = useQuery<TaikoPositionsData>(TAIKO_USER_POSITIONS_QUERY, {
    client,
    variables: { account: account?.toLowerCase() ?? '' },
    skip: !client || !account,
    fetchPolicy: 'cache-and-network',
    pollInterval: SUBGRAPH_POLL_INTERVAL,
  })

  useEffect(() => {
    setTimedOutRequest(undefined)
    if (!requestKey || !loading || data || error) return undefined

    const timeout = setTimeout(() => setTimedOutRequest(requestKey), SUBGRAPH_REQUEST_TIMEOUT)
    return () => clearTimeout(timeout)
  }, [data, error, loading, requestKey])

  return useMemo(() => {
    if (!enabled) return { loading: false, fallbackToRpc: false }
    if (!client || error) return { loading: false, fallbackToRpc: true }
    if (timedOutRequest === requestKey && loading && !data) return { loading: false, fallbackToRpc: true }
    if (loading && !data) return { loading: true, fallbackToRpc: false }

    const indexedBlock = data?._meta?.block?.number
    const blockLag = latestBlock !== undefined && indexedBlock !== undefined ? latestBlock - indexedBlock : undefined
    const isStale = blockLag !== undefined && blockLag > MAX_SUBGRAPH_BLOCK_LAG
    const isFromFuture = blockLag !== undefined && blockLag < -MAX_SUBGRAPH_FUTURE_BLOCKS
    if (
      !data ||
      !Number.isSafeInteger(indexedBlock) ||
      data._meta?.hasIndexingErrors ||
      isStale ||
      isFromFuture ||
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
  }, [client, data, enabled, error, latestBlock, loading, requestKey, timedOutRequest])
}
