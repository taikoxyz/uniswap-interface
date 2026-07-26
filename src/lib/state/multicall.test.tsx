import { renderHook } from '@testing-library/react'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { EventEmitter } from 'events'
import { useFastForwardBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useState } from 'react'
import store from 'state'
import { mocked } from 'test-utils/mocked'
import { act, render } from 'test-utils/render'

import multicall, { MulticallUpdater, useQuantizedBlockNumber, useSettledBlockNumber } from './multicall'

jest.mock('hooks/useContract', () => {
  const useContract = jest.requireActual('hooks/useContract')
  const fakeMulticall = { address: '0x0000000000000000000000000000000000000001' }
  return {
    ...useContract,
    useInterfaceMulticall: () => fakeMulticall,
    useMainnetInterfaceMulticall: () => fakeMulticall,
  }
})

const STEP = 6
const CHAIN_A = TAIKO_MAINNET_CHAIN_ID
const CHAIN_B = TAIKO_HOODI_CHAIN_ID

function renderQuantized(initial: { chainId?: number; blockNumber?: number; step?: number; snapTo?: number }) {
  return renderHook(
    ({
      chainId,
      blockNumber,
      step,
      snapTo,
    }: {
      chainId?: number
      blockNumber?: number
      step?: number
      snapTo?: number
    }) => useQuantizedBlockNumber(chainId ?? CHAIN_A, blockNumber, step ?? STEP, snapTo),
    { initialProps: initial }
  )
}

function renderSettled(initial: { chainId?: number; blockNumber?: number; isFetching?: boolean }) {
  return renderHook(
    ({ chainId, blockNumber, isFetching }: { chainId?: number; blockNumber?: number; isFetching?: boolean }) =>
      useSettledBlockNumber(chainId ?? CHAIN_A, blockNumber, isFetching ?? false),
    { initialProps: initial }
  )
}

describe('useQuantizedBlockNumber', () => {
  it('is undefined until a block number arrives, then adopts it', () => {
    const { result, rerender } = renderQuantized({ blockNumber: undefined })
    expect(result.current).toBeUndefined()
    rerender({ blockNumber: 100 })
    expect(result.current).toEqual(100)
  })

  it('holds within a window and advances once a full step has passed', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 101 })
    rerender({ blockNumber: 105 })
    expect(result.current).toEqual(100) // < step ahead: hold
    rerender({ blockNumber: 106 })
    expect(result.current).toEqual(106) // step reached: advance
    rerender({ blockNumber: 111 })
    expect(result.current).toEqual(106) // next window starts from the adopted block
  })

  it('adopts a lower block number immediately (reorg)', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 50 })
    expect(result.current).toEqual(50)
  })

  it('returns undefined while the new chain block is still unknown after a chain switch', () => {
    const { result, rerender } = renderQuantized({ chainId: CHAIN_A, blockNumber: 100 })
    expect(result.current).toEqual(100)
    // The chain switched but its first block has not arrived yet: the old
    // chain's number must not leak to the new chain's updater.
    rerender({ chainId: CHAIN_B, blockNumber: undefined })
    expect(result.current).toBeUndefined()
  })

  it("adopts the new chain's first block even when it is within a step of the old value", () => {
    const { result, rerender } = renderQuantized({ chainId: CHAIN_A, blockNumber: 100 })
    // 102 is < one step ahead of 100 - on the same chain it would hold, but on
    // a new chain it is the first observation and must be adopted.
    rerender({ chainId: CHAIN_B, blockNumber: 102 })
    expect(result.current).toEqual(102)
  })

  it('snaps forward to a receipt-confirmed block inside the window', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 102 })
    expect(result.current).toEqual(100)
    // The user's transaction confirmed in block 102: refresh immediately.
    rerender({ blockNumber: 102, snapTo: 102 })
    expect(result.current).toEqual(102)
    // The next steady-state advance is measured from the snapped block.
    rerender({ blockNumber: 107, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ blockNumber: 108, snapTo: 102 })
    expect(result.current).toEqual(108)
  })

  it('snaps even when the receipt block is ahead of the raw feed', () => {
    // Receipts can reference blocks the polled feed has not seen yet.
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 103 })
    expect(result.current).toEqual(103)
  })

  it('ignores snaps at or behind the quantized block', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 100 })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 100, snapTo: 99 })
    expect(result.current).toEqual(100)
  })

  it('does not resurrect a stale snap after moving to a lower block (reorg)', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ blockNumber: 50, snapTo: undefined })
    expect(result.current).toEqual(50)
  })

  it('does not carry a snap across a chain switch', () => {
    const { result, rerender } = renderQuantized({ chainId: CHAIN_A, blockNumber: 100, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ chainId: CHAIN_B, blockNumber: undefined, snapTo: undefined })
    expect(result.current).toBeUndefined()
  })
})

