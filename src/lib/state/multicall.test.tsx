import { renderHook } from '@testing-library/react'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { DATA_REFRESH_WINDOW_MS, TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { EventEmitter } from 'events'
import { useFastForwardBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useState } from 'react'
import store from 'state'
import { mocked } from 'test-utils/mocked'
import { act, render } from 'test-utils/render'

import multicall, { MulticallUpdater, useSettledBlockNumber } from './multicall'

jest.mock('hooks/useContract', () => {
  const useContract = jest.requireActual('hooks/useContract')
  const fakeMulticall = { address: '0x0000000000000000000000000000000000000001' }
  return {
    ...useContract,
    useInterfaceMulticall: () => fakeMulticall,
    useMainnetInterfaceMulticall: () => fakeMulticall,
  }
})

const CHAIN_A = TAIKO_MAINNET_CHAIN_ID
const CHAIN_B = TAIKO_HOODI_CHAIN_ID

function renderSettled(initial: { chainId?: number; blockNumber?: number; isFetching?: boolean }) {
  return renderHook(
    ({ chainId, blockNumber, isFetching }: { chainId?: number; blockNumber?: number; isFetching?: boolean }) =>
      useSettledBlockNumber(chainId ?? CHAIN_A, blockNumber, isFetching ?? false),
    { initialProps: initial }
  )
}

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
    jest.useFakeTimers()
    updaterSpy = jest.spyOn(multicall, 'Updater').mockImplementation(() => <></>)
  })
  afterEach(() => {
    // Unlock any synthetic fetch left in Redux by a failing assertion.
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
    jest.useRealTimers()
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

  /** Elapses a full data refresh window and delivers the next block event. */
  function elapseWindowTo(provider: FakeProvider, block: number) {
    act(() => {
      jest.advanceTimersByTime(DATA_REFRESH_WINDOW_MS)
      provider.emit('block', block)
    })
  }

  it('feeds Taiko mainnet updaters a wall-clock-gated feed that snaps to confirmed receipts', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined) // flush the initial getBlockNumber()

    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    // Cadence is owned by the wall-clock gate, so every advance of the feed means "refetch now".
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.listenerOptions).toEqual({ blocksPerFetch: 1 })

    // Within the refresh window, new blocks do not move the gated feed - no matter how many the
    // chain produces.
    act(() => {
      provider.emit('block', BLOCK + 3)
      provider.emit('block', BLOCK + 6)
      provider.emit('block', BLOCK + 9)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)

    // A receipt for one of the user's transactions (in an already-seen block) snaps it forward.
    act(() => {
      fastForward(BLOCK + 2)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 2)

    // The next steady-state advance happens once a full window has elapsed since the snap.
    act(() => {
      provider.emit('block', BLOCK + 10)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 2)
    elapseWindowTo(provider, BLOCK + 12)
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 12)
  })

  it('keeps the dedicated mainnet feed on the Taiko mainnet cadence', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined)

    // The "mainnet" updater (registered under ChainId.MAINNET = 1 in this fork) is fed Taiko
    // mainnet blocks and fetch cadence.
    expect(latestUpdaterProps(1)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(1)?.listenerOptions).toEqual({ blocksPerFetch: 1 })
    act(() => {
      fastForward(BLOCK + 2)
    })
    expect(latestUpdaterProps(1)?.latestBlockNumber).toEqual(BLOCK + 2)
  })

  it('gates and snaps the active feed on Hoodi without touching the mainnet feed', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_HOODI_CHAIN_ID, provider)
    await act(async () => undefined)

    expect(latestUpdaterProps(TAIKO_HOODI_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(TAIKO_HOODI_CHAIN_ID)?.listenerOptions).toEqual({ blocksPerFetch: 1 })
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
    })
    // Windows keep elapsing while the fetch is in flight: the gated feed advances, but the
    // settled feed passed to the updater must not, or the fetch would be cancelled.
    elapseWindowTo(provider, BLOCK + 12)
    elapseWindowTo(provider, BLOCK + 24)
    elapseWindowTo(provider, BLOCK + 36)
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)

    act(() => {
      settle(TAIKO_MAINNET_CHAIN_ID, ISOLATION_ACTIVE_CALL, BLOCK)
    })
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 36)
  })

  it('gates the active and dedicated mainnet updater independently', async () => {
    const provider = new FakeProvider(BLOCK)
    renderUpdater(TAIKO_MAINNET_CHAIN_ID, provider)
    await act(async () => undefined)

    act(() => {
      markFetching(TAIKO_MAINNET_CHAIN_ID, ACTIVE_CALL, BLOCK)
    })
    elapseWindowTo(provider, BLOCK + 12)
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK)
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + 12)

    act(() => {
      settle(TAIKO_MAINNET_CHAIN_ID, ACTIVE_CALL, BLOCK)
      markFetching(ChainId.MAINNET, MAINNET_CALL, BLOCK + 12)
    })
    elapseWindowTo(provider, BLOCK + 24)
    expect(latestUpdaterProps(TAIKO_MAINNET_CHAIN_ID)?.latestBlockNumber).toEqual(BLOCK + 24)
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + 12)

    act(() => {
      settle(ChainId.MAINNET, MAINNET_CALL, BLOCK + 12)
    })
    expect(latestUpdaterProps(ChainId.MAINNET)?.latestBlockNumber).toEqual(BLOCK + 24)
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

    const providerB = new FakeProvider(BLOCK + 6)
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
