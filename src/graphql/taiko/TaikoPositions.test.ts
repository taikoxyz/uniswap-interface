import { useQuery } from '@apollo/client'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { getPoolClientForChain } from 'graphql/taiko/apollo'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { renderHook } from 'test-utils/render'

import { useTaikoV3Positions } from './TaikoPositions'

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: jest.fn(),
}))
jest.mock('graphql/taiko/apollo')
jest.mock('lib/hooks/useBlockNumber', () => ({
  ...jest.requireActual('lib/hooks/useBlockNumber'),
  __esModule: true,
  default: jest.fn(),
}))

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const CLIENT = {} as ReturnType<typeof getPoolClientForChain>
const POSITION = {
  id: '42',
  liquidity: '123456',
  feeTier: '3000',
  tickLower: '-120',
  tickUpper: '120',
  token0: { id: '0x2222222222222222222222222222222222222222' },
  token1: { id: '0x3333333333333333333333333333333333333333' },
}
const DATA = {
  _meta: { block: { number: 1_000 }, hasIndexingErrors: false },
  positions: [POSITION],
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getPoolClientForChain as jest.MockedFunction<typeof getPoolClientForChain>).mockReturnValue(CLIENT)
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(1_010)
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    data: DATA,
    loading: false,
  } as ReturnType<typeof useQuery>)
})

it.each([TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID])('queries and maps positions for chain %s', (chainId) => {
  const { result } = renderHook(() => useTaikoV3Positions(chainId, ACCOUNT))

  expect(getPoolClientForChain).toHaveBeenCalledWith(chainId)
  expect(useQuery).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      client: CLIENT,
      pollInterval: 30_000,
      skip: false,
      variables: { account: ACCOUNT },
    })
  )
  expect(result.current.fallbackToRpc).toBe(false)
  expect(result.current.positions?.[0]).toMatchObject({
    tokenId: expect.objectContaining({ _hex: '0x2a' }),
    fee: 3000,
    liquidity: expect.objectContaining({ _hex: '0x01e240' }),
    tickLower: -120,
    tickUpper: 120,
    token0: POSITION.token0.id,
    token1: POSITION.token1.id,
  })
})

it.each([
  ['indexing errors', { ...DATA, _meta: { ...DATA._meta, hasIndexingErrors: true } }, 1_010],
  ['stale data', DATA, 1_021],
  ['missing metadata', { positions: [POSITION] }, 1_010],
  ['result limit', { ...DATA, positions: Array(1_000).fill(POSITION) }, 1_010],
  ['malformed values', { ...DATA, positions: [{ ...POSITION, feeTier: 'bad' }] }, 1_010],
  ['invalid token address', { ...DATA, positions: [{ ...POSITION, token0: { id: 'bad' } }] }, 1_010],
  ['missing positions array', { ...DATA, positions: undefined }, 1_010],
])('falls back for %s', (_name, data, block) => {
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(block)
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    data,
    loading: false,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(true)
  expect(result.current.positions).toBeUndefined()
})

it('falls back when the query fails', () => {
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    error: new Error('query failed'),
    loading: false,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(true)
})

it('recovers from stale data after a polled result refreshes', () => {
  const refreshedPosition = { ...POSITION, liquidity: '654321' }
  let queryResult = {
    data: DATA,
    loading: false,
  } as ReturnType<typeof useQuery>
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(1_021)
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockImplementation(() => queryResult)

  const { result, rerender } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(true)

  queryResult = {
    data: {
      _meta: { block: { number: 1_020 }, hasIndexingErrors: false },
      positions: [refreshedPosition],
    },
    loading: false,
  } as ReturnType<typeof useQuery>
  rerender()

  expect(result.current.fallbackToRpc).toBe(false)
  expect(result.current.positions?.[0].liquidity.toString()).toBe(refreshedPosition.liquidity)
})
