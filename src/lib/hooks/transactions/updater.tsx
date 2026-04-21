import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { AVERAGE_L1_BLOCK_TIME, getAverageBlockTime } from 'constants/chainInfo'
import useCurrentBlockTimestamp from 'hooks/useCurrentBlockTimestamp'
import useBlockNumber, { useFastForwardBlockNumber } from 'lib/hooks/useBlockNumber'
import ms from 'ms'
import { useCallback, useEffect, useRef } from 'react'
import { useTransactionRemover } from 'state/transactions/hooks'
import { TransactionDetails } from 'state/transactions/types'

import { CanceledError, retry, RetryableError, RetryOptions } from './retry'

interface Transaction {
  addedTime: number
  receipt?: unknown
  lastCheckedBlockNumber?: number
}

export function shouldCheck(chainId: number | undefined, lastBlockNumber: number, tx: Transaction): boolean {
  if (tx.receipt) return false
  if (!tx.lastCheckedBlockNumber) return true
  const blocksSinceCheck = lastBlockNumber - tx.lastCheckedBlockNumber
  if (blocksSinceCheck < 1) return false
  // Scale block-count thresholds so each gate fires at roughly the same wall-clock cadence across chains.
  const scale = AVERAGE_L1_BLOCK_TIME / getAverageBlockTime(chainId)
  const minutesPending = (new Date().getTime() - tx.addedTime) / ms(`1m`)
  if (minutesPending > 60) {
    // every ~10 L1-equivalent blocks if pending longer than an hour
    return blocksSinceCheck > Math.round(9 * scale)
  } else if (minutesPending > 5) {
    // every ~3 L1-equivalent blocks if pending longer than 5 minutes
    return blocksSinceCheck > Math.round(2 * scale)
  } else {
    // otherwise every block
    return true
  }
}

const RETRY_OPTIONS_BY_CHAIN_ID: { [chainId: number]: RetryOptions } = {
  [ChainId.ARBITRUM_ONE]: { n: 10, minWait: 250, maxWait: 1000 },
  [ChainId.ARBITRUM_GOERLI]: { n: 10, minWait: 250, maxWait: 1000 },
  [ChainId.OPTIMISM]: { n: 10, minWait: 250, maxWait: 1000 },
  [ChainId.OPTIMISM_GOERLI]: { n: 10, minWait: 250, maxWait: 1000 },
}
const DEFAULT_RETRY_OPTIONS: RetryOptions = { n: 1, minWait: 0, maxWait: 0 }

interface UpdaterProps {
  pendingTransactions: { [hash: string]: TransactionDetails }
  onCheck: (tx: { chainId: number; hash: string; blockNumber: number }) => void
  onReceipt: (tx: { chainId: number; hash: string; receipt: TransactionReceipt }) => void
}

export default function Updater({ pendingTransactions, onCheck, onReceipt }: UpdaterProps): null {
  const { account, chainId, provider } = useWeb3React()

  const lastBlockNumber = useBlockNumber()
  const fastForwardBlockNumber = useFastForwardBlockNumber()
  const removeTransaction = useTransactionRemover()
  const blockTimestamp = useCurrentBlockTimestamp()

  // Hash -> cancel callback for in-flight receipt requests. Prevents cancel/retry
  // on every new block when block time is short (e.g. Taiko 1-2s).
  const inflight = useRef<Map<string, () => void>>(new Map())

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

    Object.keys(pendingTransactions).forEach((hash) => {
      if (inflight.current.has(hash)) return
      if (!shouldCheck(chainId, lastBlockNumber, pendingTransactions[hash])) return
      const { promise, cancel } = getReceipt(hash)
      inflight.current.set(hash, cancel)
      promise
        .then((receipt) => {
          fastForwardBlockNumber(receipt.blockNumber)
          onReceipt({ chainId, hash, receipt })
        })
        .catch((error) => {
          if (error instanceof CanceledError) return
          onCheck({ chainId, hash, blockNumber: lastBlockNumber })
        })
        .finally(() => {
          inflight.current.delete(hash)
        })
    })
  }, [chainId, provider, lastBlockNumber, getReceipt, onReceipt, onCheck, pendingTransactions, fastForwardBlockNumber])

  useEffect(() => {
    const inflightMap = inflight.current
    return () => {
      inflightMap.forEach((cancel) => cancel())
      inflightMap.clear()
    }
  }, [chainId, provider])

  return null
}
