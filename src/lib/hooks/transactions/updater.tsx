import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import {
  DEFAULT_AVERAGE_BLOCK_TIME_MS,
  getAverageBlockTimeMs,
  TAIKO_HOODI_CHAIN_ID,
  TAIKO_MAINNET_CHAIN_ID,
} from 'config/chains'
import { getAppRpcProvider } from 'constants/providers'
import useCurrentBlockTimestamp from 'hooks/useCurrentBlockTimestamp'
import useBlockNumber, { useFastForwardBlockNumber } from 'lib/hooks/useBlockNumber'
import ms from 'ms'
import { useCallback, useEffect } from 'react'
import { useTransactionRemover } from 'state/transactions/hooks'
import { TransactionDetails } from 'state/transactions/types'

import { CanceledError, retry, RetryableError, RetryOptions } from './retry'

interface Transaction {
  addedTime: number
  receipt?: unknown
  lastCheckedBlockNumber?: number
}

export function shouldCheck(
  lastBlockNumber: number,
  tx: Transaction,
  averageBlockTimeMs = DEFAULT_AVERAGE_BLOCK_TIME_MS
): boolean {
  if (tx.receipt) return false
  if (!tx.lastCheckedBlockNumber) return true
  const blocksSinceCheck = lastBlockNumber - tx.lastCheckedBlockNumber
  if (blocksSinceCheck < 1) return false
  // Back off in wall time, not block counts: on a 2s (or 0.5s) chain a fixed block count would
  // shrink to a couple of seconds and long-pending transactions would be re-checked on nearly
  // every block event, forever.
  const msSinceCheck = blocksSinceCheck * averageBlockTimeMs
  const minutesPending = (new Date().getTime() - tx.addedTime) / ms(`1m`)
  if (minutesPending > 60) {
    // at most every ~2m (10 L1 blocks) if pending longer than an hour
    return msSinceCheck >= ms(`2m`)
  } else if (minutesPending > 5) {
    // at most every ~36s (3 L1 blocks) if pending longer than 5 minutes
    return msSinceCheck >= ms(`36s`)
  } else {
    // otherwise on every new block
    return true
  }
}

// Taiko confirms within ~one 2s block, but new-block events only reach the app on provider polls
// (up to 12s apart). Polling the receipt directly, like the other 2s-block chains here, lets the
// confirmation UX track the chain instead of the poll cadence.
const FAST_L2_RETRY_OPTIONS: RetryOptions = { n: 10, minWait: 250, maxWait: 1000 }
const RETRY_OPTIONS_BY_CHAIN_ID: { [chainId: number]: RetryOptions } = {
  [ChainId.ARBITRUM_ONE]: FAST_L2_RETRY_OPTIONS,
  [ChainId.ARBITRUM_GOERLI]: FAST_L2_RETRY_OPTIONS,
  [ChainId.OPTIMISM]: FAST_L2_RETRY_OPTIONS,
  [ChainId.OPTIMISM_GOERLI]: FAST_L2_RETRY_OPTIONS,
  [TAIKO_MAINNET_CHAIN_ID]: FAST_L2_RETRY_OPTIONS,
  [TAIKO_HOODI_CHAIN_ID]: FAST_L2_RETRY_OPTIONS,
}
const DEFAULT_RETRY_OPTIONS: RetryOptions = { n: 1, minWait: 0, maxWait: 0 }

interface UpdaterProps {
  pendingTransactions: { [hash: string]: TransactionDetails }
  onCheck: (tx: { chainId: number; hash: string; blockNumber: number }) => void
  onReceipt: (tx: { chainId: number; hash: string; receipt: TransactionReceipt }) => void
}

export default function Updater({ pendingTransactions, onCheck, onReceipt }: UpdaterProps): null {
  const { account, chainId, provider: walletProvider } = useWeb3React()
  // Receipts are data reads: poll them through the interface's own RPC when it has a provider
  // for the chain, so confirmation tracking never depends on the wallet's endpoint.
  const provider = getAppRpcProvider(chainId) ?? walletProvider

  const lastBlockNumber = useBlockNumber()
  const fastForwardBlockNumber = useFastForwardBlockNumber()
  const removeTransaction = useTransactionRemover()
  const blockTimestamp = useCurrentBlockTimestamp()

  const getReceipt = useCallback(
    (hash: string) => {
      if (!provider || !chainId) throw new Error('No provider or chainId')
      const retryOptions = RETRY_OPTIONS_BY_CHAIN_ID[chainId] ?? DEFAULT_RETRY_OPTIONS
      return retry(
        () =>
          provider.getTransactionReceipt(hash).then(async (receipt) => {
            if (receipt === null) {
              if (account) {
                const tx = pendingTransactions[hash]
                // Remove transactions past their deadline or - if there is no deadline - older than 6 hours.
                if (tx.deadline) {
                  // Deadlines are expressed as seconds since epoch, as they are used on-chain.
                  if (blockTimestamp && tx.deadline < blockTimestamp.toNumber()) {
                    removeTransaction(hash)
                  }
                } else if (tx.addedTime + ms(`6h`) < Date.now()) {
                  removeTransaction(hash)
                }
              }
              throw new RetryableError()
            }
            return receipt
          }),
        retryOptions
      )
    },
    [account, blockTimestamp, chainId, pendingTransactions, provider, removeTransaction]
  )

  useEffect(() => {
    if (!chainId || !provider || !lastBlockNumber) return

    const cancels = Object.keys(pendingTransactions)
      .filter((hash) => shouldCheck(lastBlockNumber, pendingTransactions[hash], getAverageBlockTimeMs(chainId)))
      .map((hash) => {
        const { promise, cancel } = getReceipt(hash)
        promise
          .then((receipt) => {
            fastForwardBlockNumber(receipt.blockNumber)
            onReceipt({ chainId, hash, receipt })
          })
          .catch((error) => {
            if (error instanceof CanceledError) return
            onCheck({ chainId, hash, blockNumber: lastBlockNumber })
          })
        return cancel
      })

    return () => {
      cancels.forEach((cancel) => cancel())
    }
  }, [chainId, provider, lastBlockNumber, getReceipt, onReceipt, onCheck, pendingTransactions, fastForwardBlockNumber])

  return null
}
