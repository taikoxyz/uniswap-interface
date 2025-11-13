import { BrowserEvent, InterfaceElementName, SharedEventName } from '@uniswap/analytics-events'
import { Currency } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TraceEvent } from 'analytics'
import { useCachedPortfolioBalancesQuery } from 'components/PrefetchBalancesWrapper/PrefetchBalancesWrapper'
import Row from 'components/Row'
import { DeltaArrow, formatDelta } from 'components/Tokens/TokenDetails/Delta'
import { isTaikoChain } from 'config/chains/taiko'
import { TokenBalance } from 'graphql/data/__generated__/types-and-hooks'
import { getTokenDetailsURL, gqlToCurrency, logSentryErrorForUnsupportedChain } from 'graphql/data/util'
import { useAtomValue } from 'jotai'
import { EmptyWalletModule } from 'nft/components/profile/view/EmptyWalletContent'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { EllipsisStyle, ThemedText } from 'theme'
import { NumberType, useFormatter } from 'utils/formatNumbers'
import { splitHiddenTokens } from 'utils/splitHiddenTokens'

import { useToggleAccountDrawer } from '../..'
import { hideSmallBalancesAtom } from '../../SmallBalanceToggle'
import { ExpandoRow } from '../ExpandoRow'
import { PortfolioLogo } from '../PortfolioLogo'
import PortfolioRow, { PortfolioSkeleton, PortfolioTabWrapper } from '../PortfolioRow'
import { useTaikoTokenBalances } from './useTaikoTokenBalances'

export default function Tokens({ account }: { account: string }) {
  const { chainId } = useWeb3React()
  const toggleWalletDrawer = useToggleAccountDrawer()
  const hideSmallBalances = useAtomValue(hideSmallBalancesAtom)
  const [showHiddenTokens, setShowHiddenTokens] = useState(false)

  const isTaiko = chainId && isTaikoChain(chainId)

  // Fetch token balances differently for Taiko vs other chains
  const { balances: taikoBalances, loading: taikoLoading } = useTaikoTokenBalances(account, chainId)
  const { data } = useCachedPortfolioBalancesQuery({ account })

  const tokenBalances = data?.portfolios?.[0].tokenBalances as TokenBalance[] | undefined

  const { visibleTokens, hiddenTokens } = useMemo(
    () => splitHiddenTokens(tokenBalances ?? [], { hideSmallBalances }),
    [hideSmallBalances, tokenBalances]
  )

  // For Taiko chains, use on-chain balance fetching
  if (isTaiko) {
    if (taikoLoading) {
      return <PortfolioSkeleton />
    }

    if (taikoBalances.length === 0) {
      return <EmptyWalletModule type="token" onNavigateClick={toggleWalletDrawer} />
    }

    return (
      <PortfolioTabWrapper>
        {taikoBalances.map((tokenBalance) => (
          <TaikoTokenRow key={tokenBalance.token.address} tokenBalance={tokenBalance} />
        ))}
      </PortfolioTabWrapper>
    )
  }

  if (!data) {
    return <PortfolioSkeleton />
  }

  if (tokenBalances?.length === 0) {
    // TODO: consider launching moonpay here instead of just closing the drawer
    return <EmptyWalletModule type="token" onNavigateClick={toggleWalletDrawer} />
  }

  const toggleHiddenTokens = () => setShowHiddenTokens((showHiddenTokens) => !showHiddenTokens)

  return (
    <PortfolioTabWrapper>
      {visibleTokens.map(
        (tokenBalance) =>
          tokenBalance.token && <TokenRow key={tokenBalance.id} {...tokenBalance} token={tokenBalance.token} />
      )}
    </PortfolioTabWrapper>
  )
}

const TokenBalanceText = styled(ThemedText.BodySecondary)`
  ${EllipsisStyle}
`
const TokenNameText = styled(ThemedText.SubHeader)`
  ${EllipsisStyle}
`

