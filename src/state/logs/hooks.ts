import type { Filter } from '@ethersproject/providers'
import { useWeb3React } from '@web3-react/core'
import { useRefetchBlockNumber } from 'lib/hooks/useBlockNumber'
import { useEffect, useMemo } from 'react'

import { useAppDispatch, useAppSelector } from '../hooks'
import { addListener, removeListener } from './slice'
import { filterToKey, isHistoricalLog, Log } from './utils'

enum LogsState {
  // The filter is invalid
  INVALID,
  // The logs are being loaded
  LOADING,
  // Logs are from a previous block number
  SYNCING,
  // Tried to fetch logs but received an error
  ERROR,
  // Logs have been fetched as of the latest block number
  SYNCED,
}

interface UseLogsResult {
  logs?: Log[]
  state: LogsState
}

/**
 * Returns the logs for the given filter, re-fetched once per data refresh window (see
 * useRefetchBlockNumber) rather than on every block.
 * @param filter The logs filter, with `fromBlock` or `toBlock` optionally specified.
 * The filter parameter should _always_ be memoized, or else will trigger constant refetching
 */
export function useLogs(filter: Filter | undefined): UseLogsResult {
  const { chainId } = useWeb3React()
  // The same feed the logs Updater fetches against, so SYNCED/SYNCING reflect the fetch cadence.
  const blockNumber = useRefetchBlockNumber()

  const logs = useAppSelector((state) => state.logs)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!filter || !chainId) return

    dispatch(addListener({ chainId, filter }))
    return () => {
      dispatch(removeListener({ chainId, filter }))
    }
  }, [chainId, dispatch, filter])

  return useMemo(() => {
    if (!chainId || !filter || !blockNumber)
      return {
        logs: undefined,
        state: LogsState.INVALID,
      }

    const state = logs[chainId]?.[filterToKey(filter)]
    const result = state?.results

    if (!result) {
      return {
        state: LogsState.LOADING,
        logs: undefined,
      }
    }

    if (result.error) {
      return {
        state: LogsState.ERROR,
        logs: undefined,
      }
    }

    return {
      // if we're only fetching logs until a block that has already elapsed, we're synced regardless of result.blockNumber
      state: isHistoricalLog(filter, blockNumber)
        ? LogsState.SYNCED
        : result.blockNumber >= blockNumber
        ? LogsState.SYNCED
        : LogsState.SYNCING,
      logs: result.logs,
    }
  }, [blockNumber, chainId, filter, logs])
}
