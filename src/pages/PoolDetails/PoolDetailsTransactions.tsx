import { Trans } from '@lingui/macro'
import { ChainId } from '@uniswap/sdk-core'
import Column from 'components/Column'
import { isTaikoChain } from 'config/chains/taiko'
import { getPoolClientForChain as getTaikoPoolClient } from 'graphql/taiko/apollo'
import {
    PoolBurn,
    PoolMint,
    PoolSwap,
    TransactionType,
    usePoolTransactionsQuery,
} from 'graphql/thegraph/__generated__/types-and-hooks'
import { chainToApolloClient } from 'graphql/thegraph/apollo'
import { useState } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme'
import { ExplorerDataType, getExplorerLink } from 'utils/getExplorerLink'

const TransactionsContainer = styled(Column)`
  gap: 16px;
  width: 100%;
`

const Table = styled.div`
  width: 100%;
  border-radius: 16px;
  background: ${({ theme }) => theme.surface2};
  overflow: hidden;
`

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 100px 120px 140px 1fr 160px;
  padding: 12px 20px;
  background: ${({ theme }) => theme.surface3};
  border-bottom: 1px solid ${({ theme }) => theme.surface3};
  gap: 12px;
`

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 100px 120px 140px 1fr 160px;
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.surface3};
  transition: background-color 0.1s ease;
  gap: 12px;
  align-items: center;

  &:hover {
    background: ${({ theme }) => theme.surface3};
  }

  &:last-child {
    border-bottom: none;
  }
`

const HeaderCell = styled(ThemedText.BodySecondary)`
  color: ${({ theme }) => theme.neutral2};
  font-weight: 500;
  font-size: 14px;
`

const TableCell = styled(ThemedText.BodyPrimary)`
  display: flex;
  align-items: center;
  font-size: 14px;
`

const TokenAmountsCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
`

interface TypeBadgeProps {
  $type: TransactionType
}

const TypeBadge = styled.div<TypeBadgeProps>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ $type, theme }) => {
    switch ($type) {
      case TransactionType.SWAP:
        return theme.accent1 + '20'
      case TransactionType.MINT:
        return theme.success + '20'
      case TransactionType.BURN:
        return theme.critical + '20'
      default:
        return theme.surface3
    }
  }};
  color: ${({ $type, theme }) => {
    switch ($type) {
      case TransactionType.SWAP:
        return theme.accent1
      case TransactionType.MINT:
        return theme.success
      case TransactionType.BURN:
        return theme.critical
      default:
        return theme.neutral1
    }
  }};
`