// Taiko Token Row Component
function TaikoTokenRow({ tokenBalance }: { tokenBalance: { token: Currency; balance: string } }) {
  const { formatNumber } = useFormatter()
  const navigate = useNavigate()
  const toggleWalletDrawer = useToggleAccountDrawer()

  const navigateToTokenDetails = useCallback(async () => {
    navigate(getTokenDetailsURL(tokenBalance.token))
    toggleWalletDrawer()
  }, [navigate, tokenBalance.token, toggleWalletDrawer])

  const formattedBalance = useMemo(() => {
    try {
      const decimals = tokenBalance.token.decimals
      const balanceNum = parseFloat(tokenBalance.balance) / Math.pow(10, decimals)
      return balanceNum
    } catch {
      return 0
    }
  }, [tokenBalance])

  return (
    <TraceEvent
      events={[BrowserEvent.onClick]}
      name={SharedEventName.ELEMENT_CLICKED}
      element={InterfaceElementName.MINI_PORTFOLIO_TOKEN_ROW}
      properties={{ chain_id: tokenBalance.token.chainId, token_name: tokenBalance.token.name, address: tokenBalance.token.isToken ? tokenBalance.token.address : undefined }}
    >
      <PortfolioRow
        left={<PortfolioLogo chainId={tokenBalance.token.chainId} currencies={[tokenBalance.token]} size="40px" />}
        title={<TokenNameText>{tokenBalance.token.name}</TokenNameText>}
        descriptor={
          <TokenBalanceText>
            {formatNumber({
              input: formattedBalance,
              type: NumberType.TokenNonTx,
            })}{' '}
            {tokenBalance.token.symbol}
          </TokenBalanceText>
        }
        onClick={navigateToTokenDetails}
        right={
          <>
            <ThemedText.SubHeader>
              {/* No USD value available for Taiko tokens */}
              -
            </ThemedText.SubHeader>
          </>
        }
      />
    </TraceEvent>
  )
}

type PortfolioToken = NonNullable<TokenBalance['token']>

function TokenRow({ token, quantity, denominatedValue, tokenProjectMarket }: TokenBalance & { token: PortfolioToken }) {
  const percentChange = tokenProjectMarket?.pricePercentChange?.value ?? 0

  const navigate = useNavigate()
  const toggleWalletDrawer = useToggleAccountDrawer()
  const navigateToTokenDetails = useCallback(async () => {
    navigate(getTokenDetailsURL(token))
    toggleWalletDrawer()
  }, [navigate, token, toggleWalletDrawer])
  const { formatNumber } = useFormatter()

  const currency = gqlToCurrency(token)
  if (!currency) {
    logSentryErrorForUnsupportedChain({
      extras: { token },
      errorMessage: 'Token from unsupported chain received from Mini Portfolio Token Balance Query',
    })
    return null
  }
  return (
    <TraceEvent
      events={[BrowserEvent.onClick]}
      name={SharedEventName.ELEMENT_CLICKED}
      element={InterfaceElementName.MINI_PORTFOLIO_TOKEN_ROW}
      properties={{ chain_id: currency.chainId, token_name: token?.name, address: token?.address }}
    >
      <PortfolioRow
        left={<PortfolioLogo chainId={currency.chainId} currencies={[currency]} size="40px" />}
        title={<TokenNameText>{token?.name}</TokenNameText>}
        descriptor={
          <TokenBalanceText>
            {formatNumber({
              input: quantity,
              type: NumberType.TokenNonTx,
            })}{' '}
            {token?.symbol}
          </TokenBalanceText>
        }
        onClick={navigateToTokenDetails}
        right={
          denominatedValue && (
            <>
              <ThemedText.SubHeader>
                {formatNumber({
                  input: denominatedValue?.value,
                  type: NumberType.PortfolioBalance,
                })}
              </ThemedText.SubHeader>
              <Row justify="flex-end">
                <DeltaArrow delta={percentChange} />
                <ThemedText.BodySecondary>{formatDelta(percentChange)}</ThemedText.BodySecondary>
              </Row>
            </>
          )
        }
      />
    </TraceEvent>
  )
}
