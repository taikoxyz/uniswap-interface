import { deepCopy } from '@ethersproject/properties'
// This is the only file which should instantiate new Providers.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { isPlain } from '@reduxjs/toolkit'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

import { AVERAGE_L1_BLOCK_TIME } from './chainInfo'
import { CHAIN_IDS_TO_NAMES, SupportedInterfaceChain } from './chains'
import { RPC_URLS } from './networks'

type ConnectionInfo = Exclude<ConstructorParameters<typeof StaticJsonRpcProvider>[0], string | undefined>

/**
 * Builds the ethers connection for the interface's own RPC endpoints.
 *
 * The Taiko RPC (eRPC) maps some deterministic execution errors to HTTP 429, notably
 * `-32005 Revm error: zk gas limit exceeded` for oversized eth_calls. ethers treats every 429 as a
 * rate limit and stalls-and-retries with exponential backoff (up to 12 attempts, 2 min timeout each),
 * which turns a failed call into one that never seems to finish. ethers' throttleCallback cannot see the
 * response body, so it is disabled here and `sendWithRateLimitRetry` retries genuine rate limits instead.
 */
export function getRpcConnection(url: string): ConnectionInfo {
  return { url, throttleCallback: () => Promise.resolve(false) }
}

const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_BASE_DELAY_MS = 250

// Deliberately not the bare -32005 code: that is also used for plain "rate limit exceeded" responses.
const DETERMINISTIC_EXECUTION_ERROR = /zk gas limit exceeded/i

const MAX_RETRY_DELAY_MS = 5_000

function isRateLimitError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 429
}

/** A 429 whose body reports an execution failure: repeating the identical call can never succeed. */
export function isDeterministicExecutionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { body, message } = error as { body?: unknown; message?: unknown }
  return DETERMINISTIC_EXECUTION_ERROR.test(`${typeof body === 'string' ? body : ''} ${String(message ?? '')}`)
}

/**
 * Milliseconds the server asked us to wait via a Retry-After header (seconds or HTTP date), if any.
 *
 * NB: browsers only expose response headers the server lists in Access-Control-Expose-Headers, and the Taiko
 * RPC currently exposes none, so on swap.taiko.xyz this returns undefined and the plain backoff applies.
 * It starts working as soon as the RPC exposes Retry-After.
 */
export function getRetryAfterMs(error: unknown, now: number = Date.now()): number | undefined {
  const headers = typeof error === 'object' && error !== null ? (error as { headers?: unknown }).headers : undefined
  if (typeof headers !== 'object' || headers === null) return undefined
  const entry = Object.entries(headers as Record<string, unknown>).find(([key]) => key.toLowerCase() === 'retry-after')
  const value = typeof entry?.[1] === 'string' ? entry[1].trim() : undefined
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

interface RateLimitRetryOptions {
  retries?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

/**
 * Retries genuine HTTP 429 rate limits with bounded exponential backoff (never sooner than the server's
 * Retry-After, capped at MAX_RETRY_DELAY_MS), but fails fast on 429s that carry a deterministic execution
 * error (eg zk gas limit exceeded) and on every other error.
 */
export async function sendWithRateLimitRetry<T>(
  send: () => Promise<T>,
  {
    retries = RATE_LIMIT_RETRIES,
    baseDelayMs = RATE_LIMIT_BASE_DELAY_MS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }: RateLimitRetryOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send()
    } catch (error) {
      if (attempt >= retries || !isRateLimitError(error) || isDeterministicExecutionError(error)) throw error
      const delay = Math.max(baseDelayMs * 2 ** attempt, getRetryAfterMs(error) ?? 0)
      await sleep(Math.min(delay, MAX_RETRY_DELAY_MS))
    }
  }
}

export class AppJsonRpcProvider extends StaticJsonRpcProvider {
  private _blockCache = new Map<string, Promise<any>>()
  get blockCache() {
    // If the blockCache has not yet been initialized this block, do so by
    // setting a listener to clear it on the next block.
    if (!this._blockCache.size) {
      this.once('block', () => this._blockCache.clear())
    }
    return this._blockCache
  }

  constructor(chainId: SupportedInterfaceChain, rpcUrl: string = RPC_URLS[chainId as keyof typeof RPC_URLS][0]) {
    // Including networkish allows ethers to skip the initial detectNetwork call.
    // Only Taiko chains are present in RPC_URLS; this class is only instantiated with Taiko ids below.
    super(getRpcConnection(rpcUrl), /* networkish= */ { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })

    // NB: Third-party providers (eg MetaMask) will have their own polling intervals,
    // which should be left as-is to allow operations (eg transaction confirmation) to resolve faster.
    // Network providers (eg AppJsonRpcProvider) need to update less frequently to be considered responsive.
    this.pollingInterval = AVERAGE_L1_BLOCK_TIME
  }

  send(method: string, params: Array<any>): Promise<any> {
    const sendOnce = () => sendWithRateLimitRetry(() => super.send(method, params))

    // Only cache eth_call's.
    if (method !== 'eth_call') return sendOnce()

    // Only cache if params are serializable.
    if (!isPlain(params)) return sendOnce()

    const key = `call:${JSON.stringify(params)}`
    const cached = this.blockCache.get(key)
    if (cached) {
      this.emit('debug', {
        action: 'request',
        request: deepCopy({ method, params, id: 'cache' }),
        provider: this,
      })
      return cached
    }

    const cache = this.blockCache
    const result = sendOnce()
    cache.set(key, result)
    // Do not let a failed call be replayed from the cache by callers' own retries within the same block.
    result.catch(() => {
      if (cache.get(key) === result) cache.delete(key)
    })
    return result
  }
}

/**
 * These are the only JsonRpcProviders used directly by the interface.
 * Taiko-only deployment - only Taiko Mainnet and Hoodi providers.
 */
export const RPC_PROVIDERS: { [key in SupportedInterfaceChain]: StaticJsonRpcProvider } = {
  [TAIKO_MAINNET_CHAIN_ID]: new AppJsonRpcProvider(TAIKO_MAINNET_CHAIN_ID as SupportedInterfaceChain),
  [TAIKO_HOODI_CHAIN_ID]: new AppJsonRpcProvider(TAIKO_HOODI_CHAIN_ID as SupportedInterfaceChain),
} as any

/**
 * Returns the interface's own JSON-RPC provider for a chain, if the interface has one.
 * RPC_PROVIDERS is typed for every supported interface chain, but this Taiko-only deployment
 * only instantiates Taiko providers, so indexing it for other chains yields undefined at
 * runtime. This accessor makes that safe for any chainId.
 */
export function getAppRpcProvider(chainId: number | undefined): StaticJsonRpcProvider | undefined {
  if (chainId === undefined) return undefined
  return (RPC_PROVIDERS as { [chainId: number]: StaticJsonRpcProvider | undefined })[chainId]
}