describe('useSettledBlockNumber', () => {
  it('adopts desired blocks while idle', () => {
    const { result, rerender } = renderSettled({ blockNumber: undefined })
    expect(result.current).toBeUndefined()
    rerender({ blockNumber: 100 })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 106 })
    expect(result.current).toEqual(106)
  })

  it('holds while fetching and coalesces to the newest desired block', () => {
    const { result, rerender } = renderSettled({ blockNumber: 100 })
    rerender({ blockNumber: 106, isFetching: true })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 112, isFetching: true })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 112, isFetching: false })
    expect(result.current).toEqual(112)
  })

  it('does not carry a block across a chain switch', () => {
    const { result, rerender } = renderSettled({ chainId: CHAIN_A, blockNumber: 100 })
    expect(result.current).toEqual(100)
    rerender({ chainId: CHAIN_B, blockNumber: undefined })
    expect(result.current).toBeUndefined()
    rerender({ chainId: CHAIN_B, blockNumber: 102 })
    expect(result.current).toEqual(102)
  })

  it('queues a lower reorg block until the current fetch settles', () => {
    const { result, rerender } = renderSettled({ blockNumber: 100 })
    rerender({ blockNumber: 90, isFetching: true })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 90, isFetching: false })
    expect(result.current).toEqual(90)
  })
})

