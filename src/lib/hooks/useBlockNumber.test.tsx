import { useWeb3React } from '@web3-react/core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { RPC_PROVIDERS } from 'constants/providers'
import { EventEmitter } from 'events'
import { mocked } from 'test-utils/mocked'
import { act, renderHook } from 'test-utils/render'

import useBlockNumber, { useFastForwardBlockNumber, useFastForwardedBlockNumber } from './useBlockNumber'

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

// A wallet provider that records every use: the block feed must come from the interface's own
// RPC provider, so any call against the wallet is a regression (asserted in afterEach).
class ForbiddenWalletProvider {
  readonly calls: string[] = []
  getBlockNumber() {
    this.calls.push('getBlockNumber')
    return Promise.reject(new Error('wallet RPC must not serve reads'))
  }
  on(event: string) {
    this.calls.push(`on:${event}`)
  }
  removeListener(event: string) {
    this.calls.push(`removeListener:${event}`)
  }
}

const walletProviders: ForbiddenWalletProvider[] = []
afterEach(() => {
  const calls = walletProviders.flatMap((wallet) => wallet.calls)
  walletProviders.length = 0
  if (calls.length) {
    throw new Error(`wallet provider was used for reads: ${calls.join(', ')}`)
  }
})

function mockChain(chainId: number, provider: FakeProvider) {
  // The wallet's provider is deliberately distinct from the fake feed: reads must flow through
  // the interface's own RPC provider (installed below), never the wallet's. Each jest test file
  // gets its own module registry, so the RPC_PROVIDERS mutation cannot leak into other files.
  const walletProvider = new ForbiddenWalletProvider()
  walletProviders.push(walletProvider)
  mocked(useWeb3React).mockReturnValue({
    chainId,
    provider: walletProvider,
  } as unknown as ReturnType<typeof useWeb3React>)
  ;(RPC_PROVIDERS as Record<number, unknown>)[chainId] = provider
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
