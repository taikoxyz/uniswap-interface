import { ChainId } from '@uniswap/sdk-core'
import Row from 'components/Row'
import { getValidUrlChainName, supportedChainIdFromGQLChain } from 'graphql/data/util'
import { usePoolData } from 'graphql/thegraph/PoolData'
import NotFound from 'pages/NotFound'
import { useReducer } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { isAddress } from 'utils'

import { PoolDetailsChart } from './PoolDetailsChart'
import { PoolDetailsHeader } from './PoolDetailsHeader'
import { PoolDetailsLinks } from './PoolDetailsLinks'
import { PoolDetailsStats } from './PoolDetailsStats'
import { PoolDetailsTransactions } from './PoolDetailsTransactions'

const PageWrapper = styled(Row)`
  padding: 40px 56px;
  width: 100%;
  gap: 24px;
  align-items: flex-start;

  @media only screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    padding: 24px 24px;
    flex-direction: column;
  }

  @media only screen and (max-width: ${({ theme }) => theme.breakpoint.sm}px) {
    padding: 16px 16px;
  }

  @media only screen and (max-width: ${({ theme }) => theme.breakpoint.xs}px) {
    padding: 12px 12px;
  }
`

const LeftColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media only screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    width: 100%;
  }
`

const RightColumn = styled.div`
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media only screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    width: 100%;
  }
`

export default function PoolDetailsPage() {
  const { poolAddress, chainName } = useParams<{
    poolAddress: string
    chainName: string
  }>()
  const chain = getValidUrlChainName(chainName)
  const chainId: ChainId | undefined = chain ? supportedChainIdFromGQLChain(chain) : undefined
  const { data: poolData, loading } = usePoolData(poolAddress ?? '', chainId)
  const [isReversed, toggleReversed] = useReducer((x) => !x, false)
  const token0 = isReversed ? poolData?.token1 : poolData?.token0
  const token1 = isReversed ? poolData?.token0 : poolData?.token1
  const isInvalidPool = !chainName || !poolAddress || !getValidUrlChainName(chainName) || !isAddress(poolAddress)
  const poolNotFound = (!loading && !poolData) || isInvalidPool

  // Debug logging
  console.log('PoolDetails Debug:', {
    chainName,
    poolAddress,
    chain,
    chainId,
    loading,
    poolData,
    isInvalidPool,
    poolNotFound,
  })

  // TODO(WEB-2814): Add skeleton once designed
  if (loading) return null
  if (poolNotFound) return <NotFound />
  return (
    <PageWrapper>
      <LeftColumn>
        <PoolDetailsHeader
          chainId={chainId}
          poolAddress={poolAddress}
          token0={token0}
          token1={token1}
          feeTier={poolData?.feeTier}
          toggleReversed={toggleReversed}
        />
        <PoolDetailsChart poolAddress={poolAddress ?? ''} chainId={chainId} />
        <PoolDetailsTransactions
          poolAddress={poolAddress ?? ''}
          chainId={chainId}
          token0Symbol={token0?.symbol ?? ''}
          token1Symbol={token1?.symbol ?? ''}
        />
      </LeftColumn>
      <RightColumn>
        <PoolDetailsStats poolData={poolData} poolAddress={poolAddress} chainId={chainId} />
        <PoolDetailsLinks
          poolAddress={poolAddress ?? ''}
          token0Address={token0?.id ?? ''}
          token0Symbol={token0?.symbol ?? ''}
          token1Address={token1?.id ?? ''}
          token1Symbol={token1?.symbol ?? ''}
          chainId={chainId}
        />
      </RightColumn>
    </PageWrapper>
  )
}