describe('MulticallUpdater', () => {
  // Mimics an ethers provider: emits 'block' events and answers getBlockNumber().
  class FakeProvider extends EventEmitter {
    constructor(private blockNumber: number) {
      super()
    }
    async getBlockNumber() {
      return this.blockNumber
    }
  }

  // Far above any real Taiko block number, so the ambient mainnet-block fetch
  // (swallowed in tests) can never outrank the fake feed.
  const BLOCK = 1_000_000_100
  const ACTIVE_CALL = {
    address: '0x0000000000000000000000000000000000000002',
    callData: '0x1234',
  }
  const MAINNET_CALL = {
    address: '0x0000000000000000000000000000000000000003',
    callData: '0x5678',
  }
  const ISOLATION_ACTIVE_CALL = {
    address: '0x0000000000000000000000000000000000000004',
    callData: '0x9abc',
  }
  const SWITCH_CALL = {
    address: '0x0000000000000000000000000000000000000005',
    callData: '0xdef0',
  }

  let fastForward: (block: number) => void
  function Probe() {
    fastForward = useFastForwardBlockNumber()
    return null
  }

  let updaterSpy: jest.SpyInstance
  beforeEach(() => {
    updaterSpy = jest.spyOn(multicall, 'Updater').mockImplementation(() => <></>)
  })
  afterEach(() => {
    act(() => {
      store.dispatch(
        multicall.actions.errorFetchingMulticallResults({
          chainId: TAIKO_MAINNET_CHAIN_ID,
          calls: [ACTIVE_CALL, ISOLATION_ACTIVE_CALL, SWITCH_CALL],
          fetchingBlockNumber: Number.MAX_SAFE_INTEGER,
        })
      )
      store.dispatch(
        multicall.actions.errorFetchingMulticallResults({
          chainId: ChainId.MAINNET,
          calls: [MAINNET_CALL],
          fetchingBlockNumber: Number.MAX_SAFE_INTEGER,
        })
      )
    })
    updaterSpy.mockRestore()
  })

  function markFetching(chainId: number, call: typeof ACTIVE_CALL, blockNumber: number) {
    store.dispatch(
      multicall.actions.fetchingMulticallResults({
        chainId,
        calls: [call],
        fetchingBlockNumber: blockNumber,
      })
    )
  }

  function settle(chainId: number, call: typeof ACTIVE_CALL, blockNumber: number) {
    store.dispatch(
      multicall.actions.updateMulticallResults({
        chainId,
        blockNumber,
        results: {
          [`${call.address}-${call.callData}`]: '0x01',
        },
      })
    )
  }

  /** The latest props passed to the inner multicall.Updater registered for chainId. */
  function latestUpdaterProps(chainId: number) {
    const call = [...updaterSpy.mock.calls].reverse().find(([props]) => props.chainId === chainId)
    return call?.[0]
  }

  function renderUpdater(chainId: number, provider: FakeProvider) {
    mocked(useWeb3React).mockReturnValue({ chainId, provider } as unknown as ReturnType<typeof useWeb3React>)
    return render(updaterTree())
  }

  function updaterTree() {
    return (
      <>
        <MulticallUpdater />
        <Probe />
      </>
    )
  }

  it('feeds Taiko mainnet updaters a quantized feed that snaps to confirmed receipts', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined) // flush the initial getBlockNumber()

    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    // 6 blocks per fetch: one data refresh window (~12s) at Taiko's 2s block time.
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.listenerOptions).toEqual({ blocksPerFetch: 6 })

    // Within the window, new blocks do not move the quantized feed.
    act(() => {
      provider.emit('block', BLOCK + 3)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)

    // A receipt for one of the user's transactions (in an already-seen block) snaps it forward.
    act(() => {
      fastForward(BLOCK + 2)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 2)

    // The next steady-state advance is measured from the snapped block.
    act(() => {
      provider.emit('block', BLOCK + 8)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 8)
  })

  it('keeps the dedicated mainnet feed on the Taiko mainnet cadence', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined)

    // The "mainnet" updater (registered under ChainId.MAINNET = 1 in this fork) is fed Taiko
    // mainnet blocks and fetch cadence.
    expect(latestUpdaterProps(1)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(1)?.listenerOptions).toEqual({ blocksPerFetch: 6 })
    act(() => {
      fastForward(BLOCK + 2)
    })
    expect(latestUpdaterProps(1)?.latestBlockNumber).toEqual(BLOCK + 2)
  })

  it('quantizes and snaps the active feed on Hoodi without touching the mainnet feed', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_HOODI_CHAIN_ID, provider)
    await act(async () => undefined)

    expect(latestUpdaterProps(TAIKO_HOODI_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(TAIKO_HOODI_CHAIN_ID)?.listenerOptions).toEqual({ blocksPerFetch: 6 })
    act(() => {
      fastForward(BLOCK + 2)
    })
    // Hoodi receipts snap the active feed, but are not forwarded to the mainnet feed.
    expect(latestUpdaterProps(TAIKO_HOODI_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 2)
  })

  it('holds an active updater block until its current request settles', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined)

    act(() => {
      markFetching(TAIKO_MAINNET_CHAIN_ID, ISOLATION_ACTIVE_CALL, BLOCK)
      provider.emit('block', BLOCK + STEP)
      provider.emit('block', BLOCK + 2 * STEP)
      provider.emit('block', BLOCK + 3 * STEP)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)

    act(() => {
      settle(TAIKO_MAINNET_CHAIN_ID, ISOLATION_ACTIVE_CALL, BLOCK)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 3 * STEP)
  })

  it('gates the active and dedicated mainnet updater independently', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined)

    act(() => {
      markFetching(TAIKO_MAINNET_CHAIN_ID, ACTIVE_CALL, BLOCK)
      provider.emit('block', BLOCK + STEP)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + STEP)

    act(() => {
      settle(TAIKO_MAINNET_CHAIN_ID, ACTIVE_CALL, BLOCK)
      markFetching(ChainId.MAINNET, MAINNET_CALL, BLOCK + STEP)
      provider.emit('block', BLOCK + 2 * STEP)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 2 * STEP)
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + STEP)

    act(() => {
      settle(ChainId.MAINNET, MAINNET_CALL, BLOCK + STEP)
    })
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + 2 * STEP)
  })

  it('remounts the active updater across a chain switch and releases the old chain on settlement', async () => {
    const mounted: number[] = []
    const unmounted: number[] = []
    updaterSpy.mockImplementation(({ chainId }) => {
      const [mountedChainId] = useState(chainId)
      useEffect(() => {
        if (mountedChainId !== undefined) mounted.push(mountedChainId)
        return () => {
          if (mountedChainId !== undefined) unmounted.push(mountedChainId)
        }
      }, [mountedChainId])
      return <></>
    })

    const providerA = new FakeProvider(BLOCK)
    const view = renderUpdater(CHAIN_A, providerA)
    await act(async () => undefined)
    act(() => {
      markFetching(CHAIN_A, SWITCH_CALL, BLOCK)
    })

    const providerB = new FakeProvider(BLOCK + STEP)
    mocked(useWeb3React).mockReturnValue({
      chainId: CHAIN_B,
      provider: providerB,
    } as unknown as ReturnType<typeof useWeb3React>)
    view.rerender(updaterTree())
    await act(async () => undefined)

    expect(mounted).toContain(CHAIN_B)
    expect(unmounted).toContain(CHAIN_A)

    mocked(useWeb3React).mockReturnValue({
      chainId: CHAIN_A,
      provider: providerA,
    } as unknown as ReturnType<typeof useWeb3React>)
    view.rerender(updaterTree())
    await act(async () => undefined)
    expect(latestUpdaterProps(CHAIN_A)?.latestBlockNumber).toBeUndefined()

    act(() => {
      settle(CHAIN_A, SWITCH_CALL, BLOCK)
    })
    expect(latestUpdaterProps(CHAIN_A)?.latestBlockNumber).toEqual(BLOCK)
  })
})
