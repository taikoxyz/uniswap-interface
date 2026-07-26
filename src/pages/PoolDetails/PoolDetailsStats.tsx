import { Trans } from '@lingui/macro'
import { ChainId } from '@uniswap/sdk-core'
import Column from 'components/Column'
import Row from 'components/Row'
import { usePoolHistoricalData } from 'graphql/thegraph/PoolHistoricalData'
import styled from 'styled-components'
import { ThemedText } from 'theme'

const StatsContainer = styled(Column)`
  gap: 24px;
  padding: 24px;
  background: ${({ theme }) => theme.surface2};
  border-radius: 16px;
`

const StatRow = styled(Row)`
  justify-content: space-between;
  align-items: flex-start;
`

const StatLabel = styled(ThemedText.BodySecondary)`
  color: ${({ theme }) => theme.neutral2};
`

const StatValue = styled(ThemedText.HeadlineSmall)``

const PoolBalancesContainer = styled(Column)`
  gap: 8px;
`

const BalanceRow = styled(Row)`
  justify-content: space-between;
  align-items: center;
`

const BalanceBar = styled.div`
  height: 8px;
  background: linear-gradient(90deg, #5D9AFF 50%, #E74694 50%);
  border-radius: 4px;
  margin-top: 8px;
`

const PercentageChange = styled(ThemedText.BodySmall)<{ positive: boolean }>`
  color: ${({ positive, theme }) => (positive ? theme.success : theme.critical)};
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: 535;
`

interface Token {
  symbol: string
  name: string
  decimals: string
}

interface PoolData {
  liquidity?: string
  totalValueLockedUSD?: string
  totalValueLockedToken0?: string
  totalValueLockedToken1?: string
  volumeUSD?: string
  token0?: Token
  token1?: Token
  feeTier?: string
}

interface PoolDetailsStatsProps {
  poolData?: PoolData
  poolAddress?: string
  chainId?: ChainId
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

function formatTokenAmount(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '0'

  // The subgraph already returns human-readable amounts (not wei)
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`
  }
  if (num >= 1) {
    return num.toFixed(2)
  }
  if (num >= 0.0001) {
    return num.toFixed(4)
  }
  // For very small amounts, use exponential notation or more decimals
  if (num > 0) {
    return num.toFixed(6)
  }
  return '0'
}

export function PoolDetailsStats({ poolData, poolAddress, chainId }: PoolDetailsStatsProps) {
  // Fetch historical data for percentage change calculations
  const { data: historicalData } = usePoolHistoricalData(poolAddress || '', chainId, 1)

  if (!poolData) return null

  const tvl = poolData.totalValueLockedUSD ? parseFloat(poolData.totalValueLockedUSD) : 0
  const volume = poolData.volumeUSD ? parseFloat(poolData.volumeUSD) : 0
  const feeTier = poolData.feeTier ? parseInt(poolData.feeTier) / 10000 : 0
  const fees = volume * (feeTier / 100)

  // Calculate APR: (24H Fees / TVL) * 365 * 100
  const apr = tvl > 0 ? (fees / tvl) * 365 * 100 : 0

  // Calculate percentage changes
  const previousTvl = historicalData?.tvlUSD ? parseFloat(historicalData.tvlUSD) : 0
  const previousVolume = historicalData?.volumeUSD ? parseFloat(historicalData.volumeUSD) : 0

  const tvlChange = previousTvl > 0 ? ((tvl - previousTvl) / previousTvl) * 100 : 0
  const volumeChange = previousVolume > 0 ? ((volume - previousVolume) / previousVolume) * 100 : 0

  const token0Amount = poolData.totalValueLockedToken0
    ? formatTokenAmount(poolData.totalValueLockedToken0)
    : '0'
  const token1Amount = poolData.totalValueLockedToken1
    ? formatTokenAmount(poolData.totalValueLockedToken1)
    : '0'

  return (
    <StatsContainer>
      <ThemedText.HeadlineMedium>
        <Trans>Stats</Trans>
      </ThemedText.HeadlineMedium>

      <PoolBalancesContainer>
        <StatLabel>
          <Trans>Pool balances</Trans>
        </StatLabel>
        <BalanceRow>
          <ThemedText.BodyPrimary>
            {token0Amount} {poolData.token0?.symbol}
          </ThemedText.BodyPrimary>
          <ThemedText.BodyPrimary>
            {token1Amount} {poolData.token1?.symbol}
          </ThemedText.BodyPrimary>
        </BalanceRow>
        <BalanceBar />
      </PoolBalancesContainer>

      <StatRow>
        <Column gap="xs">
          <StatLabel>
            <Trans>Total APR</Trans>
          </StatLabel>
          <StatValue style={{ color: '#1C6E42' }}>{apr.toFixed(2)}%</StatValue>
        </Column>
      </StatRow>

      <StatRow>
        <Column gap="xs">
          <StatLabel>
            <Trans>TVL</Trans>
          </StatLabel>
          <Row gap="sm" align="center">
            <StatValue>{formatNumber(tvl)}</StatValue>
            {historicalData && tvlChange !== 0 && (
              <PercentageChange positive={tvlChange > 0}>
                {tvlChange > 0 ? '↑' : '↓'} {Math.abs(tvlChange).toFixed(2)}%
              </PercentageChange>
            )}
          </Row>
        </Column>
      </StatRow>

      <StatRow>
        <Column gap="xs">
          <StatLabel>
            <Trans>24H volume</Trans>
          </StatLabel>
          <Row gap="sm" align="center">
            <StatValue>{formatNumber(volume)}</StatValue>
            {historicalData && volumeChange !== 0 && (
              <PercentageChange positive={volumeChange > 0}>
                {volumeChange > 0 ? '↑' : '↓'} {Math.abs(volumeChange).toFixed(2)}%
              </PercentageChange>
            )}
          </Row>
        </Column>
      </StatRow>

      <StatRow>
        <Column gap="xs">
          <StatLabel>
            <Trans>24H fees</Trans>
          </StatLabel>
          <StatValue>{formatNumber(fees)}</StatValue>
        </Column>
      </StatRow>
    </StatsContainer>
  )
}
