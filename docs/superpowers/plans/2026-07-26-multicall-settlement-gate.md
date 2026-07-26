# Multicall Settlement Gate Implementation Plan

> **For Codex:** Implement each task test-first and keep the change confined to
> the shared multicall updater and its tests.

**Goal:** Allow slow multicall requests to settle without being cancelled by
new Taiko blocks, then refresh their stale results at the newest queued block.

**Architecture:** Preserve `useQuantizedBlockNumber` as the desired-block
source. Add a small chain-keyed hook that forwards desired blocks only when
Redux reports no multicall request in flight for that updater's chain. Apply it
independently to the active and dedicated-mainnet updater feeds, and remount
the dependency's active updater when the connected chain changes so its
instance-local cancellation callbacks cannot cross chains.

**Tech stack:** React hooks, Redux Toolkit state from
`@uniswap/redux-multicall`, TypeScript, Jest, React Testing Library.

---

## Task 1: Specify and implement the settlement state machine

**Files:**

- Modify: `src/lib/state/multicall.test.tsx`
- Modify: `src/lib/state/multicall.tsx`

### Step 1: Add failing hook tests

Import a new exported `useSettledBlockNumber` hook and add a
`renderSettled(...)` test helper parallel to `renderQuantized(...)`.

Cover these transitions:

```ts
it('adopts desired blocks while idle', () => {
  // undefined -> 100 -> 106 while isFetching is false
  // Expect each defined desired block to be forwarded.
})

it('holds while fetching and coalesces to the newest desired block', () => {
  // Start settled at 100.
  // Rerender at 106/fetching and 112/fetching: expect 100.
  // Rerender at 112/not fetching: expect 112, never 106.
})

it('does not carry a block across a chain switch', () => {
  // Set chain A to 100.
  // Switch to chain B with no block: expect undefined.
  // Supply chain B block 102: expect 102.
})

it('queues a lower reorg block until the current fetch settles', () => {
  // Settle at 100, request 90 while fetching: expect 100.
  // Clear fetching: expect 90.
})
```

### Step 2: Run the focused tests and confirm the missing-hook failure

Run:

```bash
yarn test src/lib/state/multicall.test.tsx --runInBand
```

Expected: the suite fails because `useSettledBlockNumber` is not exported.

### Step 3: Implement the minimal hook

In `src/lib/state/multicall.tsx`, add:

```ts
export function useSettledBlockNumber(
  chainId: number | undefined,
  desiredBlockNumber: number | undefined,
  isFetching: boolean
): number | undefined
```

Store `{ chainId, block }` in React state. In an effect, adopt
`desiredBlockNumber` only when `isFetching` is false. Return a block only when
the stored `chainId` matches the current one; otherwise return `undefined`.

This deliberately does not add timers, queues, or retry logic. The latest
desired input is already the coalesced queue, and the dependency owns retries.

### Step 4: Rerun the focused tests

Run the same Jest command.

Expected: all hook and existing quantization tests pass.

---

## Task 2: Gate both real multicall updater feeds

**Files:**

- Modify: `src/lib/state/multicall.test.tsx`
- Modify: `src/lib/state/multicall.tsx`

### Step 1: Add failing updater integration tests

Use the real application store and real multicall reducer actions while keeping
the existing spy around the inner `multicall.Updater`.

The first test should:

1. Render `MulticallUpdater` on Taiko mainnet at `BLOCK`.
2. Dispatch `multicall.actions.fetchingMulticallResults` for a synthetic call
   on `TAIKO_MAINNET_CHAIN_ID` at `BLOCK`.
3. Emit `BLOCK + STEP` from the fake provider.
4. Assert that the active updater still receives `BLOCK`.
5. Dispatch `multicall.actions.updateMulticallResults` for the synthetic call
   at `BLOCK`.
6. Assert that the active updater now receives `BLOCK + STEP`.

The second test should prove updater-key isolation while the Taiko-mainnet
provider advances both desired feeds:

1. Mark `TAIKO_MAINNET_CHAIN_ID` fetching and emit `BLOCK + STEP`.
2. Assert that only the active updater is held; the updater registered under
   `ChainId.MAINNET` advances.
