import { ParentSize } from '@visx/responsive'
import { ChartContainer, LoadingChart } from 'components/Tokens/TokenDetails/Skeleton'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { TokenPriceQuery } from 'graphql/data/TokenPrice'
import { isPricePoint, PricePoint } from 'graphql/data/util'
import { TimePeriod } from 'graphql/data/util'
import { useTaikoTokenPriceHistory } from 'graphql/taiko/TaikoTokenPrice'
import { useAtomValue } from 'jotai'
import { pageTimePeriodAtom } from 'pages/TokenDetails'
import { startTransition, Suspense, useMemo } from 'react'

import { PriceChart } from '../../Charts/PriceChart'
import TimePeriodSelector from './TimeSelector'

function usePriceHistory(tokenPriceData: TokenPriceQuery): PricePoint[] | undefined {
  // Appends the current price to the end of the priceHistory array
  const priceHistory = useMemo(() => {
    const market = tokenPriceData.token?.market
    const priceHistory = market?.priceHistory?.filter(isPricePoint)
    const currentPrice = market?.price?.value
    if (Array.isArray(priceHistory) && currentPrice !== undefined) {
      const timestamp = Date.now() / 1000
      return [...priceHistory, { timestamp, value: currentPrice }]
    }
    return priceHistory
  }, [tokenPriceData])

  return priceHistory
}
export default function ChartSection({
  tokenPriceQuery,
  chainId,
  tokenAddress,
  onChangeTimePeriod,
}: {
  tokenPriceQuery?: TokenPriceQuery
  chainId?: number
  tokenAddress?: string
  onChangeTimePeriod: OnChangeTimePeriod
}) {
  // For Taiko chains, use Goldsky subgraph data instead of AWS backend
  const isTaikoChain = chainId === TAIKO_HOODI_CHAIN_ID || chainId === TAIKO_MAINNET_CHAIN_ID

  if (!isTaikoChain && !tokenPriceQuery) {
    return <LoadingChart />
  }

  return (
    <Suspense fallback={<LoadingChart />}>
      <ChartContainer>
        <Chart
          tokenPriceQuery={tokenPriceQuery}
          chainId={chainId}
          tokenAddress={tokenAddress}
          onChangeTimePeriod={onChangeTimePeriod}
        />
      </ChartContainer>
    </Suspense>
  )
}

export type OnChangeTimePeriod = (t: TimePeriod) => void
function Chart({
  tokenPriceQuery,
  chainId,
  tokenAddress,
  onChangeTimePeriod,
}: {
  tokenPriceQuery?: TokenPriceQuery
  chainId?: number
  tokenAddress?: string
  onChangeTimePeriod: OnChangeTimePeriod
}) {
  // Initializes time period to global & maintain separate time period for subsequent changes
  const timePeriod = useAtomValue(pageTimePeriodAtom)

  // For Taiko chains, fetch data from Goldsky subgraph
  const isTaikoChain = chainId === TAIKO_HOODI_CHAIN_ID || chainId === TAIKO_MAINNET_CHAIN_ID
  const { priceHistory: taikoPriceHistory } = useTaikoTokenPriceHistory(
    chainId ?? 0,
    tokenAddress ?? '',
    timePeriod
  )

  // For non-Taiko chains, use standard AWS backend price history
  const standardPriceHistory = usePriceHistory(tokenPriceQuery ?? ({} as TokenPriceQuery))

  // Use Taiko price history for Taiko chains, otherwise use standard price history
  const prices = isTaikoChain ? taikoPriceHistory : standardPriceHistory

  return (
    <ChartContainer data-testid="chart-container">
      <ParentSize>
        {({ width }) => <PriceChart prices={prices} width={width} height={392} timePeriod={timePeriod} />}
      </ParentSize>
      <TimePeriodSelector
        currentTimePeriod={timePeriod}
        onTimeChange={(t: TimePeriod) => {
          startTransition(() => onChangeTimePeriod(t))
        }}
      />
    </ChartContainer>
  )
}
