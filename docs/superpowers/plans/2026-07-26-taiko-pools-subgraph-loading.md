# Taiko Pools Subgraph Loading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load connected-wallet V3 positions on `/pools` from the Taiko or Hoodi pool subgraph, with automatic fallback to the existing RPC enumeration path.

**Architecture:** Add a focused Taiko GraphQL hook that converts the compact `Position` entity from `taikoxyz/uniswap-v3-subgraph#7` into the existing list-facing `PositionDetails` shape and validates subgraph health. Route the existing `useV3Positions` hook to that result only on Taiko networks; disable RPC enumeration while the subgraph is healthy and restore it for every error, stale, malformed, or truncated result.

**Tech Stack:** React hooks, TypeScript, Apollo Client, ethers `BigNumber`, Jest, React Testing Library

---

### Task 0: Record the implementation plan

**Files:**
- Create: `docs/superpowers/plans/2026-07-26-taiko-pools-subgraph-loading.md`

- [ ] **Step 1: Verify the plan is the only uncommitted tracked file**

Run:

```bash
git diff --check -- docs/superpowers/plans/2026-07-26-taiko-pools-subgraph-loading.md
git status --short
```

Expected: the plan is untracked, root `.superpowers/` is also untracked, and
there are no other changes.

- [ ] **Step 2: Commit only the plan**

```bash
git add docs/superpowers/plans/2026-07-26-taiko-pools-subgraph-loading.md
git commit -m "docs: plan Taiko pools subgraph loading"
```

Expected: the plan is committed and root `.superpowers/` remains untracked.

### Task 1: Add the Taiko position query and health boundary

**Files:**
- Create: `src/graphql/taiko/TaikoPositions.ts`
- Create: `src/graphql/taiko/TaikoPositions.test.ts`

- [ ] **Step 1: Write the failing mapping and health tests**

Create `src/graphql/taiko/TaikoPositions.test.ts` with:

```typescript
import { useQuery } from '@apollo/client'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { getPoolClientForChain } from 'graphql/taiko/apollo'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { renderHook } from 'test-utils/render'

import { useTaikoV3Positions } from './TaikoPositions'

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: jest.fn(),
}))
jest.mock('graphql/taiko/apollo')
jest.mock('lib/hooks/useBlockNumber')

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const CLIENT = {} as ReturnType<typeof getPoolClientForChain>
const POSITION = {
  id: '42',
  liquidity: '123456',
  feeTier: '3000',
  tickLower: '-120',
  tickUpper: '120',
  token0: { id: '0x2222222222222222222222222222222222222222' },
  token1: { id: '0x3333333333333333333333333333333333333333' },
}
const DATA = {
  _meta: { block: { number: 1_000 }, hasIndexingErrors: false },
  positions: [POSITION],
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(getPoolClientForChain as jest.MockedFunction<typeof getPoolClientForChain>).mockReturnValue(CLIENT)
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(1_010)
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    data: DATA,
    loading: false,
  } as ReturnType<typeof useQuery>)
})

it.each([TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID])(
  'queries and maps positions for chain %s',
  (chainId) => {
    const { result } = renderHook(() => useTaikoV3Positions(chainId, ACCOUNT))

    expect(getPoolClientForChain).toHaveBeenCalledWith(chainId)
    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        client: CLIENT,
        skip: false,
        variables: { account: ACCOUNT },
      })
    )
    expect(result.current.fallbackToRpc).toBe(false)
    expect(result.current.positions?.[0]).toMatchObject({
      tokenId: expect.objectContaining({ _hex: '0x2a' }),
      fee: 3000,
      liquidity: expect.objectContaining({ _hex: '0x01e240' }),
      tickLower: -120,
      tickUpper: 120,
      token0: POSITION.token0.id,
      token1: POSITION.token1.id,
    })
  }
)

it.each([
  ['indexing errors', { ...DATA, _meta: { ...DATA._meta, hasIndexingErrors: true } }, 1_010],
  ['stale data', DATA, 1_021],
  ['missing metadata', { positions: [POSITION] }, 1_010],
  ['result limit', { ...DATA, positions: Array(1_000).fill(POSITION) }, 1_010],
  ['malformed values', { ...DATA, positions: [{ ...POSITION, feeTier: 'bad' }] }, 1_010],
  ['invalid token address', { ...DATA, positions: [{ ...POSITION, token0: { id: 'bad' } }] }, 1_010],
  ['missing positions array', { ...DATA, positions: undefined }, 1_010],
])('falls back for %s', (_name, data, block) => {
  ;(useBlockNumber as jest.MockedFunction<typeof useBlockNumber>).mockReturnValue(block)
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    data,
    loading: false,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(true)
  expect(result.current.positions).toBeUndefined()
})

it('falls back when the query fails', () => {
  ;(useQuery as jest.MockedFunction<typeof useQuery>).mockReturnValue({
    error: new Error('query failed'),
    loading: false,
  } as ReturnType<typeof useQuery>)

  const { result } = renderHook(() => useTaikoV3Positions(TAIKO_MAINNET_CHAIN_ID, ACCOUNT))

  expect(result.current.fallbackToRpc).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
yarn test src/graphql/taiko/TaikoPositions.test.ts --watchAll=false
```

