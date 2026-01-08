import { Trans } from '@lingui/macro'
import { Percent } from '@uniswap/sdk-core'
import { InterfaceTrade } from 'state/routing/types'
import styled from 'styled-components'
import { ThemedText } from 'theme'

import { RowBetween, RowFixed } from '../Row'
import SettingsTab from '../Settings'

const StyledSwapHeader = styled(RowBetween)`
  margin-bottom: 10px;
  color: ${({ theme }) => theme.neutral2};
`

const HeaderButtonContainer = styled(RowFixed)`
  padding: 0 12px;
  gap: 16px;
`

const RightContainer = styled(RowFixed)`
  gap: 8px;
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
      </HeaderButtonContainer>
      <RightContainer>
        {compact && <CompactWalletStatus />}
        <SettingsTab autoSlippage={autoSlippage} chainId={chainId} trade={trade} />
      </RightContainer>
    </StyledSwapHeader>
  )
}

// Lazy import to avoid circular dependencies
function CompactWalletStatus() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ChainSelector } = require('components/NavBar/ChainSelector')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Web3Status = require('components/Web3Status').default

  return (
    <>
      <ChainSelector forceLight />
      <Web3Status />
    </>
  )
}
