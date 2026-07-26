# Taiko Block Time Support — Design Review & Implementation Plan

**Scope.** Taiko Alethia now produces a block roughly every **2 seconds**, and the protocol roadmap
targets **~0.5 second** blocks (preconfirmation cadence). This interface is a fork of the Uniswap
interface, which was designed around Ethereum L1's ~12 second cadence. This document is a full
review of every place the interface's design or code depends on block cadence, the improvement
plan, and the implementation plan (one PR per major change).

The most severe 2s-block bug — the multicall fetch-cancellation storm that hung `/pools` behind a
connected wallet — was diagnosed and fixed in PR
[#44](https://github.com/taikoxyz/uniswap-interface/pull/44) and landed on `main` through
[#51](https://github.com/taikoxyz/uniswap-interface/pull/51) together with the CI repair
(#44 itself was closed as superseded). This review covers everything **besides** that fix, and
builds on top of it.

---

## 1. How the interface's data cadence actually works

Everything the app "knows" about the chain flows through a small set of mechanisms:

```
                 ┌──────────────────────────────────────────────────────────┐
                 │  Block feed (lib/hooks/useBlockNumber.tsx)               │
                 │                                                          │
  no wallet ───► │  Network connector → AppJsonRpcProvider                  │
                 │  (constants/providers.ts, pollingInterval = 12s)         │
                 │                                                          │
  wallet    ───► │  ethers Web3Provider over wallet EIP-1193 (poll ~4s)     │
                 └────────────┬─────────────────────────────────────────────┘
                              │  'block' events (bursts of ~6 on a 2s chain)
              ┌───────────────┼────────────────────┬──────────────────────┐
              ▼               ▼                    ▼                      ▼
      redux-multicall   tx receipt updater   Polling indicator      swap flow
      (quantized to     (lib/hooks/          + ChainConnectivity    (gas estimate,
      6-block steps     transactions/        Warning                analytics)
      by PR #44)        updater.tsx)         (components/Polling)
```

* **Multicall** (balances, allowances, positions, pool state, on-chain timestamp): refetches when
  the block number fed to it advances. PR #44 quantizes that feed to 6-block steps and sets
  `blocksPerFetch: 6` on Taiko, so the steady-state data window is **~12s**.
* **Transaction receipt updater**: when a block event arrives, checks pending transactions
  (`shouldCheck` block-count backoff), fetching receipts with per-chain retry options, then
  `fastForwardBlockNumber(receipt.blockNumber)`.
* **Time-based pollers** (independent of block cadence): swap quote refresh (12s), price quote
  (1m), subgraph queries (30–60s), token lists (10m), permit expiry checks (12s).
* **Deadlines & dismissals**: seconds-denominated (5-minute L2 swap deadline computed from the
  on-chain timestamp; popup dismissals 5s/10s). Already block-time independent.

**Design insight** (validated by PR #44): the app's steady-state refresh cadence is a **time
window** (~12s), not "every block". Block numbers are the *change signal*, not the clock. On a 2s
or 0.5s chain we deliberately do not chase every block for steady-state data — but user-action
feedback (a swap the user just submitted) must not be bound to that 12s window either.

---

## 2. Findings

### F1 — Transaction confirmation feels 2–6× slower than the chain actually is  *(P0, fixed in PR "block-time config")*

`RETRY_OPTIONS_BY_CHAIN_ID` in `src/lib/hooks/transactions/updater.tsx` has fast receipt-retry
entries only for Arbitrum and Optimism. Taiko falls back to
`DEFAULT_RETRY_OPTIONS = { n: 1, minWait: 0, maxWait: 0 }`: one receipt lookup per block *event*.
Block events arrive only every ~12s (app provider) or ~4s (wallet provider poll) — so a swap that
confirmed on-chain in ~2s routinely shows a spinner for 4–12s.

**Fix**: give Taiko chains the same treatment Uniswap gives 2s-block OP-stack chains —
`{ n: 10, minWait: 250, maxWait: 1000 }`. The receipt poll loop then discovers inclusion within
~1s of it happening, independent of block-event cadence. This also fires
`fastForwardBlockNumber()` sooner, which is what unlocks post-transaction data refresh (F4).

### F2 — A stalled Taiko chain goes unreported for 25 minutes  *(P0, fixed in PR "stall warning")*

`blockWaitMsBeforeWarning` for both Taiko chains is `ms('25m')` in `src/constants/chainInfo.ts`
(copied from Optimism/Base entries). On a 2s chain, 25 minutes ≈ **750 missed blocks**: users
watch stale prices for 25 minutes before `ChainConnectivityWarning` appears.

**Fix**: `3m` for Taiko mainnet (≈90 missed blocks — unambiguous stall, and comfortably above the
~12–15s staleness of the multicall-fetched timestamp that feeds this check), `10m` for Hoodi
(testnets idle and hiccup more).

### F3 — Block-count constants silently break at 0.5s blocks  *(P1, fixed across PRs "block-time config" + "multicall cadence")*

Hard-coded block *counts* that mean "~12 seconds" only at a 2s block time:

| Site | Constant | At 0.5s blocks it becomes |
| :-- | :-- | :-- |
| `src/lib/state/multicall.tsx` (from #44/#51) | `MULTICALL_BLOCK_QUANTIZATION = 6` | a 3s window — the cancellation storm PR #44 fixed **comes back** for any wallet provider with >3s round trip |
| `src/lib/state/multicall.tsx` (from #44/#51) | `blocksPerFetch: 6` | refetch every 3s — 4× the RPC load |
| `src/lib/hooks/transactions/updater.tsx` | `shouldCheck`: "every 3 blocks" / "every 10 blocks" backoff | 1.5s / 5s — hour-old stuck transactions get receipt-checked at nearly every poll, forever |

**Fix**: one source of truth, `getAverageBlockTimeMs(chainId)` (2000ms for Taiko today,
overridable via `REACT_APP_TAIKO_BLOCK_TIME_MS` for the 0.5s cutover), plus
`blocksPerWindow(chainId, windowMs)`. Every block-count constant above is derived from it. When
Taiko moves to 0.5s blocks, the cutover is an env change, not a code hunt.

### F4 — After a confirmed transaction, balances can stay stale for up to ~12s  *(P1, fixed in PR "multicall cadence")*

A consequence of PR #44's (correct) quantization: `fastForwardBlockNumber(receipt.blockNumber)`
advances the *raw* block feed, but the quantizer ignores advances smaller than 6 blocks, so the
multicall layer may not refetch until the next 12s window — even though we hold a receipt proving
a state change relevant to the user. Approvals mid-swap-flow feel this too (`useTokenAllowance`
sets `blocksPerFetch: 1` while syncing, but nothing refetches until the quantized feed moves).

**Fix**: let the quantized feed **snap** to fast-forwarded blocks. Fast-forwards only happen when
one of the *user's own* transactions confirms, so this costs at most one extra multicall round per
user action — the steady-state 12s window is preserved.

### F5 — "AVERAGE_L1_BLOCK_TIME" is used as a generic app cadence  *(P2, partially addressed in PR "block-time config")*

`AVERAGE_L1_BLOCK_TIME = ms('12s')` is used as: the app provider polling interval, the swap-quote
polling interval, the permit-signature validity margin, and `PollingInterval.Fast`. On a
Taiko-only fork none of these have anything to do with Ethereum L1. The *values* are right — 12s
is the designed steady-state window — but the coupling is wrong, and one consumer
(`usePermit2Allowance`) uses it where the *chain's* block time is what's actually meant (margin so
a signature is still valid in the block that includes it).

Also latent in `usePermit2Allowance`: the `now` state initializer is millisecond-scale while every
subsequent tick is second-scale (`(Date.now() + margin) / 1000`). Harmless today (first tick
corrects it; Permit2 flows are disabled on Taiko), but wrong the day UniversalRouter + Permit2
deploy on Taiko mainnet.

**Fix**: introduce `DATA_REFRESH_WINDOW_MS` (semantic name for the 12s window) and use the
chain-aware block time for the permit margin; fix the seconds-scale initializer. The provider
polling interval keeps its current value/constant to avoid churning files PR #44 touches.

### F6 — Minor cleanups  *(P2, folded into PR "stall warning")*

* `L2_CHAIN_IDS` in `src/constants/chains.ts` lists `TAIKO_MAINNET_CHAIN_ID` twice — the duplicate
  leaks into WalletConnect's `optionalChains`.
* `Polling` tooltip copy still says "Prices update on every block" (post-#44 it's every ~12s
  window). Cosmetic; left alone for now to avoid i18n churn — tracked in Backlog.

### Verified non-issues (checked, no change needed)

* **Swap deadlines**: L2 path = on-chain timestamp + 5 min (`useTransactionDeadline`,
  `L2_DEADLINE_FROM_NOW`); timestamp staleness (≤ ~14s) is noise at that scale. Time-based, fine
  at any block time.
* **Popup dismissals** (`L2_TXN_DISMISS_MS`), **permit expirations** (30d/30m), **quote cache
  TTL** (10s), **token-list refresh** (10m): all wall-clock based.
* **Subgraph polling** (30–60s Apollo polls): time-based; faster blocks only make data fresher.
* **Swap-quote polling faster than 12s would be a no-op today**: client-side AlphaRouter quotes go
  through `AppJsonRpcProvider`'s per-block `eth_call` cache, which only clears when the provider
  emits block events (12s poll). Polling quotes at, e.g., 4s would mostly re-read the same cached
  state. Quote freshness and provider cadence must move together (see Backlog).
* **ethers burst block emission**: at 12s poll the provider emits ~6 (2s) / ~24 (0.5s) 'block'
  events per poll in a burst; consumers take a monotonic max and React batches the state updates.
  Verified cheap; no change.
* **UniswapX order polling (2s), Vote pages, NFT flows**: not reachable on Taiko chains in this
  fork.
* **`ConfirmSwapModal` step machine**: fully event-driven (receipt/allowance state), no timing
  assumptions.

---

## 3. Improvement plan (design)

Four principles, in priority order:

1. **Steady-state cadence is a time window, not a block count.** The app refreshes chain data
   every `DATA_REFRESH_WINDOW_MS` (12s) regardless of how many blocks that spans. This is what
   makes RPC load independent of block time (2s today, 0.5s tomorrow: same load).
2. **Every block-count constant derives from per-chain block time.** `blocksPerWindow(chainId,
   windowMs)` is the only allowed way to turn a time window into a block count. Block time comes
   from one config table with an env override for cutovers.
3. **User-action feedback bypasses the steady-state window.** Receipt polling races ahead of block
   events (F1), and a confirmed receipt snaps the multicall feed forward (F4). The user's own
   actions feel 2s-chain fast; ambient data stays 12s-window cheap.
4. **Stall detection scales with expected cadence.** A chain expected to produce a block every 2s
   gets a minutes-scale warning threshold, not the 25-minute one tuned for chains with long gaps.

At **0.5s block time**, nothing above changes shape: the quantization step becomes 24, receipt
polling already resolves in sub-second, thresholds are already denominated in time. The cutover is
`REACT_APP_TAIKO_BLOCK_TIME_MS=500` (see §5).

---

## 4. Implementation plan (one PR per major change)

Merge order: #47 before #49 (#49 imports #47's block-time API); #48 and this document are
independent. The same dependency governs reverts: the stack is **not** independently
revertible — reverting #47 requires reverting #49 first (reverse dependency order). #48, #51,
and this document can each be reverted on their own.

Status as of the last update of this document:

| # | PR | Base | Status | Contents |
| :-- | :-- | :-- | :-- | :-- |
| 0 | **#51** (carries the #44 fix) | `main` | **merged** | Multicall quantization + `blocksPerFetch: 6`; CI to green. Everything below builds on it. |
| 1 | **this PR** — docs: block-time review & plan | `main` | open | This document. |
| 2 | **#47** — feat: per-chain block time config + fast Taiko tx confirmation (F1, F3-partial, F5) | `main` | open | New `src/config/chains/blockTime.ts` (`getAverageBlockTimeMs`, `blocksPerWindow`, `DATA_REFRESH_WINDOW_MS`, `REACT_APP_TAIKO_BLOCK_TIME_MS` override, validation, tests). Taiko receipt retry options; `shouldCheck` backoff converted from block counts to time (behavior-identical on 12s chains — unit-tested both ways). Quote-poll + permit-margin consumers moved off `AVERAGE_L1_BLOCK_TIME`; permit `now` seconds fix. |
| 3 | **#48** — fix: surface Taiko chain stalls in minutes instead of 25 (F2, F6) | `main` | **merged** | `blockWaitMsBeforeWarning`: Taiko mainnet 3m, Hoodi 10m. `L2_CHAIN_IDS` dedupe. |
| 4 | **#49** — refactor: derive multicall cadence from chain block time and snap to confirmed blocks (F3, F4) | #47 branch | open | `MULTICALL_BLOCK_QUANTIZATION` and `getBlocksPerFetchForChainId` derived via `blocksPerWindow` (identical values at 2s: step 6; at 0.5s: step 24 automatically). Quantizer snaps to `fastForward`ed (receipt-confirmed) blocks; `useBlockNumber` exposes the fast-forward signal. Hook-level unit tests for quantize + snap semantics. |

**History note**: #47 and #48 were originally stacked on #44's branch, which owned
`src/lib/state/multicall.tsx` and the only green CI toolchain while `main` failed
typecheck/tests/lint. Once #51 merged that history into `main`, both were rebased and retargeted
to `main` (#48 has since merged). #49 targets #47's branch and retargets to `main` when #47
merges. Once the whole stack lands, this section is historical record; the durable content of
this document is the architecture review (§1–§3), the cutover runbook (§5), and the backlog
(§6).

**Verification done per PR** (on the stacked branches, where jest/tsc are green):

* #47: unit tests for `blockTime.ts` (defaults, env override parsing/validation, window math);
  extended `shouldCheck` tests proving 12s-chain behavior unchanged and 2s/0.5s backoff sane;
  full suite green (116 suites / 669 tests); `tsc` and lint clean.
* #48: full suite green; `tsc` and lint clean (config-value change).
* #49: renderHook tests for the quantizer (step advance, chain-switch reset, snap-on-fastForward,
  no-regression when snap block < quantized); full suite green (117 suites / 676 tests).

---

## 5. Runbook: cutting over to 0.5s blocks

When Taiko mainnet moves to ~0.5s block production:

1. Set `REACT_APP_TAIKO_BLOCK_TIME_MS=500` in the deployment environment and rebuild. Derived
   behavior after PRs 2 & 4:
   * multicall quantization step & `blocksPerFetch`: 6 → **24** (window stays ~12s; RPC load flat)
   * receipt-check backoff: unchanged (time-denominated)
   * receipt retry loop: unchanged (already sub-second)
   * stall warning: unchanged (minutes-scale)
2. Decide whether the product wants a faster steady-state window (e.g. 6s). If yes, change
   `DATA_REFRESH_WINDOW_MS` — **one constant** — with the understanding that RPC load scales
   inversely with the window.
3. If Taiko exposes preconfirmations, see Backlog: surfacing "preconfirmed" is an additive UX
   feature on top of this foundation, not a rework.

No other code changes are expected. (If block time changes *again*, only the env var moves.)

---

## 6. Backlog / adjacent work (not in these PRs)

* **Pause quote polling in hidden tabs.** RTK Query 1.9's `pollingInterval` keeps firing in
  background tabs (client-side quotes = real RPC). Either gate `pollingInterval` on
  `useIsWindowVisible()` or upgrade to RTK 2.x for `skipPollingIfUnfocused`.
* **Quote freshness vs provider cadence.** If the product wants sub-12s swap-quote refresh, lower
  the app provider polling interval and the quote poll *together* (they're coupled through the
  per-block `eth_call` cache) and budget the RPC increase.
* **Preconfirmation UX** (0.5s era): show user transactions as "preconfirmed" from the preconf
  stream before L2 block inclusion. Needs a Taiko preconf API; layers cleanly on the F1/F4
  receipt-driven paths.
* **Subgraph indexing headroom**: Explore/portfolio views poll Goldsky subgraphs every 60s; at
  0.5s blocks the indexer must sustain 24× Ethereum block throughput. Ops/monitoring concern, not
  interface code.
* **Deploy UniversalRouter + Permit2 on Taiko mainnet** to retire the bespoke SwapRouter02 path
  (`TAIKO_UNIVERSAL_ROUTER_ADDRESS[mainnet]` is still zero). The permit-margin fix in PR 2
  already prepares the signature-validity math for it.
* **Copy**: Polling tooltip "Prices update on every block" → window-based wording (i18n string
  change; batch with the next translation pass).
* **e2e on Hoodi**: the mainnet-fork cypress jobs were removed in #44 (by design). A smoke e2e
  against Hoodi (2s blocks, real sequencer timing) would exercise the confirmation path this plan
  optimizes.