3. Settle the active marker.
4. Mark `ChainId.MAINNET` fetching and emit `BLOCK + 2 * STEP`.
5. Assert that only the dedicated-mainnet updater is held; the active updater
   advances.
6. Settle the mainnet marker.

Add `afterEach` cleanup using `errorFetchingMulticallResults` for the synthetic
calls on both Redux chain keys so a failed assertion cannot leave the shared
test store in a fetching state.

This test represents a request that crosses a full refresh window and proves
the result action, rather than elapsed blocks, releases the gate.

### Step 2: Run the focused suite and confirm the block advances too early

Run:

```bash
yarn test src/lib/state/multicall.test.tsx --runInBand
```

Expected: the new integration test reports `BLOCK + STEP` while the synthetic
request is still marked fetching.

### Step 3: Derive per-chain fetching state and apply the hook

Import `useAppSelector` and add a small internal selector hook:

```ts
function useMulticallFetching(chainId: number | undefined): boolean {
  return useAppSelector((state) => {
    if (chainId === undefined) return false
    return Object.values(state.multicall.callResults[chainId] ?? {}).some(
      (result) => typeof result.fetchingBlockNumber === 'number'
    )
  })
}
```

In `MulticallUpdater`, call `useSettledBlockNumber` independently for:

- `chainId` plus `latestBlockNumber`; and
- `ChainId.MAINNET` plus `latestMainnetBlockNumber`.

Pass the settled values to the corresponding inner updaters. Do not change
contracts, listener options, quantization, receipt snapping, or pool hooks.

### Step 4: Rerun the focused suite

Run:

```bash
yarn test src/lib/state/multicall.test.tsx --runInBand
```

Expected: the new slow-fetch regression and all existing feed tests pass.

---

## Task 3: Isolate dependency cancellation state across chain switches

**Files:**

- Modify: `src/lib/state/multicall.test.tsx`
- Modify: `src/lib/state/multicall.tsx`

### Step 1: Add a failing chain-switch lifecycle test

For this test, make the mocked inner updater record mount and unmount chain
IDs with a `useEffect`.

The test should:

1. Render chain A and mark a synthetic chain-A call fetching.
2. Switch the mocked wallet and rerender on chain B.
3. Assert that the chain-A inner updater unmounted.
4. Switch back to chain A before its request settles and assert its forwarded
   block is `undefined`, not a block retained from chain B.
5. Dispatch a real result action for the old chain-A request.
6. Assert that chain A adopts its current desired block.

Without a React key, the same dependency updater instance is reused at step 2,
so the unmount assertion fails.

### Step 2: Key the active inner updater by chain

Add `key={chainId}` to only the active-wallet `multicall.Updater`. The
dedicated-mainnet updater has a constant Redux chain and does not need a
dynamic key.

### Step 3: Rerun the focused suite

```bash
yarn test src/lib/state/multicall.test.tsx --runInBand
```

Expected: all settlement, isolation, switch, quantization, and receipt tests
pass.

---

## Task 4: Verify the surgical change

**Files:**

- Verify: `src/lib/state/multicall.tsx`
- Verify: `src/lib/state/multicall.test.tsx`

### Step 1: Run TypeScript

```bash
yarn typecheck --pretty false
```

Expected: no TypeScript errors.

### Step 2: Lint the changed source and test

```bash
yarn eslint src/lib/state/multicall.tsx src/lib/state/multicall.test.tsx
```

Expected: no lint errors.

### Step 3: Inspect the final diff

```bash
git diff --check
git diff --stat origin/main...
git diff origin/main... -- src/lib/state/multicall.tsx src/lib/state/multicall.test.tsx
```

Confirm every changed production line belongs to block settlement and no
dependency, provider, pool hook, or unrelated formatting changed.

### Step 4: Commit the implementation

```bash
git add src/lib/state/multicall.tsx src/lib/state/multicall.test.tsx
git commit -m "fix: let slow multicalls settle before refreshing"
```
