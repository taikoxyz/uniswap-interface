import { t } from '@lingui/macro'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { showTestnetsAtom } from 'components/AccountDrawer/TestnetsToggle'
import { MouseoverTooltip } from 'components/Tooltip'
import { getEnabledChainIds } from 'config/chains'
import { getConnection } from 'connection'
import { ConnectionType } from 'connection/types'
import { WalletConnectV2 } from 'connection/WalletConnectV2'
import { getChainInfo } from 'constants/chainInfo'
import { getChainPriority, TESTNET_CHAIN_IDS } from 'constants/chains'
import { useOnClickOutside } from 'hooks/useOnClickOutside'
import useSelectChain from 'hooks/useSelectChain'
import useSyncChainQuery from 'hooks/useSyncChainQuery'
import { useAtomValue } from 'jotai'
import { Box } from 'nft/components/Box'
import { Portal } from 'nft/components/common/Portal'
import { Column, Row } from 'nft/components/Flex'
import { useIsMobile } from 'nft/hooks'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'react-feather'
import styled, { ThemeProvider, useTheme } from 'styled-components'
import { getTheme } from 'theme'
import { getSupportedChainIdsFromWalletConnectSession } from 'utils/getSupportedChainIdsFromWalletConnectSession'

import * as styles from './ChainSelector.css'
import ChainSelectorRow from './ChainSelectorRow'
import { NavDropdown } from './NavDropdown'

interface ChainSelectorProps {
  leftAlign?: boolean
  forceLight?: boolean
}

// Light theme for styled-components
const lightTheme = getTheme(false)

// Styled dropdown container for light theme (replaces NavDropdown which uses vanilla-extract)
const LightDropdownContainer = styled.div<{ top?: string; left?: string; right?: string }>`
  position: absolute;
  top: ${({ top }) => top ?? '56'}px;
  left: ${({ left }) => left ?? 'auto'};
  right: ${({ right }) => right ?? '0'};
  background: ${({ theme }) => theme.surface2};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 12px;
  padding: 8px 0;
  box-shadow: 0px 4px 12px 0px #00000026;
  z-index: 1000;
`

const LightDropdownColumn = styled.div`
  padding: 0 8px;
`

function useWalletSupportedChains(): ChainId[] {
  const { connector } = useWeb3React()
  const connectionType = getConnection(connector).type

  // Get only enabled chains from the registry
  const enabledChains = getEnabledChainIds()

  switch (connectionType) {
    case ConnectionType.WALLET_CONNECT_V2:
    case ConnectionType.UNISWAP_WALLET_V2: {
      const wcChains = getSupportedChainIdsFromWalletConnectSession((connector as WalletConnectV2).provider?.session)
      // Filter WalletConnect chains to only include enabled ones
      return wcChains.filter((chainId) => enabledChains.includes(chainId))
    }
    default:
      return enabledChains
  }
}

export const ChainSelector = ({ leftAlign, forceLight }: ChainSelectorProps) => {
  const { chainId } = useWeb3React()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const isMobile = useIsMobile()

  const theme = useTheme()

  const showTestnets = useAtomValue(showTestnetsAtom)
  const walletSupportsChain = useWalletSupportedChains()

  const [supportedChains, unsupportedChains] = useMemo(() => {
    // Get only enabled chains from registry
    const enabledChains = getEnabledChainIds()

    const { supported, unsupported } = enabledChains
      .filter((chain: number) => {
        return showTestnets || !TESTNET_CHAIN_IDS.includes(chain)
      })
      .sort((a, b) => getChainPriority(a) - getChainPriority(b))
      .reduce(
        (acc, chain) => {
          if (walletSupportsChain.includes(chain)) {
            acc.supported.push(chain)
          } else {
            acc.unsupported.push(chain)
          }
          return acc
        },
        { supported: [], unsupported: [] } as Record<string, ChainId[]>
      )
    return [supported, unsupported]
  }, [showTestnets, walletSupportsChain])

  const ref = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useOnClickOutside(ref, () => setIsOpen(false), [modalRef])

  const info = getChainInfo(chainId)

  const selectChain = useSelectChain()
  useSyncChainQuery()

  const [pendingChainId, setPendingChainId] = useState<ChainId | undefined>(undefined)

  const onSelectChain = useCallback(
    async (targetChainId: ChainId) => {
      setPendingChainId(targetChainId)
      await selectChain(targetChainId)
      setPendingChainId(undefined)
      setIsOpen(false)
    },
    [selectChain, setIsOpen]
  )

  if (!chainId) {
    return null
  }

  const isSupported = !!info

  const dropdownContent = (
    <>
      {supportedChains.map((selectorChain) => (
        <ChainSelectorRow
          disabled={!walletSupportsChain.includes(selectorChain)}
          onSelectChain={onSelectChain}
          targetChain={selectorChain}
          key={selectorChain}
          isPending={selectorChain === pendingChainId}
        />
      ))}
      {unsupportedChains.map((selectorChain) => (
        <ChainSelectorRow
          disabled
          onSelectChain={() => undefined}
          targetChain={selectorChain}
          key={selectorChain}
          isPending={false}
        />
      ))}
    </>
  )

  const dropdown = (
    <NavDropdown top="56" left={leftAlign ? '0' : 'auto'} right={leftAlign ? 'auto' : '0'} ref={modalRef}>
      <Column paddingX="8" data-testid="chain-selector-options">
        {dropdownContent}
      </Column>
    </NavDropdown>
  )

  const lightDropdown = (
    <ThemeProvider theme={lightTheme}>
      <LightDropdownContainer
        top="56"
        left={leftAlign ? '0' : undefined}
        right={leftAlign ? undefined : '0'}
        ref={modalRef}
      >
        <LightDropdownColumn data-testid="chain-selector-options">{dropdownContent}</LightDropdownColumn>
      </LightDropdownContainer>
    </ThemeProvider>
  )

  const chevronProps = {
    height: 20,
    width: 20,
    color: theme.neutral2,
  }

  return (
    <Box position="relative" ref={ref}>
      <MouseoverTooltip text={t`Your wallet's current network is unsupported.`} disabled={isSupported}>
        <Row
          data-testid="chain-selector"
          as="button"
          gap="8"
          className={styles.ChainSelector}
          background={isOpen ? 'accent2' : 'none'}
          onClick={() => setIsOpen(!isOpen)}
        >
          {!isSupported ? (
            <AlertTriangle size={20} color={theme.neutral2} />
          ) : (
            <img src={info.logoUrl} alt={info.label} className={styles.Image} data-testid="chain-selector-logo" />
          )}
          {isOpen ? <ChevronUp {...chevronProps} /> : <ChevronDown {...chevronProps} />}
        </Row>
      </MouseoverTooltip>
      {isOpen &&
        (isMobile ? <Portal>{forceLight ? lightDropdown : dropdown}</Portal> : forceLight ? lightDropdown : dropdown)}
    </Box>
  )
}
