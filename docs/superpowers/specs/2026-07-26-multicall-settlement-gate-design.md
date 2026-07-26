# Multicall Settlement Gate Design

## Context

Taiko produces blocks roughly every two seconds. `@uniswap/redux-multicall`
cancels an in-flight fetch whenever the `latestBlockNumber` prop advances.
Wallet extensions, WalletConnect sessions, and rate-limited RPC endpoints can
take longer than the block interval, so repeated block updates can cancel every
request before its result reaches Redux. `/pools` exposes this as an indefinite
loading skeleton because its position discovery consists of several dependent
multicall stages.

The existing mitigation quantizes the block feed to the interface's 12-second
data refresh window. It fixes providers faster than that window, but a slower
request can still be cancelled at every boundary and therefore never settle.

## Goals

- Let an in-flight multicall finish regardless of normal block progression.
- Make its result available immediately, even when it is behind the newest
  observed block.
- Refresh stale results at the newest queued block after the prior request
  settles.
- Preserve receipt-driven fast refreshes, reorg handling, chain isolation, and
  the current steady-state refresh cadence.
- Fix the shared multicall path rather than adding `/pools`-specific loading
  code.

## Non-goals

- Replacing `@uniswap/redux-multicall`.
- Changing RPC provider selection or wallet connection behavior.
- Adding caching, pagination, or new `/pools` UI states.
- Masking a provider that never returns or exhausts the dependency's retry
  policy.

## Considered Approaches

### Patch `@uniswap/redux-multicall`

Changing the package's cancellation semantics would address the problem at its
source, but this repository would need to maintain a patch against compiled
dependency output. Upgrades would be fragile and test coverage would depend on
private package behavior.

### Add a shared settlement gate

Keep the dependency unchanged and prevent its `latestBlockNumber` prop from
changing while Redux reports an in-flight fetch for that updater's chain. This
is small, testable in application code, and covers all shared multicall
consumers.

### Build a `/pools`-specific loader

A dedicated loader or forced public-provider path would be narrow, but it would
duplicate multicall behavior and leave the same failure mode elsewhere.

## Chosen Design

Add a settlement hook in `src/lib/state/multicall.tsx`. It receives:

- the Redux chain key used by one `multicall.Updater`;
- the newest block selected by the existing quantizer; and
- whether that chain currently has any multicall result with a numeric
  `fetchingBlockNumber`.

The hook stores the last block forwarded to the dependency:

1. When no request is in flight, adopt the newest desired block.
2. While any request is in flight, retain the forwarded block. New quantized
   blocks and receipt snaps are implicitly coalesced in the desired input.
3. When all requests settle, adopt the newest desired block. Redux keeps the
   prior result available with `syncing: true`, and the dependency begins a
   background refresh for the new block.
4. Key stored state by chain. During a switch, return `undefined` until the new
   chain's value is adopted so a block from the previous chain cannot leak.

Apply the hook independently to:

- the active-wallet updater keyed by the connected `chainId`; and
- the dedicated Taiko-mainnet feed registered under `ChainId.MAINNET`.

The gate is downstream of quantization:

```text
raw blocks / confirmed receipts
              |
              v
       12-second quantizer
              |
              v
         desired block
              |
              v
 settlement gate per Redux chain
              |
              v
   @uniswap/redux-multicall
```

## Failure Handling

- Retryable RPC failures remain inside the dependency's existing retry policy.
  Because normal block changes no longer cancel the request, a later successful
  retry can settle and release the gate.
- A terminal fetch error clears `fetchingBlockNumber`; the gate then advances
  and allows the dependency to retry at the newest desired block.
- Receipt snaps received during a fetch are queued rather than cancelling the
  fetch. They are forwarded as soon as it settles.
- A chain switch observes fetching state only for the new Redux chain key and
  never forwards the old chain's block.

## Tests

Extend `src/lib/state/multicall.test.tsx` with:

- hook tests proving initial adoption, coalescing several newer blocks while
  fetching, release to only the newest block, and chain-switch isolation;
- updater integration coverage that dispatches the dependency's real
  `fetchingMulticallResults` action, advances the fake provider beyond a
  quantization window, and verifies the inner updater's block remains fixed;
- settlement coverage that dispatches a real result action and verifies the
  newest queued block is then forwarded;
- existing quantization, receipt-snap, Hoodi, and mainnet-feed tests as
  regressions.

Run the targeted Jest file, TypeScript checking, and lint on the changed source
and test files.

## Success Criteria

- With blocks arriving every two seconds, a simulated fetch lasting longer
  than multiple refresh windows is never superseded by a newer block prop.
- The first settled result remains usable while the updater refreshes it.
- The fast path and the 12-second steady-state cadence are unchanged.
- Active-chain and dedicated-mainnet updater state remain independent.
