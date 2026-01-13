import { Trans } from '@lingui/macro'
import { Percent } from '@uniswap/sdk-core'
import { InterfaceTrade } from 'state/routing/types'
import styled from 'styled-components'
import { ThemedText } from 'theme'

import { RowBetween, RowFixed } from '../Row'
import SettingsTab from '../Settings'
import SwapBuyFiatButton from './SwapBuyFiatButton'

const StyledSwapHeader = styled(RowBetween)`
  margin-bottom: 10px;
  color: ${({ theme }) => theme.neutral2};
`

const HeaderButtonContainer = styled(RowFixed)`
  padding: 0 12px;
  gap: 16px;
`

export default function SwapHeader({
  autoSlippage,
  chainId,
  trade,
  compact,
}: {
  autoSlippage: Percent
  chainId?: number
  trade?: InterfaceTrade
  compact?: boolean
}) {
  return (
    <StyledSwapHeader>
      <HeaderButtonContainer>
        <ThemedText.SubHeader>
          <Trans>Swap</Trans>
        </ThemedText.SubHeader>
        {/* <SwapBuyFiatButton /> */}
      </HeaderButtonContainer>
      <RowFixed>
        <SettingsTab autoSlippage={autoSlippage} chainId={chainId} trade={trade} compact={compact} />
      </RowFixed>
    </StyledSwapHeader>
  )
}
