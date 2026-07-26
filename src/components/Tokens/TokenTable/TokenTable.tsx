import { Trans } from '@lingui/macro'
import { PAGE_SIZE, useTopTokens } from 'graphql/data/TopTokens'
import { validateUrlChainParam } from 'graphql/data/util'
import { Chain } from 'graphql/data/__generated__/types-and-hooks'
import { ReactNode } from 'react'
import { AlertTriangle } from 'react-feather'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { getDefaultChainId } from 'config/chains'
import { isTaikoChain } from 'config/chains/taiko'
import { useTopTokensTaiko } from 'graphql/taiko/TaikoTopTokens'
import { TimePeriod } from 'graphql/data/util'
import { useAtomValue } from 'jotai'
import { filterTimeAtom } from '../state'

import { MAX_WIDTH_MEDIA_BREAKPOINT } from '../constants'
import { HeaderRow, LoadedRow, LoadingRow } from './TokenRow'

const GridContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
  background-color: ${({ theme }) => theme.surface1};

  margin-left: auto;
  margin-right: auto;
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.surface3};
`

const TokenDataContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  width: 100%;
`

const NoTokenDisplay = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  height: 60px;
  color: ${({ theme }) => theme.neutral2};
  font-size: 16px;
  font-weight: 535;
  align-items: center;
  padding: 0px 28px;
  gap: 8px;
`

function NoTokensState({ message }: { message: ReactNode }) {
  return (
    <GridContainer>
      <HeaderRow />
      <NoTokenDisplay>{message}</NoTokenDisplay>
    </GridContainer>
  )
}

const LoadingRows = ({ rowCount }: { rowCount: number }) => (
  <>
    {Array(rowCount)
      .fill(null)
      .map((_, index) => {
        return <LoadingRow key={index} first={index === 0} last={index === rowCount - 1} />
      })}
  </>
)

function LoadingTokenTable({ rowCount = PAGE_SIZE }: { rowCount?: number }) {
  return (
    <GridContainer>
      <HeaderRow />
      <TokenDataContainer>
        <LoadingRows rowCount={rowCount} />
      </TokenDataContainer>
    </GridContainer>
  )
}

export default function TokenTable() {
  // Always use the default chain configured in env, not the wallet's chain
  const defaultChainId = getDefaultChainId()
  const chainName = validateUrlChainParam(useParams<{ chainName?: string }>().chainName)
  const timePeriod = useAtomValue(filterTimeAtom)

  // Check if this is a Taiko chain - use default chain, not wallet chain
  const isTaiko = isTaikoChain(defaultChainId)

  // Use custom Taiko hook for Taiko chains, otherwise use standard hook
  const standardResult = useTopTokens(chainName as Chain)
  const taikoResult = useTopTokensTaiko(defaultChainId, timePeriod)

  // Select the appropriate result based on chain
  const { tokens, tokenSortRank, loadingTokens, sparklines } = isTaiko ? taikoResult : standardResult

  /* loading and error state */
  if (loadingTokens && !tokens) {
    return <LoadingTokenTable rowCount={PAGE_SIZE} />
  } else if (!tokens) {
    // Soft fail - show friendly error message if subgraph unavailable or query fails
    return (
      <NoTokensState
        message={
          <>
            <AlertTriangle size={16} />
            <Trans>Unable to load token data. Please try again later.</Trans>
          </>
        }
      />
    )
  } else if (tokens?.length === 0) {
    return <NoTokensState message={<Trans>No tokens found</Trans>} />
  } else {
    return (
      <GridContainer>
        <HeaderRow />
        <TokenDataContainer>
          {tokens.map(
            (token, index) =>
              token?.address && (
                <LoadedRow
                  key={token.address}
                  tokenListIndex={index}
                  tokenListLength={tokens.length}
                  token={token as any}
                  sparklineMap={sparklines}
                  sortRank={tokenSortRank[token.address]}
                />
              )
          )}
        </TokenDataContainer>
      </GridContainer>
    )
  }
}
