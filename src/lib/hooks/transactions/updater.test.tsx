import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { RPC_PROVIDERS } from 'constants/providers'
import { EventEmitter } from 'events'
import { useCallback, useState } from 'react'
import { TransactionDetails } from 'state/transactions/types'
import { mocked } from 'test-utils/mocked'
import { act, render } from 'test-utils/render'

import Updater, { shouldCheck } from './updater'

describe('transactions updater', () => {
  describe('shouldCheck', () => {
    it('returns true if no receipt and never checked', () => {
      expect(shouldCheck(10, { addedTime: 100 })).toEqual(true)
    })
    it('returns false if has receipt and never checked', () => {
      expect(shouldCheck(10, { addedTime: 100, receipt: {} })).toEqual(false)
    })
    it('returns true if has not been checked in 1 blocks', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime(), lastCheckedBlockNumber: 9 })).toEqual(true)
    })
    it('returns false if checked in last 3 blocks and greater than 20 minutes old', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 8 })).toEqual(
        false
      )
    })
    it('returns true if not checked in last 5 blocks and greater than 20 minutes old', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 5 })).toEqual(
        true
      )
    })
    it('returns false if checked in last 10 blocks and greater than 60 minutes old', () => {
      expect(shouldCheck(20, { addedTime: new Date().getTime() - 61 * 60 * 1000, lastCheckedBlockNumber: 11 })).toEqual(
        false
      )
    })
    it('returns true if checked in last 3 blocks and greater than 60 minutes old', () => {
      expect(shouldCheck(20, { addedTime: new Date().getTime() - 61 * 60 * 1000, lastCheckedBlockNumber: 10 })).toEqual(
        true
      )
    })

    describe('with a 2s block time (Taiko today)', () => {
      const BLOCK_TIME = 2_000
      it('checks fresh transactions on every new block', () => {
        expect(shouldCheck(100, { addedTime: new Date().getTime(), lastCheckedBlockNumber: 99 }, BLOCK_TIME)).toEqual(
          true
        )
      })
      it('backs off to ~36s when pending longer than 5 minutes', () => {
        const addedTime = new Date().getTime() - 21 * 60 * 1000
        // 17 blocks * 2s = 34s: too soon. 18 blocks * 2s = 36s: due.
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 83 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 82 }, BLOCK_TIME)).toEqual(true)
      })
      it('backs off to ~2m when pending longer than an hour', () => {
        const addedTime = new Date().getTime() - 61 * 60 * 1000
        // 59 blocks * 2s = 118s: too soon. 60 blocks * 2s = 120s: due.
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 41 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 40 }, BLOCK_TIME)).toEqual(true)
      })
    })

    describe('with a 0.5s block time (Taiko roadmap)', () => {
      const BLOCK_TIME = 500
      it('backs off to ~36s when pending longer than 5 minutes', () => {
        const addedTime = new Date().getTime() - 21 * 60 * 1000
        // 71 blocks * 0.5s = 35.5s: too soon. 72 blocks * 0.5s = 36s: due.
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 929 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 928 }, BLOCK_TIME)).toEqual(true)
      })
      it('backs off to ~2m when pending longer than an hour', () => {
        const addedTime = new Date().getTime() - 61 * 60 * 1000
        // 239 blocks * 0.5s = 119.5s: too soon. 240 blocks * 0.5s = 120s: due.
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 761 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 760 }, BLOCK_TIME)).toEqual(true)
      })
    })
  })
})

describe('Updater receipt polling', () => {
  // Far above any real Taiko block number, so the ambient mainnet-block fetch through the real
  // RPC provider can never interfere with the fake feed.
  const BLOCK = 4_000_000_000
  const HASH = '0x0000000000000000000000000000000000000000000000000000000000000001'

  // Mimics an ethers provider: emits 'block' events and answers getBlockNumber(), with a
  // controllable getTransactionReceipt. _isProvider satisfies ethers' Provider.isProvider so
  // unrelated contract hooks in the tree accept it.
  class FakeProvider extends EventEmitter {
    readonly _isProvider = true
    getTransactionReceipt = jest.fn<Promise<TransactionReceipt | null>, [string]>()
    async getBlockNumber() {
      return BLOCK
    }
  }

  // Feeds Updater a pending map and, like the transactions reducer, marks the transaction
  // finalized when its receipt arrives so it is not re-checked.
  function Harness({
    onCheck,
    onReceipt,
  }: {
    onCheck: (check: unknown) => void
    onReceipt: (receipt: { hash: string }) => void
  }) {
    const [pending, setPending] = useState<{ [hash: string]: TransactionDetails }>({
      [HASH]: { addedTime: Date.now(), hash: HASH } as TransactionDetails,
    })
    const handleReceipt = useCallback(
      (tx: { hash: string; receipt: TransactionReceipt }) => {
        onReceipt(tx)
        setPending((pending) => ({ ...pending, [tx.hash]: { ...pending[tx.hash], receipt: tx.receipt } }))
      },
      [onReceipt]
    )
    return <Updater pendingTransactions={pending} onCheck={onCheck} onReceipt={handleReceipt} />
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  async function advance(rounds: number) {
    for (let i = 0; i < rounds; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1_000) // covers the 250-1000ms retry waits
      })
    }
  }

  it('polls the receipt on Taiko without waiting for another block event', async () => {
    const provider = new FakeProvider()
    const receipt = { blockNumber: BLOCK + 1, status: 1, transactionHash: HASH } as unknown as TransactionReceipt
    // The transaction confirms on-chain after two polls - long before the next block event,
    // which never arrives in this test.
    provider.getTransactionReceipt.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(receipt)
    mocked(useWeb3React).mockReturnValue({
      chainId: TAIKO_MAINNET_CHAIN_ID,
      provider,
    } as unknown as ReturnType<typeof useWeb3React>)
    // The block feed and receipt polling read through the interface's own RPC providers rather
    // than the wallet's, so the fake must be installed there too (per-file module registry).
    ;(RPC_PROVIDERS as Record<number, unknown>)[TAIKO_MAINNET_CHAIN_ID] = provider

    const onCheck = jest.fn()
    const onReceipt = jest.fn()
    render(<Harness onCheck={onCheck} onReceipt={onReceipt} />)
    await act(async () => undefined) // flush the initial getBlockNumber()

    await advance(5)
    // Taiko's fast retry options re-polled the receipt without a single new block event.
    expect(provider.getTransactionReceipt.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(onReceipt).toHaveBeenCalledTimes(1)
    expect(onReceipt).toHaveBeenCalledWith({ chainId: TAIKO_MAINNET_CHAIN_ID, hash: HASH, receipt })
    expect(onCheck).not.toHaveBeenCalled()
  })

  it('gives up until the next block event on chains without fast retry options', async () => {
    const provider = new FakeProvider()
    provider.getTransactionReceipt.mockResolvedValue(null)
    mocked(useWeb3React).mockReturnValue({
      chainId: ChainId.MAINNET,
      provider,
    } as unknown as ReturnType<typeof useWeb3React>)

    const onCheck = jest.fn()
    const onReceipt = jest.fn()
    render(<Harness onCheck={onCheck} onReceipt={onReceipt} />)
    await act(async () => undefined)

    await advance(5)
    // Default options: one attempt plus one immediate retry, then wait for the next block.
    expect(provider.getTransactionReceipt).toHaveBeenCalledTimes(2)
    expect(onReceipt).not.toHaveBeenCalled()
    expect(onCheck).toHaveBeenCalledWith({ chainId: ChainId.MAINNET, hash: HASH, blockNumber: BLOCK })
  })
})
