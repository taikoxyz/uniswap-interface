# Taiko Pools Subgraph Loading Design

## Goal

Use the position ownership index introduced by
`taikoxyz/uniswap-v3-subgraph#7` to load the connected wallet's V3 positions
on `/pools` for Taiko mainnet and Taiko Hoodi. The subgraph should remove the
balance, owner-enumeration, and position-detail RPC reads from the normal list
loading path without becoming authoritative for position actions.

## Scope

The change applies only to the active-chain `/pools` position list on Taiko
mainnet and Taiko Hoodi. Existing behavior remains unchanged for other chains.
Position detail pages, ownership checks, approvals, fees, transaction
preparation, and transaction submission continue to use live contract reads.

The integration uses the existing per-chain pool subgraph clients and their
`REACT_APP_TAIKO_MAINNET_SUBGRAPH_POOLS` and
`REACT_APP_TAIKO_HOODI_SUBGRAPH_POOLS` endpoints. Deployment must update those
endpoints to versions containing the schema from subgraph PR #7 before enabling
the fast path.

## Data Flow

1. When `/pools` has a connected wallet on Taiko or Hoodi, query `positions`
   by the lowercase owner address.
2. Request only the fields the list renders: token ID, token addresses, fee
   tier, ticks, and liquidity, plus `_meta` indexing health.
3. Convert GraphQL string values into the existing `PositionDetails` shape.
   Fields not used by the list remain zero-valued compatibility fields; live
   detail hooks continue to populate authoritative values elsewhere.
4. Return the subgraph result through the existing `useV3Positions` API so the
   page and list components require no behavioral changes.
5. For non-Taiko chains, keep the current RPC path unchanged.

## Fallback and Correctness

The existing RPC loader is retained and activated when:

- the configured Taiko pool client is unavailable;
- the query fails, takes more than 10 seconds to return its first result, or
  conversion fails;
- `_meta.hasIndexingErrors` is true;
- the indexed block is more than 20 blocks behind the active chain or more
  than two blocks ahead of it;
- a position contains unsupported V3 fee/tick values or values outside their
  contract integer bounds; or
- the query reaches the 1,000-position page limit, avoiding silent truncation.

While the Taiko subgraph query is healthy, the RPC loader receives no account
and therefore does not enumerate positions. A missing wallet skips both paths.

## Testing

Focused tests cover:

- mapping valid subgraph positions into the existing list data shape;
- Taiko mainnet and Hoodi client selection;
- healthy, timed-out, stale/future, indexing-error, malformed, and
  1,000-position-limit results;
- fallback selection in `useV3Positions`; and
- unchanged RPC selection on non-Taiko chains.

Validation also includes TypeScript typechecking, focused Jest tests, ESLint,
and a final diff review against the current remote `main` branch.
