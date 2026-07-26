/**
 * Per-chain block production cadence.
 *
 * Taiko Alethia currently produces a block every ~2s, and the protocol roadmap targets ~0.5s
 * blocks. Any code that converts between time and a number of blocks must go through this module,
 * so that a change in Taiko's block time is a configuration change rather than a code hunt.
 *
 * Two distinct concepts live here — do not conflate them:
 * - `getAverageBlockTimeMs(chainId)`: how often the chain produces blocks.
 * - `DATA_REFRESH_WINDOW_MS`: how often this app refreshes steady-state chain data. This is a
 *   product decision (12s, the cadence the Uniswap interface was designed around) and is
 *   intentionally independent of block time, so RPC load does not scale with chain speed.
 *
 * @module config/chains/blockTime
 */

import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from './taiko'

/**
 * Ethereum L1 cadence, used for any chain without an explicit entry below.
 */
export const DEFAULT_AVERAGE_BLOCK_TIME_MS = 12_000

/**
 * The steady-state cadence at which the interface refreshes on-chain data (multicall reads, swap
 * quotes). Block numbers are the change signal for that data, but this window is the clock:
 * pushing it lower increases RPC load proportionally on every open tab, regardless of block time.
 */
export const DATA_REFRESH_WINDOW_MS = 12_000

const DEFAULT_TAIKO_BLOCK_TIME_MS = 2_000

// Bounds protect app cadence from a mistyped env override (e.g. seconds instead of ms).
const MIN_BLOCK_TIME_MS = 100
const MAX_BLOCK_TIME_MS = 60_000

function parseTaikoBlockTimeMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_TAIKO_BLOCK_TIME_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < MIN_BLOCK_TIME_MS || parsed > MAX_BLOCK_TIME_MS) {
    console.error(
      `Ignoring invalid REACT_APP_TAIKO_BLOCK_TIME_MS="${raw}" (expected a number of milliseconds between ` +
        `${MIN_BLOCK_TIME_MS} and ${MAX_BLOCK_TIME_MS}); using ${DEFAULT_TAIKO_BLOCK_TIME_MS}ms`
    )
    return DEFAULT_TAIKO_BLOCK_TIME_MS
  }
  return parsed
}

/**
 * Block time for Taiko chains. When the network cuts over to sub-second blocks, deploy with
 * REACT_APP_TAIKO_BLOCK_TIME_MS=500 — all block-count-derived behavior follows from it.
 *
 * NB: the override applies to BOTH Taiko chains. That matches the deployment model (separate
 * mainnet and Hoodi builds selected via REACT_APP_TAIKO_CHAIN), but a single build exposing both
 * chains cannot model a staggered rollout where only one chain has cut over — give each chain its
 * own entry in the table below if that is ever needed.
 */
export const TAIKO_BLOCK_TIME_MS = parseTaikoBlockTimeMs(process.env.REACT_APP_TAIKO_BLOCK_TIME_MS)

const AVERAGE_BLOCK_TIME_MS: { [chainId: number]: number } = {
  [TAIKO_MAINNET_CHAIN_ID]: TAIKO_BLOCK_TIME_MS,
  [TAIKO_HOODI_CHAIN_ID]: TAIKO_BLOCK_TIME_MS,
}

/**
 * Average time between blocks on the given chain, in milliseconds.
 */
export function getAverageBlockTimeMs(chainId?: number): number {
  return (chainId !== undefined ? AVERAGE_BLOCK_TIME_MS[chainId] : undefined) ?? DEFAULT_AVERAGE_BLOCK_TIME_MS
}

/**
 * Number of blocks the given chain is expected to produce within windowMs, as an integer >= 1.
 * This is the only sanctioned way to turn a time window into a block count (e.g. multicall's
 * blocksPerFetch), so that block-count constants keep meaning the same amount of wall time when
 * the chain's block time changes.
 */
export function blocksPerWindow(chainId: number | undefined, windowMs = DATA_REFRESH_WINDOW_MS): number {
  return Math.max(1, Math.round(windowMs / getAverageBlockTimeMs(chainId)))
}
