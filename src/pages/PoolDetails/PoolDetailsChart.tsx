import { Trans } from '@lingui/macro'
import { ChainId } from '@uniswap/sdk-core'
import { ParentSize } from '@visx/responsive'
import Column from 'components/Column'
import Row from 'components/Row'
import { TimePeriod } from 'graphql/data/util'
import { ChartDataPoint, usePoolChartData } from 'graphql/thegraph/PoolChartData'
import { useState } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme'

import { PoolChart } from './PoolChart'

const ChartContainer = styled(Column)`
  gap: 16px;
  padding: 24px;
  background: ${({ theme }) => theme.surface2};
  border-radius: 16px;
  width: 100%;
`

const ChartHeader = styled(Row)`
  justify-content: space-between;
  align-items: center;
  width: 100%;
`

const ToggleRow = styled(Row)`
  gap: 8px;
`

const ToggleButton = styled.button<{ active: boolean }>`
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: ${({ theme, active }) => (active ? theme.surface3 : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.neutral1 : theme.neutral2)};
  font-weight: 535;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: ${({ active }) => (active ? 1 : 0.7)};
  }
`

const TimePeriodRow = styled(Row)`
  gap: 4px;
`

const TimePeriodButton = styled.button<{ active: boolean }>`
  padding: 6px 12px;
  border-radius: 12px;
  border: none;
  background: ${({ theme, active }) => (active ? theme.surface3 : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.neutral1 : theme.neutral2)};
  font-weight: 535;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: ${({ active }) => (active ? 1 : 0.7)};
  }
`

const ChartWrapper = styled.div`
  width: 100%;
  height: 400px;
`

const TIME_PERIODS = [
  { value: TimePeriod.HOUR, label: '1H' },
  { value: TimePeriod.DAY, label: '1D' },
  { value: TimePeriod.WEEK, label: '1W' },
  { value: TimePeriod.MONTH, label: '1M' },
  { value: TimePeriod.YEAR, label: '1Y' },
]

type ChartType = 'VOLUME' | 'TVL'

interface PoolDetailsChartProps {
  poolAddress: string
  chainId: ChainId | undefined
}

export function PoolDetailsChart({ poolAddress, chainId }: PoolDetailsChartProps) {
  const [chartType, setChartType] = useState<ChartType>('VOLUME')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(TimePeriod.DAY)

  const { data, loading } = usePoolChartData(poolAddress, chainId, timePeriod)

  const chartData: ChartDataPoint[] = data || []

  return (
    <ChartContainer>
      <ChartHeader>
        <ToggleRow>
          <ToggleButton active={chartType === 'VOLUME'} onClick={() => setChartType('VOLUME')}>
            <Trans>Volume</Trans>
          </ToggleButton>
          <ToggleButton active={chartType === 'TVL'} onClick={() => setChartType('TVL')}>
            <Trans>TVL</Trans>
          </ToggleButton>
        </ToggleRow>
        <TimePeriodRow>
          {TIME_PERIODS.map((period) => (
            <TimePeriodButton
              key={period.value}
              active={timePeriod === period.value}
              onClick={() => setTimePeriod(period.value)}
            >
              {period.label}
            </TimePeriodButton>
          ))}
        </TimePeriodRow>
      </ChartHeader>

      <ChartWrapper>
        {loading ? (
          <Column style={{ alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <ThemedText.BodySecondary>
              <Trans>Loading chart data...</Trans>
            </ThemedText.BodySecondary>
          </Column>
        ) : chartData.length === 0 ? (
          <Column style={{ alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <ThemedText.BodySecondary>
              <Trans>No chart data available</Trans>
            </ThemedText.BodySecondary>
          </Column>
        ) : (
          <ParentSize>
            {({ width, height }) => (
              <PoolChart data={chartData} width={width} height={height} chartType={chartType} />
            )}
          </ParentSize>
        )}
      </ChartWrapper>
    </ChartContainer>
  )
}
