import { Trans } from '@lingui/macro'
import { SharedEventName } from '@uniswap/analytics-events'
import { sendAnalyticsEvent } from 'analytics'
import Card, { DarkGrayCard } from 'components/Card'
import Row, { AutoRow, RowBetween } from 'components/Row'
import { useEffect, useRef } from 'react'
import { ArrowDown, Info, X } from 'react-feather'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { ExternalLink, ThemedText } from 'theme'
import { isMobile } from 'utils/userAgent'

import { useModalIsOpen, useTogglePrivacyPolicy } from '../../state/application/hooks'
import { ApplicationModal } from '../../state/application/reducer'
import { AutoColumn } from '../Column'
import Modal from '../Modal'

const Wrapper = styled.div`
  max-height: 70vh;
  overflow: auto;
  padding: 0 1rem;
`

const StyledExternalCard = styled(Card)`
  background-color: ${({ theme }) => theme.accent2};
  padding: 0.5rem;
  width: 100%;

  :hover,
  :focus,
  :active {
    background-color: ${({ theme }) => theme.neutral3};
  }
`

const HoverText = styled.div`
  text-decoration: none;
  color: ${({ theme }) => theme.neutral1};
  display: flex;
  align-items: center;

  :hover {
    cursor: pointer;
  }
`

const StyledLinkOut = styled(ArrowDown)`
  transform: rotate(230deg);
`

const EXTERNAL_APIS = [
  {
    name: 'Taiko Network RPC',
    description: (
      <Trans>
        The app connects to the Taiko blockchain network to execute transactions and fetch on-chain data.
      </Trans>
    ),
  },
  {
    name: 'Goldsky Subgraph',
    description: (
      <Trans>The app fetches blockchain data and token information from Goldsky subgraph indexing services.</Trans>
    ),
  },
  {
    name: 'Wallet Address Screening',
    description: (
      <>
        <Trans>
          The app collects your publicly-available blockchain wallet address to screen for prior illicit activity and
          ensure compliance with applicable regulations.
        </Trans>{' '}
        <ExternalLink href="https://docs.taiko.xyz">
          <Trans>Learn more</Trans>
        </ExternalLink>
      </>
    ),
  },
  {
    name: 'Web Tracking Tools',
    description: (
      <Trans>
        The app uses cookies and similar technologies to collect anonymous device and browser information to improve
        the service. No personal data or IP addresses are collected.
      </Trans>
    ),
  },
  {
    name: 'Wallet Providers',
    description: (
      <Trans>
        The app integrates with third-party non-custodial wallet providers. Your relationship with wallet providers
        is governed by their own terms of service.
      </Trans>
    ),
  },
]

export function PrivacyPolicyModal() {
  const node = useRef<HTMLDivElement>()
  const open = useModalIsOpen(ApplicationModal.PRIVACY_POLICY)
  const toggle = useTogglePrivacyPolicy()

  useEffect(() => {
    if (!open) return

    sendAnalyticsEvent(SharedEventName.PAGE_VIEWED, {
      category: 'Modal',
      action: 'Show Legal',
    })
  }, [open])

  return (
    <Modal isOpen={open} onDismiss={() => toggle()}>
      <AutoColumn gap="md" ref={node as any}>
        <RowBetween padding="1rem 1rem 0.5rem 1rem">
          <ThemedText.DeprecatedMediumHeader>
            <Trans>Legal & Privacy</Trans>
          </ThemedText.DeprecatedMediumHeader>
          <HoverText onClick={() => toggle()}>
            <X size={24} />
          </HoverText>
        </RowBetween>
        <PrivacyPolicy />
      </AutoColumn>
    </Modal>
  )
}

function PrivacyPolicy() {
  return (
    <Wrapper
      draggable="true"
      onTouchMove={(e) => {
        // prevent modal gesture handler from dismissing modal when content is scrolling
        if (isMobile) {
          e.stopPropagation()
        }
      }}
    >
      <AutoColumn gap="16px">
        <AutoColumn gap="sm" style={{ width: '100%' }}>
          <StyledExternalCard>
            <Link to="/terms-of-service" style={{ textDecoration: 'none' }}>
              <RowBetween>
                <AutoRow gap="4px">
                  <Info size={20} />
                  <ThemedText.DeprecatedMain fontSize={14} color="accent1">
                    <Trans>Taiko DEX Terms of Service</Trans>
                  </ThemedText.DeprecatedMain>
                </AutoRow>
                <StyledLinkOut size={20} />
              </RowBetween>
            </Link>
          </StyledExternalCard>
          <StyledExternalCard>
            <Link to="/privacy-policy" style={{ textDecoration: 'none' }}>
              <RowBetween>
                <AutoRow gap="4px">
                  <Info size={20} />
                  <ThemedText.DeprecatedMain fontSize={14} color="accent1">
                    <Trans>Privacy Policy</Trans>
                  </ThemedText.DeprecatedMain>
                </AutoRow>
                <StyledLinkOut size={20} />
              </RowBetween>
            </Link>
          </StyledExternalCard>
        </AutoColumn>
        <ThemedText.DeprecatedMain fontSize={14}>
          <Trans>This app uses the following third-party APIs:</Trans>
        </ThemedText.DeprecatedMain>
        <AutoColumn gap="md">
          {EXTERNAL_APIS.map(({ name, description }, i) => (
            <DarkGrayCard key={i}>
              <AutoColumn gap="sm">
                <AutoRow gap="4px">
                  <Info size={18} />
                  <ThemedText.DeprecatedMain fontSize={14} color="neutral1">
                    {name}
                  </ThemedText.DeprecatedMain>
                </AutoRow>
                <ThemedText.DeprecatedMain fontSize={14}>{description}</ThemedText.DeprecatedMain>
              </AutoColumn>
            </DarkGrayCard>
          ))}
          <ThemedText.DeprecatedBody fontSize={12}>
            <Row justify="center" marginBottom="1rem">
              <ExternalLink href="https://docs.taiko.xyz">
                <Trans>Learn more</Trans>
              </ExternalLink>
            </Row>
          </ThemedText.DeprecatedBody>
        </AutoColumn>
      </AutoColumn>
    </Wrapper>
  )
}
