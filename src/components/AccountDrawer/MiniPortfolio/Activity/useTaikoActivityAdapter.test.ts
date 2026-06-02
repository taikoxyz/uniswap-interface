import { renderHook } from 'test-utils/render'

import { useTaikoActivityAdapter } from './useTaikoActivityAdapter'

const TAIKO_MAINNET_CHAIN_ID = 167000

jest.mock('@web3-react/core', () => ({
  useWeb3React: () => ({ chainId: TAIKO_MAINNET_CHAIN_ID }),
}))

const mockUseTaikoActivity = jest.fn()
jest.mock('graphql/taiko/TaikoActivity', () => ({
  useTaikoActivity: (...args: unknown[]) => mockUseTaikoActivity(...args),
}))

const WETH = { id: '0xA51894664A773981C6C112C43ce576f315d5b1B6', symbol: 'WETH', name: 'Wrapped Ether', decimals: '18' }
const TAIKO = { id: '0xA9d23408b9bA935c230493c40C73824Df71A0975', symbol: 'TAIKO', name: 'Taiko Token', decimals: '18' }

function mockSwap(amount0: string, amount1: string) {
  return {
    swaps: [
      {
        id: 'swap-1',
        timestamp: '1000',
        sender: '0xabc',
        origin: '0xabc',
        amount0,
        amount1,
        amountUSD: '100',
        pool: { id: '0xpool', token0: WETH, token1: TAIKO },
        transaction: { id: '0xhash', blockNumber: '1', timestamp: '1000' },
      },
    ],
    mints: [],
    burns: [],
    collects: [],
  }
}

describe('useTaikoActivityAdapter swap direction', () => {
  beforeEach(() => mockUseTaikoActivity.mockReset())

  // Pool is token0=WETH, token1=TAIKO. A TAIKO->WETH trade has amount1 (TAIKO) > 0 (sold in)
  // and amount0 (WETH) < 0 (bought out). It must read "Swap TAIKO for WETH", not "WETH for TAIKO".
  it('labels a TAIKO->WETH swap in the user trade direction', () => {
    mockUseTaikoActivity.mockReturnValue({ activities: mockSwap('-0.1', '2051.75'), loading: false, refetch: jest.fn() })
    const { result } = renderHook(() => useTaikoActivityAdapter('0xabc'))
    const activity = result.current.activities?.[0]
    expect(activity?.title).toBe('Swap TAIKO for WETH')
    expect(activity?.descriptor).toBe('2051.75 TAIKO → 0.1 WETH')
    expect(activity?.currencies?.[0]?.symbol).toBe('TAIKO')
    expect(activity?.currencies?.[1]?.symbol).toBe('WETH')
  })

  // The opposite direction (WETH->TAIKO): amount0 (WETH) > 0 sold in, amount1 (TAIKO) < 0 bought out.
  it('labels a WETH->TAIKO swap in the user trade direction', () => {
    mockUseTaikoActivity.mockReturnValue({ activities: mockSwap('0.1', '-2051.75'), loading: false, refetch: jest.fn() })
    const { result } = renderHook(() => useTaikoActivityAdapter('0xabc'))
    const activity = result.current.activities?.[0]
    expect(activity?.title).toBe('Swap WETH for TAIKO')
    expect(activity?.descriptor).toBe('0.1 WETH → 2051.75 TAIKO')
    expect(activity?.currencies?.[0]?.symbol).toBe('WETH')
    expect(activity?.currencies?.[1]?.symbol).toBe('TAIKO')
  })
})
