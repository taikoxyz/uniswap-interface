import { Text } from 'rebass'

import styled from 'styled-components'

import { useActiveWeb3React } from '../../hooks'

import Settings from '../Settings'

import { RowBetween } from '../Row'
import VersionSwitch from './VersionSwitch'
import { StyledLink } from '../../theme/components'
import { useDarkModeManager } from '../../state/user/hooks'
import { TaikoIcon, TaikoIconLight } from '../TaikoIcon/TaikoIcon'
import { Web3Button, Web3NetworkSwitch } from '@web3modal/react'
import { useAccount, useBalance } from 'wagmi'
import { isMobile } from 'react-device-detect'
const HeaderFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  width: 100%;
  top: 0;
  position: absolute;
  z-index: 2;
  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    padding: 12px 0 0 0;
    width: calc(100%);
    position: relative;
  `};
`

const HeaderElement = styled.div`
  display: flex;
  align-items: center;
`

const HeaderElementWrap = styled.div`
  display: flex;
  align-items: center;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    margin-top: 0.5rem;
`};
`

const Title = styled.a`
  display: flex;
  align-items: center;
  pointer-events: auto;

  :hover {
    cursor: pointer;
  }
`

const AccountElement = styled.div<{ active: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme, active }) => (!active ? theme.bg1 : theme.bg3)};
  border-radius: 12px;
  white-space: nowrap;
  width: 100%;

  :focus {
    border: 1px solid blue;
  }
`

const HeaderControls = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-direction: column;
    align-items: flex-end;
  `};
`

const BalanceText = styled(Text)`
  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    display: none;
  `};
`

export default function Header() {
  const { account } = useActiveWeb3React()

  const [isDark] = useDarkModeManager()

  const { address, isConnected } = useAccount()
  const { data } = useBalance({
    address
  })

  return (
    <HeaderFrame>
      <RowBetween style={{ alignItems: 'flex-start' }} padding="1rem 1rem 0 1rem">
        <HeaderElement>
          <Title href=".">
            {isDark ? (
              <TaikoIcon width="120" viewBox="0 0 340 94" data-testid="taiko-logo" />
            ) : (
              <TaikoIconLight width="120" viewBox="0 0 340 94" data-testid="taiko-logo" />
            )}
          </Title>
          <StyledLink target={'_blank'} rel={'noreferrer'} href={process.env.REACT_APP_PUBLIC_GUIDE_URL}>
            Guide ↗
          </StyledLink>
        </HeaderElement>

        <HeaderControls>
          <HeaderElement>
            <AccountElement active={!!account} style={{ pointerEvents: 'auto' }}>
              {isConnected && data ? (
                <BalanceText style={{ flexShrink: 0 }} pl="0.75rem" pr="0.5rem" fontWeight={500}>
                  {Number(data?.formatted).toFixed(3)} {data?.symbol}
                </BalanceText>
              ) : null}
              {isConnected && !isMobile && <Web3NetworkSwitch />}
              <Web3Button label={'Connect your wallet'} />
            </AccountElement>
          </HeaderElement>
          <HeaderElementWrap>
            <VersionSwitch />
            <Settings />
          </HeaderElementWrap>
        </HeaderControls>
      </RowBetween>
    </HeaderFrame>
  )
}
