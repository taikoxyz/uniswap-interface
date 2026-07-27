import { useWeb3React } from '@web3-react/core'
import { DATA_REFRESH_WINDOW_MS, TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { EventEmitter } from 'events'
import { mocked } from 'test-utils/mocked'
import { act, renderHook } from 'test-utils/render'

import useBlockNumber, {
  useFastForwardBlockNumber,
  useFastForwardedBlockNumber,
  useRefetchBlockNumber,
  useTimeGatedBlockNumber,
} from './useBlockNumber'

// Far above any real Taiko block number, so the ambient mainnet-block fetch through the real
// RPC provider (swallowed in tests, but potentially resolving on CI runners with open network)
// can never outrank the fake feed via the provider's monotonic-max logic.
const BLOCK = 3_000_000_000
const OTHER_CHAIN_BLOCK = 3_100_000_000

// Mimics an ethers provider: emits 'block' events and answers getBlockNumber().
class FakeProvider extends EventEmitter {
  constructor(private blockNumber: number) {
    super()
  }
  async getBlockNumber() {
    return this.blockNumber
  }
}

function mockChain(chainId: number, provider: FakeProvider) {
  mocked(useWeb3React).mockReturnValue({ chainId, provider } as unknown as ReturnType<typeof useWeb3React>)
}

describe('BlockNumberProvider', () => {
  // The test renderer's wrapper (test-utils/render) already mounts BlockNumberProvider.
  function renderBlockNumber() {
    return renderHook(() => ({
      block: useBlockNumber(),
      fastForwarded: useFastForwardedBlockNumber(),
      fastForward: useFastForwardBlockNumber(),
    }))
  }

  it('tracks the provider block feed', async () => {
    const provider = new FakeProvider(BLOCK)
    mockChain(TAIKO_MAINNET_CHAIN_ID, provider)
    const { result } = renderBlockNumber()
    await act(async () => undefined) // flush the initial getBlockNumber()
    expect(result.current.block).toEqual(BLOCK)

    act(() => {
      provider.emit('block', BLOCK + 1)
    })
    expect(result.current.block).toEqual(BLOCK + 1)
    // No receipt has been observed yet.
    expect(result.current.fastForwarded).toBeUndefined()
  })

  it('records a receipt-confirmed block even when it does not advance the raw feed', async () => {
    const provider = new FakeProvider(BLOCK)
    mockChain(TAIKO_MAINNET_CHAIN_ID, provider)
    const { result } = renderBlockNumber()
    await act(async () => undefined)

    // The block event for this height already arrived; a receipt in that same block must still
    // register, because it proves the user's own state changed in it.
    act(() => {
      result.current.fastForward(BLOCK)
    })
    expect(result.current.block).toEqual(BLOCK)
    expect(result.current.fastForwarded).toEqual(BLOCK)
  })

  it('advances the raw feed and the fast-forward record for a newer receipt block', async () => {
    const provider = new FakeProvider(BLOCK)
    mockChain(TAIKO_MAINNET_CHAIN_ID, provider)
    const { result } = renderBlockNumber()
    await act(async () => undefined)

    act(() => {
      result.current.fastForward(BLOCK + 3)
    })
    expect(result.current.block).toEqual(BLOCK + 3)
    expect(result.current.fastForwarded).toEqual(BLOCK + 3)

    // An older receipt must not move anything backwards.
    act(() => {
      result.current.fastForward(BLOCK + 2)
    })
    expect(result.current.block).toEqual(BLOCK + 3)
    expect(result.current.fastForwarded).toEqual(BLOCK + 3)
  })

  it('drops the fast-forward record when the chain changes', async () => {
    const provider = new FakeProvider(BLOCK)
    mockChain(TAIKO_MAINNET_CHAIN_ID, provider)
    const { result, rerender } = renderBlockNumber()
    await act(async () => undefined)
    act(() => {
      result.current.fastForward(BLOCK + 3)
    })
    expect(result.current.fastForwarded).toEqual(BLOCK + 3)

    const otherProvider = new FakeProvider(OTHER_CHAIN_BLOCK)
    mockChain(TAIKO_HOODI_CHAIN_ID, otherProvider)
    rerender()
    await act(async () => undefined)
    // A block from the old chain is meaningless on the new one.
    expect(result.current.fastForwarded).toBeUndefined()
    expect(result.current.block).toEqual(OTHER_CHAIN_BLOCK)
  })
})

describe('useTimeGatedBlockNumber', () => {
  const CHAIN_A = TAIKO_MAINNET_CHAIN_ID
  const CHAIN_B = TAIKO_HOODI_CHAIN_ID

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  function renderGated(initial: { chainId?: number; blockNumber?: number; snapTo?: number }) {
    return renderHook(
      ({ chainId, blockNumber, snapTo }: { chainId?: number; blockNumber?: number; snapTo?: number }) =>
        useTimeGatedBlockNumber(chainId ?? CHAIN_A, blockNumber, snapTo),
      { initialProps: initial }
    )
  }

  it('is undefined until a block number arrives, then adopts it', () => {
    const { result, rerender } = renderGated({ blockNumber: undefined })
    expect(result.current).toBeUndefined()
    rerender({ blockNumber: 100 })
    expect(result.current).toEqual(100)
  })

  it('holds new blocks within the refresh window and advances once it has elapsed', () => {
    const { result, rerender } = renderGated({ blockNumber: 100 })
    jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS - 1)
    rerender({ blockNumber: 101 })
    rerender({ blockNumber: 105 })
    expect(result.current).toEqual(100) // window not elapsed: hold
    jest.advanceTimersByTime(1)
    rerender({ blockNumber: 106 })
    expect(result.current).toEqual(106) // window elapsed: advance
    jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS - 1)
    rerender({ blockNumber: 118 })
    expect(result.current).toEqual(106) // the next window is measured from the adoption
  })

  it('advances on the first block after a stall longer than the window', () => {
    const { result, rerender } = renderGated({ blockNumber: 100 })
    // No new blocks for several windows (chain stall or provider hiccup): the first block to
    // arrive afterwards is adopted immediately rather than waiting out another window.
    jest.advanceTimersByTime(3 * DATA_REFRESH_WINDOW_MS)
    rerender({ blockNumber: 101 })
    expect(result.current).toEqual(101)
  })

  it('adopts a lower block number immediately and restarts the window (reorg)', () => {
    const { result, rerender } = renderGated({ blockNumber: 100 })
    jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS - 1)
    rerender({ blockNumber: 50 })
    expect(result.current).toEqual(50)
    // The reorg adoption restarted the clock: a higher block right after it still holds.
    jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS - 1)
    rerender({ blockNumber: 60 })
    expect(result.current).toEqual(50)
    jest.advanceTimersByTime(1)
    rerender({ blockNumber: 61 })
    expect(result.current).toEqual(61)
  })

  it('returns undefined while the new chain block is still unknown after a chain switch', () => {
    const { result, rerender } = renderGated({ chainId: CHAIN_A, blockNumber: 100 })
    expect(result.current).toEqual(100)
    // The chain switched but its first block has not arrived yet: the old
    // chain's number must not leak to the new chain's consumers.
    rerender({ chainId: CHAIN_B, blockNumber: undefined })
    expect(result.current).toBeUndefined()
  })

  it("adopts the new chain's first block even within the old chain's window", () => {
    const { result, rerender } = renderGated({ chainId: CHAIN_A, blockNumber: 100 })
    // Immediately after: on the same chain the window would hold, but on a new chain it is the
    // first observation and must be adopted.
    rerender({ chainId: CHAIN_B, blockNumber: 102 })
    expect(result.current).toEqual(102)
  })

  it('snaps forward to a receipt-confirmed block inside the window', () => {
    const { result, rerender } = renderGated({ blockNumber: 100 })
    jest.advanceTimersByTime(1_000)
    rerender({ blockNumber: 102 })
    expect(result.current).toEqual(100)
    // The user's transaction confirmed in block 102: refresh immediately.
    rerender({ blockNumber: 102, snapTo: 102 })
    expect(result.current).toEqual(102)
    // The next steady-state advance is measured from the snap.
    jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS - 1)
    rerender({ blockNumber: 107, snapTo: 102 })
    expect(result.current).toEqual(102)
    jest.advanceTimersByTime(1)
    rerender({ blockNumber: 108, snapTo: 102 })
    expect(result.current).toEqual(108)
  })

  it('snaps even when the receipt block is ahead of the raw feed', () => {
    // Receipts can reference blocks the polled feed has not seen yet.
    const { result, rerender } = renderGated({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 103 })
    expect(result.current).toEqual(103)
  })

  it('ignores snaps at or behind the gated block', () => {
    const { result, rerender } = renderGated({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 100 })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 100, snapTo: 99 })
    expect(result.current).toEqual(100)
  })

  it('does not resurrect a stale snap after moving to a lower block (reorg)', () => {
    const { result, rerender } = renderGated({ blockNumber: 100, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ blockNumber: 50, snapTo: undefined })
    expect(result.current).toEqual(50)
  })

  it('does not carry a snap across a chain switch', () => {
    const { result, rerender } = renderGated({ chainId: CHAIN_A, blockNumber: 100, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ chainId: CHAIN_B, blockNumber: undefined, snapTo: undefined })
    expect(result.current).toBeUndefined()
  })
})

