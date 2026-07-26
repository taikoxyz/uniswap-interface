import { useQuery } from '@apollo/client'
import { ChainId } from '@uniswap/sdk-core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { getPoolClientForChain } from 'graphql/taiko/apollo'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { act, renderHook } from 'test-utils/render'

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

const ACCOUNT = '0xA111111111111111111111111111111111111111'
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

afterEach(() => {
  jest.useRealTimers()
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
      variables: { account: ACCOUNT.toLowerCase() },
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
  ['an unsupported chain', ChainId.MAINNET, ACCOUNT],
  ['a disconnected wallet', TAIKO_MAINNET_CHAIN_ID, undefined],
])('skips the query for %s', (_name, chainId, account) => {
  const { result } = renderHook(() => useTaikoV3Positions(chainId, account))

  expect(getPoolClientForChain).not.toHaveBeenCalled()
  expect(useQuery).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      client: undefined,
      skip: true,
    })
  )
  expect(result.current).toEqual({ loading: false, fallbackToRpc: false })
})

it('falls back when the configured pool client is unavailable', () => {
  ;(getPoolClientForChain as jest.MockedFunction<typeof getPoolClientForChain>).mockReturnValue(undefined)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current).toEqual({ loading: false, fallbackToRpc: true })
})

it('reports loading while the first query is in flight', () => {
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    loading: true,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current).toEqual({ loading: true, fallbackToRpc: false })
})

it('falls back when the first query exceeds its deadline', () => {
  jest.useFakeTimers()
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    loading: true,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  act(() => {
    jest.advanceTimersByTime(10_000)
  })

  expect(result.current).toEqual({ loading: false, fallbackToRpc: true })
})

it('falls back when a completed query returns no data', () => {
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    loading: false,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current).toEqual({ loading: false, fallbackToRpc: true })
})

it('uses healthy data while the active block feed initializes', () => {
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(undefined)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(false)
  expect(result.current.positions).toHaveLength(1)
})

it.each([
  ['indexing errors', { ...DATA, _meta: { ...DATA._meta, hasIndexingErrors: true } }, 1_010],
  ['stale data', DATA, 1_021],
  ['future data', { ...DATA, _meta: { ...DATA._meta, block: { number: 1_013 } } }, 1_010],
  ['missing metadata', { positions: [POSITION] }, 1_010],
  ['result limit', { ...DATA, positions: Array(1_000).fill(POSITION) }, 1_010],
  ['malformed values', { ...DATA, positions: [{ ...POSITION, feeTier: 'bad' }] }, 1_010],
  ['negative fee', { ...DATA, positions: [{ ...POSITION, feeTier: '-1' }] }, 1_010],
  ['unsupported fee', { ...DATA, positions: [{ ...POSITION, feeTier: '200' }] }, 1_010],
  ['reversed ticks', { ...DATA, positions: [{ ...POSITION, tickLower: '120', tickUpper: '-120' }] }, 1_010],
  ['out-of-range ticks', { ...DATA, positions: [{ ...POSITION, tickLower: '-887273' }] }, 1_010],
  ['misaligned ticks', { ...DATA, positions: [{ ...POSITION, tickLower: '-121' }] }, 1_010],
  ['malformed token ID', { ...DATA, positions: [{ ...POSITION, id: 'bad' }] }, 1_010],
  ['negative token ID', { ...DATA, positions: [{ ...POSITION, id: '-1' }] }, 1_010],
  ['malformed liquidity', { ...DATA, positions: [{ ...POSITION, liquidity: 'bad' }] }, 1_010],
  ['negative liquidity', { ...DATA, positions: [{ ...POSITION, liquidity: '-1' }] }, 1_010],
  [
    'oversized liquidity',
    { ...DATA, positions: [{ ...POSITION, liquidity: '340282366920938463463374607431768211456' }] },
    1_010,
  ],
  ['invalid token address', { ...DATA, positions: [{ ...POSITION, token0: { id: 'bad' } }] }, 1_010],
  [
    'zero token address',
    { ...DATA, positions: [{ ...POSITION, token0: { id: '0x0000000000000000000000000000000000000000' } }] },
    1_010,
  ],
  ['identical token addresses', { ...DATA, positions: [{ ...POSITION, token1: POSITION.token0 }] }, 1_010],
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
