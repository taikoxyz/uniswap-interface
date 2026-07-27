import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
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
    it('returns true for a fresh transaction on every new block', () => {
      const now = Date.now()
      expect(shouldCheck(10, { addedTime: now, lastCheckedBlockNumber: 9, lastCheckedTime: now })).toEqual(true)
    })
    it('returns false when no new block has been produced since the last check', () => {
      // Regardless of how much wall time passed: without a new block there is nothing new to see.
      const tx = { addedTime: Date.now() - 61 * 60 * 1000, lastCheckedBlockNumber: 10, lastCheckedTime: 0 }
      expect(shouldCheck(10, tx)).toEqual(false)
      expect(shouldCheck(9, tx)).toEqual(false)
    })

    // The backoff for long-pending transactions is denominated purely in wall time since the
    // last check, so it is independent of the chain's block cadence (1s, 2s, or 0.5s blocks).
    describe('pending longer than 5 minutes', () => {
      const addedTime = () => Date.now() - 21 * 60 * 1000
      it('backs off until ~36s since the last check', () => {
        expect(
          shouldCheck(100, { addedTime: addedTime(), lastCheckedBlockNumber: 99, lastCheckedTime: Date.now() - 35_999 })
        ).toEqual(false)
        expect(
          shouldCheck(100, { addedTime: addedTime(), lastCheckedBlockNumber: 99, lastCheckedTime: Date.now() - 36_000 })
        ).toEqual(true)
      })
    })

    describe('pending longer than an hour', () => {
      const addedTime = () => Date.now() - 61 * 60 * 1000
      it('backs off until ~2m since the last check', () => {
        expect(
          shouldCheck(100, {
            addedTime: addedTime(),
            lastCheckedBlockNumber: 99,
            lastCheckedTime: Date.now() - 119_999,
          })
        ).toEqual(false)
        expect(
          shouldCheck(100, {
            addedTime: addedTime(),
            lastCheckedBlockNumber: 99,
            lastCheckedTime: Date.now() - 120_000,
          })
        ).toEqual(true)
      })
    })

    it('treats transactions persisted before lastCheckedTime existed as due', () => {
      // Old localStorage state has lastCheckedBlockNumber but no lastCheckedTime; the first
      // check after upgrade stamps it.
      expect(shouldCheck(100, { addedTime: Date.now() - 61 * 60 * 1000, lastCheckedBlockNumber: 50 })).toEqual(true)
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
