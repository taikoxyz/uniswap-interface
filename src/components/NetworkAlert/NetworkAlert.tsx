import { Trans } from '@lingui/macro'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { getChainInfo } from 'constants/chainInfo'
import { AlertTriangle } from 'react-feather'
import { ArrowUpRight } from 'react-feather'
import styled from 'styled-components'
import { ExternalLink, HideSmall } from 'theme'
import { useDarkModeManager } from 'theme/components/ThemeToggle'

import Column from '../Column'

const L2Icon = styled.img`
  width: 24px;
  height: 24px;
  margin-right: 16px;
`

const BodyText = styled.div`
  color: ${({ color }) => color};
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 8px;
  font-size: 14px;
  line-height: 20px;
`
const RootWrapper = styled.div`
  margin-top: 16px;
`

const SHOULD_SHOW_ALERT = {
  // [ChainId.OPTIMISM]: true,
  // [ChainId.OPTIMISM_GOERLI]: true,
  // [ChainId.ARBITRUM_ONE]: true,
  // [ChainId.ARBITRUM_GOERLI]: true,
  // [ChainId.POLYGON]: true,
  // [ChainId.POLYGON_MUMBAI]: true,
  // [ChainId.CELO]: true,
  // [ChainId.CELO_ALFAJORES]: true,
  // [ChainId.BNB]: true,
  // [ChainId.AVALANCHE]: true,
  // [ChainId.BASE]: true,
  // [ChainId.TAIKO_JOLNIR]: true,
  // [ChainId.TAIKO_KATLA]: true,
  [ChainId.TAIKO_HEKLA]: true,
}

type NetworkAlertChains = keyof typeof SHOULD_SHOW_ALERT

const BG_COLORS_BY_DARK_MODE_AND_CHAIN_ID: {
  [darkMode in 'dark' | 'light']: { [chainId in NetworkAlertChains]: string }
} = {
  dark: {
    [ChainId.TAIKO_HEKLA]:
      'radial-gradient(100% 100% at 50% 0%, rgba(10, 41, 75, 0.7) 0%, rgba(0, 82, 255, .1) 40%, rgba(0, 82, 255, 0) 100%), rgb(13, 14, 14);',
  },
  light: {
    [ChainId.TAIKO_HEKLA]:
      'radial-gradient(100% 100% at 50% 0%, rgba(0, 82, 255, 0.20) 0%, rgba(0, 82, 255, 0.08) 40.0%, rgba(252, 255, 82, 0.00) 100%), rgb(255, 255, 255)',
  },
}

const ContentWrapper = styled.div<{
  chainId: NetworkAlertChains
  darkMode: boolean
  logoUrl: string
}>`
  background: ${({ chainId, darkMode }) => BG_COLORS_BY_DARK_MODE_AND_CHAIN_ID[darkMode ? 'dark' : 'light'][chainId]};
  border-radius: 20px;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  position: relative;
  width: 100%;

  :before {
    background-image: url(${({ logoUrl }) => logoUrl});
    background-repeat: no-repeat;
    background-size: 300px;
    content: '';
    height: 300px;
    opacity: 0.1;
    position: absolute;
    transform: rotate(25deg) translate(-90px, -40px);
    width: 300px;
    pointer-events: none;
  }
`
const Header = styled.h2`
  font-weight: 535;
  font-size: 16px;
  margin: 0;
`

const LinkOutToBridge = styled(ExternalLink)`
  align-items: center;
  border-radius: 8px;
  color: white;
  display: flex;
  font-size: 16px;
  justify-content: space-between;
  padding: 6px 8px;
  text-decoration: none !important;
  width: 100%;
`

const StyledArrowUpRight = styled(ArrowUpRight)`
  margin-left: 12px;
  width: 24px;
  height: 24px;
`

const TEXT_COLORS: { [chainId in NetworkAlertChains]: string } = {
  [ChainId.TAIKO_HEKLA]: '#e81899',
}

function shouldShowAlert(chainId: number | undefined): chainId is NetworkAlertChains {
  return Boolean(chainId && SHOULD_SHOW_ALERT[chainId as unknown as NetworkAlertChains])
}

export function NetworkAlert() {
  const { chainId } = useWeb3React()
  const [darkMode] = useDarkModeManager()

  if (!shouldShowAlert(chainId)) {
    const textColor = TEXT_COLORS[ChainId.TAIKO_HEKLA]

    return (
      <RootWrapper>
        <ContentWrapper chainId={ChainId.TAIKO_HEKLA} darkMode={darkMode} logoUrl="">
          <LinkOutToBridge href="https://gov.uniswap.org/t/rfc-uniswap-v3-deployment-on-taiko/21089">
            <BodyText color={darkMode ? textColor : '#e81899'}>
              <AlertTriangle size={24} style={{ marginRight: '16px' }} />
              <Header>
                <Trans>Intended for Demo Purposes Only</Trans>
              </Header>
              <HideSmall>
                <Trans>This is not an official Uniswap release.</Trans>
              </HideSmall>
            </BodyText>
            <StyledArrowUpRight color={darkMode ? textColor : '#e81899'} />
          </LinkOutToBridge>
        </ContentWrapper>
      </RootWrapper>
    )
  }

  const chainInfo = getChainInfo(chainId)

  if (!chainInfo) return null

  const { label, logoUrl, bridge } = chainInfo
  const textColor = TEXT_COLORS[chainId]

  return bridge ? (
    <RootWrapper>
      <ContentWrapper chainId={chainId} darkMode={darkMode} logoUrl={logoUrl}>
        <LinkOutToBridge href={bridge}>
          <BodyText color={textColor}>
            <L2Icon src={logoUrl} />
            <Column>
              <Header>
                <Trans>{label} token bridge</Trans>
              </Header>
              <HideSmall>
                <Trans>Deposit tokens to the {label} network.</Trans>
              </HideSmall>
            </Column>
          </BodyText>
          <StyledArrowUpRight color={textColor} />
        </LinkOutToBridge>
      </ContentWrapper>
      <div style={{ height: '16px' }} />
      <ContentWrapper chainId={ChainId.TAIKO_HEKLA} darkMode={darkMode} logoUrl="">
        <LinkOutToBridge href="https://gov.uniswap.org/t/rfc-uniswap-v3-deployment-on-taiko/21089">
          <BodyText color={darkMode ? textColor : '#e81899'}>
            <AlertTriangle size={24} style={{ marginRight: '16px' }} />
            <Header>
              <Trans>Intended for Demo Purposes Only</Trans>
            </Header>
            <HideSmall>
              <Trans>This is not an official Uniswap release.</Trans>
            </HideSmall>
          </BodyText>
          <StyledArrowUpRight color={darkMode ? textColor : '#e81899'} />
        </LinkOutToBridge>
      </ContentWrapper>
    </RootWrapper>
  ) : null
}