const Address = styled.a`
  font-family: 'Courier New', monospace;
  color: ${({ theme }) => theme.accent1};
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

const LoadMoreButton = styled.button`
  padding: 12px 24px;
  background: ${({ theme }) => theme.surface3};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 12px;
  color: ${({ theme }) => theme.neutral1};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s ease;
  align-self: center;

  &:hover {
    background: ${({ theme }) => theme.surface2};
    border-color: ${({ theme }) => theme.accent1};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

interface PoolDetailsTransactionsProps {
  poolAddress: string
  chainId?: number
  token0Symbol: string
  token1Symbol: string
}

interface TransactionWithType {
  id: string
  timestamp: string
  type: TransactionType
  amountUSD: string
  amount0: string
  amount1: string
  origin: string
  txHash: string
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const txTime = parseInt(timestamp) * 1000
  const diff = now - txTime

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

function formatUSD(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '$0.00'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatTokenAmount(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '0'
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(4)
}

function truncateAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.SWAP:
      return 'Swap'
    case TransactionType.MINT:
      return 'Add'
    case TransactionType.BURN:
      return 'Remove'
    default:
      return type
  }
}

export function PoolDetailsTransactions({
  poolAddress,
  chainId = ChainId.MAINNET,
  token0Symbol,
  token1Symbol,
}: PoolDetailsTransactionsProps) {
  const [itemsToShow, setItemsToShow] = useState(10)

  const isTaiko = isTaikoChain(chainId)
  const apolloClient = isTaiko ? getTaikoPoolClient(chainId) : chainToApolloClient[chainId]

  const { data, loading } = usePoolTransactionsQuery({
    variables: {
      poolAddress: poolAddress.toLowerCase(),
      first: itemsToShow,
    },
    client: apolloClient,
  })

  const allTransactions: TransactionWithType[] = []

  if (data) {
    const swaps: TransactionWithType[] =
      data.swaps?.map((swap: PoolSwap) => ({
        id: swap.id,
        timestamp: swap.timestamp,
        type: TransactionType.SWAP,
        amountUSD: swap.amountUSD,
        amount0: swap.amount0,
        amount1: swap.amount1,
        origin: swap.origin,
        txHash: swap.transaction.id,
      })) || []

    const mints: TransactionWithType[] =
      data.mints?.map((mint: PoolMint) => ({
        id: mint.id,
        timestamp: mint.timestamp,
        type: TransactionType.MINT,
        amountUSD: mint.amountUSD,
        amount0: mint.amount0,
        amount1: mint.amount1,
        origin: mint.origin,
        txHash: mint.transaction.id,
      })) || []

    const burns: TransactionWithType[] =
      data.burns?.map((burn: PoolBurn) => ({
        id: burn.id,
        timestamp: burn.timestamp,
        type: TransactionType.BURN,
        amountUSD: burn.amountUSD,
        amount0: burn.amount0,
        amount1: burn.amount1,
        origin: burn.origin,
        txHash: burn.transaction.id,
      })) || []

    allTransactions.push(...swaps, ...mints, ...burns)
    allTransactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
  }

  const displayedTransactions = allTransactions.slice(0, itemsToShow)
  const hasMore = allTransactions.length > displayedTransactions.length

  if (loading && displayedTransactions.length === 0) {
    return (
      <TransactionsContainer>
        <ThemedText.HeadlineMedium>
          <Trans>Recent Transactions</Trans>
        </ThemedText.HeadlineMedium>
        <ThemedText.BodySecondary>
          <Trans>Loading...</Trans>
        </ThemedText.BodySecondary>
      </TransactionsContainer>
    )
  }

  if (!data || displayedTransactions.length === 0) {
    return (
      <TransactionsContainer>
        <ThemedText.HeadlineMedium>
          <Trans>Recent Transactions</Trans>
        </ThemedText.HeadlineMedium>
        <ThemedText.BodySecondary>
          <Trans>No transactions found</Trans>
        </ThemedText.BodySecondary>
      </TransactionsContainer>
    )
  }

  return (
    <TransactionsContainer>
      <ThemedText.HeadlineMedium>
        <Trans>Recent Transactions</Trans>
      </ThemedText.HeadlineMedium>

      <Table>
        <TableHeader>
          <HeaderCell>
            <Trans>Time</Trans>
          </HeaderCell>
          <HeaderCell>
            <Trans>Type</Trans>
          </HeaderCell>
          <HeaderCell>
            <Trans>USD Value</Trans>
          </HeaderCell>
          <HeaderCell>
            <Trans>Token Amounts</Trans>
          </HeaderCell>
          <HeaderCell>
            <Trans>Wallet</Trans>
          </HeaderCell>
        </TableHeader>

        {displayedTransactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell>{formatRelativeTime(tx.timestamp)}</TableCell>
            <TableCell>
              <TypeBadge $type={tx.type}>{getTypeLabel(tx.type)}</TypeBadge>
            </TableCell>
            <TableCell>{formatUSD(tx.amountUSD)}</TableCell>
            <TokenAmountsCell>
              <ThemedText.BodyPrimary>
                {formatTokenAmount(tx.amount0)} {token0Symbol}
              </ThemedText.BodyPrimary>
              <ThemedText.BodySecondary fontSize={12}>
                {formatTokenAmount(tx.amount1)} {token1Symbol}
              </ThemedText.BodySecondary>
            </TokenAmountsCell>
            <TableCell>
              <Address
                href={getExplorerLink(chainId, tx.origin, ExplorerDataType.ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {truncateAddress(tx.origin)}
              </Address>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      {hasMore && (
        <LoadMoreButton onClick={() => setItemsToShow((prev) => prev + 10)}>
          <Trans>Load more</Trans>
        </LoadMoreButton>
      )}
    </TransactionsContainer>
  )
}
