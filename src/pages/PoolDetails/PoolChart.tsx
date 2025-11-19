import { AxisBottom, AxisLeft } from '@visx/axis'
import { curveCardinal } from '@visx/curve'
import { localPoint } from '@visx/event'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath, Bar } from '@visx/shape'
import { defaultStyles, TooltipWithBounds, useTooltip } from '@visx/tooltip'
import * as d3 from 'd3-array'
import { ChartDataPoint } from 'graphql/thegraph/PoolChartData'
import { useCallback, useMemo } from 'react'
import styled, { useTheme } from 'styled-components'
import { ThemedText } from 'theme'

const TooltipContainer = styled.div`
  padding: 8px 12px;
  background: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 8px;
`

const TooltipRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

interface PoolChartProps {
  data: ChartDataPoint[]
  width: number
  height: number
  chartType: 'VOLUME' | 'TVL'
}

const margin = { top: 20, right: 20, bottom: 40, left: 80 }

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatAxisDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const bisectDate = d3.bisector<ChartDataPoint, number>((d: ChartDataPoint) => d.timestamp).left

export function PoolChart({ data, width, height, chartType }: PoolChartProps) {
  const theme = useTheme()
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<ChartDataPoint>()

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xScale = useMemo(
    () =>
      scaleTime({
        domain: [Math.min(...data.map((d) => d.timestamp)), Math.max(...data.map((d) => d.timestamp))],
        range: [0, innerWidth],
      }),
    [data, innerWidth]
  )

  const yScale = useMemo(() => {
    const values = data.map((d) => (chartType === 'VOLUME' ? d.volumeUSD : d.tvlUSD))
    return scaleLinear({
      domain: [0, Math.max(...values) * 1.1],
      range: [innerHeight, 0],
    })
  }, [data, innerHeight, chartType])

  const getX = useCallback((d: ChartDataPoint) => xScale(d.timestamp) || 0, [xScale])
  const getY = useCallback(
    (d: ChartDataPoint) => yScale(chartType === 'VOLUME' ? d.volumeUSD : d.tvlUSD) || 0,
    [yScale, chartType]
  )

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event) || { x: 0 }
      const x0 = xScale.invert(point.x - margin.left)
      const index = bisectDate(data, x0.getTime() / 1000, 1)
      const d0 = data[index - 1]
      const d1 = data[index]
      let d = d0
      if (d1 && d0) {
        d = x0.getTime() / 1000 - d0.timestamp > d1.timestamp - x0.getTime() / 1000 ? d1 : d0
      }
      if (d) {
        showTooltip({
          tooltipData: d,
          tooltipLeft: getX(d) + margin.left,
          tooltipTop: getY(d) + margin.top,
        })
      }
    },
    [xScale, data, getX, getY, showTooltip]
  )

  if (data.length === 0) {
    return null
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={innerWidth} strokeDasharray="3,3" stroke={theme.surface3} />
          <LinePath
            data={data}
            x={getX}
            y={getY}
            stroke={theme.accent1}
            strokeWidth={2}
            curve={curveCardinal}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={5}
            stroke={theme.surface3}
            tickStroke={theme.surface3}
            tickLabelProps={() => ({
              fill: theme.neutral2,
              fontSize: 12,
              textAnchor: 'middle',
            })}
            tickFormat={(value) => formatAxisDate((value as Date).getTime() / 1000)}
          />
          <AxisLeft
            scale={yScale}
            numTicks={5}
            stroke={theme.surface3}
            tickStroke={theme.surface3}
            tickLabelProps={() => ({
              fill: theme.neutral2,
              fontSize: 12,
              textAnchor: 'end',
              dx: -4,
            })}
            tickFormat={(value) => formatValue(value as number)}
          />
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onTouchStart={handleTooltip}
            onTouchMove={handleTooltip}
            onMouseMove={handleTooltip}
            onMouseLeave={() => hideTooltip()}
          />
          {tooltipData && (
            <g>
              <circle
                cx={getX(tooltipData)}
                cy={getY(tooltipData)}
                r={4}
                fill={theme.accent1}
                stroke="white"
                strokeWidth={2}
                pointerEvents="none"
              />
            </g>
          )}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
        >
          <TooltipContainer>
            <TooltipRow>
              <ThemedText.BodySmall color="neutral2">{formatDate(tooltipData.timestamp)}</ThemedText.BodySmall>
              <ThemedText.BodyPrimary>
                {chartType === 'VOLUME' ? formatValue(tooltipData.volumeUSD) : formatValue(tooltipData.tvlUSD)}
              </ThemedText.BodyPrimary>
            </TooltipRow>
          </TooltipContainer>
        </TooltipWithBounds>
      )}
    </div>
  )
}