Expected: FAIL because `./TaikoPositions` does not exist.

- [ ] **Step 3: Implement the minimal Taiko query hook**

Create `src/graphql/taiko/TaikoPositions.ts`:

```typescript
import { gql, useQuery } from '@apollo/client'
import { isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { AddressZero } from '@ethersproject/constants'
import { isTaikoChain } from 'config/chains/taiko'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { useMemo } from 'react'
import { PositionDetails } from 'types/position'

import { getPoolClientForChain } from './apollo'

const MAX_SUBGRAPH_BLOCK_LAG = 20
const MAX_SUBGRAPH_POSITIONS = 1_000
const ZERO = BigNumber.from(0)

const TAIKO_USER_POSITIONS_QUERY = gql`
  query TaikoUserPositionsForPools($account: Bytes!) {
    _meta {
      block {
        number
      }
      hasIndexingErrors
    }
    positions(first: 1000, orderBy: id, orderDirection: asc, where: { owner: $account }) {
      id
      liquidity
      feeTier
      tickLower
      tickUpper
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`

interface TaikoPosition {
  id: string
  liquidity: string
  feeTier: string
  tickLower: string
  tickUpper: string
  token0: { id: string }
  token1: { id: string }
}

interface TaikoPositionsData {
  _meta?: {
    block?: { number: number }
    hasIndexingErrors?: boolean
  }
  positions: TaikoPosition[]
}

interface TaikoPositionsResult {
  loading: boolean
  positions?: PositionDetails[]
  fallbackToRpc: boolean
}

function mapPosition(position: TaikoPosition): PositionDetails {
  const fee = Number(position.feeTier)
  const tickLower = Number(position.tickLower)
  const tickUpper = Number(position.tickUpper)
  if (
    ![fee, tickLower, tickUpper].every(Number.isSafeInteger) ||
    !isAddress(position.token0.id) ||
    !isAddress(position.token1.id)
  ) {
    throw new Error('Invalid Taiko position value')
  }

  return {
    tokenId: BigNumber.from(position.id),
    fee,
    liquidity: BigNumber.from(position.liquidity),
    tickLower,
    tickUpper,
    token0: position.token0.id,
    token1: position.token1.id,
    nonce: ZERO,
    operator: AddressZero,
    feeGrowthInside0LastX128: ZERO,
    feeGrowthInside1LastX128: ZERO,
    tokensOwed0: ZERO,
    tokensOwed1: ZERO,
  }
}

export function useTaikoV3Positions(
  chainId: number | undefined,
  account: string | null | undefined
): TaikoPositionsResult {
  const latestBlock = useBlockNumber()
  const enabled = !!chainId && isTaikoChain(chainId) && !!account
  const client = enabled ? getPoolClientForChain(chainId) : undefined
  const { data, loading, error } = useQuery<TaikoPositionsData>(TAIKO_USER_POSITIONS_QUERY, {
    client,
    variables: { account: account?.toLowerCase() ?? '' },
    skip: !client || !account,
    fetchPolicy: 'cache-and-network',
  })

  return useMemo(() => {
    if (!enabled) return { loading: false, fallbackToRpc: false }
    if (!client || error) return { loading: false, fallbackToRpc: true }
    if (loading && !data) return { loading: true, fallbackToRpc: false }

    const indexedBlock = data?._meta?.block?.number
    const isStale =
      latestBlock !== undefined &&
      indexedBlock !== undefined &&
      latestBlock - indexedBlock > MAX_SUBGRAPH_BLOCK_LAG
    if (
      !data ||
      !Number.isSafeInteger(indexedBlock) ||
      data._meta?.hasIndexingErrors ||
      isStale ||
      !Array.isArray(data.positions) ||
      data.positions.length >= MAX_SUBGRAPH_POSITIONS
    ) {
      return { loading: false, fallbackToRpc: true }
    }

    try {
      return {
        loading: false,
        positions: data.positions.map(mapPosition),
        fallbackToRpc: false,
      }
    } catch {
      return { loading: false, fallbackToRpc: true }
    }
  }, [client, data, enabled, error, latestBlock, loading])
}
```

- [ ] **Step 4: Run the focused test and make assertion-only adjustments if required**

Run:

```bash
yarn test src/graphql/taiko/TaikoPositions.test.ts --watchAll=false
```

Expected: PASS for both Taiko networks and every fallback case.

- [ ] **Step 5: Run focused lint and typecheck**

Run:

```bash
yarn eslint src/graphql/taiko/TaikoPositions.ts src/graphql/taiko/TaikoPositions.test.ts
yarn typecheck
```

Expected: both commands exit successfully.

- [ ] **Step 6: Commit the query boundary**

```bash
git add src/graphql/taiko/TaikoPositions.ts src/graphql/taiko/TaikoPositions.test.ts
git commit -m "feat: query Taiko positions from the subgraph"
```

### Task 2: Route `/pools` through the Taiko fast path

**Files:**
- Modify: `src/hooks/useV3Positions.ts`
- Create: `src/hooks/useV3Positions.test.ts`

- [ ] **Step 1: Write failing source-selection tests**

Create `src/hooks/useV3Positions.test.ts`:

```typescript
import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { useTaikoV3Positions } from 'graphql/taiko/TaikoPositions'
import { useSingleCallResult, useSingleContractMultipleData } from 'lib/hooks/multicall'
import { mocked } from 'test-utils/mocked'
import { renderHook } from 'test-utils/render'

import { useV3NFTPositionManagerContract } from './useContract'
import { useV3Positions } from './useV3Positions'

jest.mock('graphql/taiko/TaikoPositions')
jest.mock('lib/hooks/multicall')
jest.mock('./useContract')

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const POSITION_MANAGER = {} as ReturnType<typeof useV3NFTPositionManagerContract>
const GRAPH_POSITION = {
  tokenId: BigNumber.from(42),
  fee: 3000,
  liquidity: BigNumber.from(1),
  tickLower: -120,
  tickUpper: 120,
  token0: '0x2222222222222222222222222222222222222222',
  token1: '0x3333333333333333333333333333333333333333',
  nonce: BigNumber.from(0),
  operator: '0x0000000000000000000000000000000000000000',
  feeGrowthInside0LastX128: BigNumber.from(0),
  feeGrowthInside1LastX128: BigNumber.from(0),
  tokensOwed0: BigNumber.from(0),
  tokensOwed1: BigNumber.from(0),
}

beforeEach(() => {
  jest.resetAllMocks()
  mocked(useV3NFTPositionManagerContract).mockReturnValue(POSITION_MANAGER)
  mocked(useSingleCallResult).mockReturnValue({ loading: false } as ReturnType<typeof useSingleCallResult>)
  mocked(useSingleContractMultipleData).mockReturnValue([])
})

it('uses the healthy Taiko subgraph result without RPC enumeration', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: TAIKO_MAINNET_CHAIN_ID } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    positions: [GRAPH_POSITION],
    fallbackToRpc: false,
  })

  const { result } = renderHook(() => useV3Positions(ACCOUNT))

  expect(result.current.positions).toEqual([GRAPH_POSITION])
  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [undefined])
})

it('restores RPC enumeration when the Taiko subgraph is unavailable', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: TAIKO_MAINNET_CHAIN_ID } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    fallbackToRpc: true,
  })

  renderHook(() => useV3Positions(ACCOUNT))

  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [ACCOUNT])
})

it('keeps the existing RPC path on non-Taiko chains', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: ChainId.MAINNET } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    fallbackToRpc: false,
  })

  renderHook(() => useV3Positions(ACCOUNT))

  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [ACCOUNT])
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
yarn test src/hooks/useV3Positions.test.ts --watchAll=false
```

Expected: FAIL because `useV3Positions` does not call the Taiko hook or suppress RPC enumeration.

- [ ] **Step 3: Extract the existing RPC implementation and add source selection**

Modify `src/hooks/useV3Positions.ts`:

```typescript
import { useWeb3React } from '@web3-react/core'
import { isTaikoChain } from 'config/chains/taiko'
import { useTaikoV3Positions } from 'graphql/taiko/TaikoPositions'
```

Rename the current exported implementation to:

```typescript
function useV3PositionsFromRpc(account: string | null | undefined): UseV3PositionsResults {
  // Existing implementation remains unchanged.
}
```

Add the public selector:

```typescript
export function useV3Positions(account: string | null | undefined): UseV3PositionsResults {
  const { chainId } = useWeb3React()
  const taikoPositions = useTaikoV3Positions(chainId, account)
  const useHealthyTaikoSubgraph = !!chainId && isTaikoChain(chainId) && !taikoPositions.fallbackToRpc
  const rpcPositions = useV3PositionsFromRpc(useHealthyTaikoSubgraph ? undefined : account)

  return useHealthyTaikoSubgraph
    ? {
        loading: taikoPositions.loading,
        positions: taikoPositions.positions,
      }
    : rpcPositions
}
```

Do not change `useV3PositionFromTokenId`; detail pages must remain on live RPC.

- [ ] **Step 4: Run both focused suites**

Run:

```bash
yarn test src/hooks/useV3Positions.test.ts src/graphql/taiko/TaikoPositions.test.ts --watchAll=false
```

Expected: PASS.

- [ ] **Step 5: Run the existing page tests**

Run:

```bash
yarn test src/pages/Pool/index.test.tsx src/pages/Pool/PositionPage.test.tsx --watchAll=false
```

Expected: PASS with the existing page behavior unchanged.

- [ ] **Step 6: Run lint and typecheck**

Run:

```bash
yarn eslint src/hooks/useV3Positions.ts src/hooks/useV3Positions.test.ts
yarn typecheck
```

Expected: both commands exit successfully.

- [ ] **Step 7: Commit source selection**

```bash
git add src/hooks/useV3Positions.ts src/hooks/useV3Positions.test.ts
git commit -m "feat: load Taiko pool positions from the subgraph"
```

### Task 3: Verify scope and publish

**Files:**
- Verify: `docs/superpowers/specs/2026-07-26-taiko-pools-subgraph-loading-design.md`
- Verify: `docs/superpowers/plans/2026-07-26-taiko-pools-subgraph-loading.md`
- Verify: `src/graphql/taiko/TaikoPositions.ts`
- Verify: `src/graphql/taiko/TaikoPositions.test.ts`
- Verify: `src/hooks/useV3Positions.ts`
- Verify: `src/hooks/useV3Positions.test.ts`

- [ ] **Step 1: Run the complete focused validation**

```bash
yarn test src/graphql/taiko/TaikoPositions.test.ts src/hooks/useV3Positions.test.ts src/pages/Pool/index.test.tsx src/pages/Pool/PositionPage.test.tsx --watchAll=false
yarn eslint src/graphql/taiko/TaikoPositions.ts src/graphql/taiko/TaikoPositions.test.ts src/hooks/useV3Positions.ts src/hooks/useV3Positions.test.ts
yarn typecheck
```

Expected: all tests, lint, and typechecking pass.

- [ ] **Step 2: Review the complete diff against current remote main**

```bash
git fetch origin main --quiet
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
git status --short --branch
```

Expected: only the six files listed above are committed. Root `.superpowers/`
remains untracked and absent from the diff.

- [ ] **Step 3: Run the pre-landing review**

Apply the `@review` checklist to the full diff. Resolve all actionable findings
and rerun the focused validation after any fix.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin codex/taiko-pools-subgraph
```

Expected: the branch is published to `taikoxyz/uniswap-interface`.

- [ ] **Step 5: Create the draft pull request**

Create `/tmp/taiko-pools-subgraph-pr-body.md` with `apply_patch` and this
content:

```markdown
## Summary

- load connected-wallet `/pools` positions from the Taiko pool subgraph
- support both Taiko mainnet and Taiko Hoodi through their existing configured clients
- fall back to RPC enumeration for unavailable, unhealthy, stale, malformed, or capped subgraph results

## Deployment dependency

This change depends on deploying `taikoxyz/uniswap-v3-subgraph#7` and updating
`REACT_APP_TAIKO_MAINNET_SUBGRAPH_POOLS` and
`REACT_APP_TAIKO_HOODI_SUBGRAPH_POOLS` to those deployed versions.

The subgraph is used only for position-list discovery. Live RPC remains
authoritative for details, ownership checks, approvals, fees, transaction
preparation, and transactions.

## Validation

Passed with exit code 0:

- `yarn test src/graphql/taiko/TaikoPositions.test.ts src/hooks/useV3Positions.test.ts src/pages/Pool/index.test.tsx src/pages/Pool/PositionPage.test.tsx --watchAll=false`
- `yarn eslint src/graphql/taiko/TaikoPositions.ts src/graphql/taiko/TaikoPositions.test.ts src/hooks/useV3Positions.ts src/hooks/useV3Positions.test.ts`
- `yarn typecheck`
```

If an executed command or result differs, replace the corresponding line with
the observed command and result before creating the PR; never claim a passing
check that did not pass.

Then use local `gh` with explicit repository, base, and body file:

```bash
gh pr create \
  --repo taikoxyz/uniswap-interface \
  --base main \
  --head codex/taiko-pools-subgraph \
  --draft \
  --title "Load Taiko pool positions from the subgraph" \
  --body-file /tmp/taiko-pools-subgraph-pr-body.md
```

The PR body must note:

- dependency on deployment of `taikoxyz/uniswap-v3-subgraph#7`;
- both Taiko mainnet and Hoodi use their existing pool-subgraph environment URLs;
- automatic fallback conditions;
- live RPC remains authoritative for details and actions; and
- exact validation commands and results.