describe('useRefetchBlockNumber', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  function renderFeeds() {
    return renderHook(() => ({
      block: useBlockNumber(),
      refetchBlock: useRefetchBlockNumber(),
      fastForward: useFastForwardBlockNumber(),
    }))
  }

  it('lags the raw feed by the refresh window and snaps to confirmed receipts', async () => {
    const provider = new FakeProvider(BLOCK)
    mockChain(TAIKO_MAINNET_CHAIN_ID, provider)
    const { result } = renderFeeds()
    await act(async () => undefined) // flush the initial getBlockNumber()
    expect(result.current.refetchBlock).toEqual(BLOCK)

    // Blocks arriving within the window move the raw feed but not the refetch feed.
    act(() => {
      provider.emit('block', BLOCK + 1)
      provider.emit('block', BLOCK + 2)
    })
    expect(result.current.block).toEqual(BLOCK + 2)
    expect(result.current.refetchBlock).toEqual(BLOCK)

    // A receipt for one of the user's own transactions cuts through the window.
    act(() => {
      result.current.fastForward(BLOCK + 2)
    })
    expect(result.current.refetchBlock).toEqual(BLOCK + 2)

    // Once the window (restarted by the snap) elapses, the next block is adopted.
    act(() => {
      jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS)
      provider.emit('block', BLOCK + 14)
    })
    expect(result.current.refetchBlock).toEqual(BLOCK + 14)
  })
})
