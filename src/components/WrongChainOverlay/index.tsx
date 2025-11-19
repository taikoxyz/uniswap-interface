import { Trans } from '@lingui/macro'
import { useWeb3React } from '@web3-react/core'
import { ButtonPrimary } from 'components/Button'
import { getDefaultChainId, isChainEnabled } from 'config/chains'
import { getChainInfo } from 'constants/chainInfo'
import { useSwitchChain } from 'hooks/useSwitchChain'
import { AlertTriangle } from 'react-feather'
import styled from 'styled-components'
import { ThemedText } from 'theme'

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.surface1}ee;
  backdrop-filter: blur(8px);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  z-index: 10;
`

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ theme }) => theme.surface3};
  color: ${({ theme }) => theme.critical};
`

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
`

export function WrongChainOverlay() {
  const { chainId: connectedChainId, connector, account } = useWeb3React()
  const switchChain = useSwitchChain()
  const defaultChainId = getDefaultChainId()

  // Only show overlay if:
  // 1. User is connected to a wallet
  // 2. Connected chain is not in the enabled chains list (based on REACT_APP_TAIKO_CHAIN env var)
  const isWrongChain = account && connectedChainId && !isChainEnabled(connectedChainId)

  if (!isWrongChain) return null

  const defaultChainInfo = getChainInfo(defaultChainId)
  const connectedChainInfo = getChainInfo(connectedChainId)

  const handleSwitchChain = async () => {
    if (!connector) return
    try {
      await switchChain(connector, defaultChainId)
    } catch (error) {
      console.error('Failed to switch chain:', error)
    }
  }

  return (
    <Overlay>
      <IconWrapper>
        <AlertTriangle size={24} />
      </IconWrapper>
      <MessageContainer>
        <ThemedText.HeadlineSmall>
          <Trans>Unsupported Network</Trans>
        </ThemedText.HeadlineSmall>
        <ThemedText.BodySecondary>
          {connectedChainInfo ? (
            <Trans>
              You are connected to {connectedChainInfo.label}. Please switch to {defaultChainInfo.label} to use this
              DEX.
            </Trans>
          ) : (
            <Trans>Please switch to {defaultChainInfo.label} to use this DEX.</Trans>
          )}
        </ThemedText.BodySecondary>
      </MessageContainer>
      <ButtonPrimary onClick={handleSwitchChain} $borderRadius="12px" style={{ minWidth: '200px' }}>
        <Trans>Switch to {defaultChainInfo.label}</Trans>
      </ButtonPrimary>
    </Overlay>
  )
}
