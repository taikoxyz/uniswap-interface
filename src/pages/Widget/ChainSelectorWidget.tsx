import { t } from '@lingui/macro'
import { Trans } from '@lingui/macro'
import { BrowserEvent, SharedEventName } from '@uniswap/analytics-events'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { showTestnetsAtom } from 'components/AccountDrawer/TestnetsToggle'
import Loader from 'components/Icons/LoadingSpinner'
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
import { CheckMarkIcon } from 'nft/components/icons'
import { TraceEvent } from 'analytics'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'react-feather'
import styled from 'styled-components'
import { getSupportedChainIdsFromWalletConnectSession } from 'utils/getSupportedChainIdsFromWalletConnectSession'
import { Z_INDEX } from 'theme/zIndex'

// Light theme colors
const LIGHT_COLORS = {
  background: '#FFFFFF',
  surface: '#F9F9F9',
  surfaceHover: '#F0F0F0',
  border: '#E8E8E8',
  text: '#222222',
  textSecondary: '#7D7D7D',
  accent: '#E81899',
}

const SelectorButton = styled.button<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid ${LIGHT_COLORS.border};
  background: ${({ $isOpen }) => ($isOpen ? LIGHT_COLORS.surface : LIGHT_COLORS.background)};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${LIGHT_COLORS.surface};
  }
`

const ChainLogo = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
`

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 240px;
  background: ${LIGHT_COLORS.background};
  border: 1px solid ${LIGHT_COLORS.border};
  border-radius: 12px;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.08);
  z-index: ${Z_INDEX.modal};
  padding: 8px;
  overflow: hidden;
`

const ChainRow = styled.button<{ $disabled: boolean }>`
  display: grid;
  grid-template-columns: min-content 1fr min-content;
  align-items: center;
  width: 100%;
  padding: 10px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transition: background 0.15s ease;

  &:hover {
    background: ${({ $disabled }) => ($disabled ? 'transparent' : LIGHT_COLORS.surfaceHover)};
  }
`

const RowLogo = styled.img`
  width: 20px;
  height: 20px;
  margin-right: 12px;
  border-radius: 50%;
`

const RowLabel = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${LIGHT_COLORS.text};
  text-align: left;
`

const RowCaption = styled.div`
  font-size: 12px;
  color: ${LIGHT_COLORS.textSecondary};
  grid-column: 2;
  grid-row: 2;
  text-align: left;
`

const RowStatus = styled.div`
  display: flex;
  align-items: center;
  width: 20px;
`

const Container = styled.div`
  position: relative;
`

function useWalletSupportedChains(): ChainId[] {
  const { connector } = useWeb3React()
  const connectionType = getConnection(connector).type
  const enabledChains = getEnabledChainIds()

  switch (connectionType) {
    case ConnectionType.WALLET_CONNECT_V2:
    case ConnectionType.UNISWAP_WALLET_V2:
      const wcChains = getSupportedChainIdsFromWalletConnectSession((connector as WalletConnectV2).provider?.session)
      return wcChains.filter((chainId) => enabledChains.includes(chainId))
    default:
      return enabledChains
  }
}

interface ChainRowItemProps {
  disabled?: boolean
  targetChain: ChainId
  onSelectChain: (targetChain: number) => void
  isPending: boolean
}

function ChainRowItem({ disabled, targetChain, onSelectChain, isPending }: ChainRowItemProps) {
  const { chainId } = useWeb3React()
  const active = chainId === targetChain
  const chainInfo = getChainInfo(targetChain)
  const label = chainInfo?.label
  const logoUrl = chainInfo?.logoUrl

  if (!chainInfo || !label) {
    return null
  }

  return (
    <TraceEvent events={[BrowserEvent.onClick]} name={SharedEventName.ELEMENT_CLICKED} element={`${label}-selector`}>
      <ChainRow
        data-testid={`${label}-selector`}
        $disabled={!!disabled}
        onClick={() => {
          if (!disabled) onSelectChain(targetChain)
        }}
      >
        {logoUrl && <RowLogo src={logoUrl} alt={label} />}
        <RowLabel>{label}</RowLabel>
        {disabled && (
          <RowCaption>
            <Trans>Unsupported by your wallet</Trans>
          </RowCaption>
        )}
        {isPending && (
          <RowCaption>
            <Trans>Approve in wallet</Trans>
          </RowCaption>
        )}
        <RowStatus>
          {active && <CheckMarkIcon width={20} height={20} color={LIGHT_COLORS.accent} />}
          {!active && isPending && <Loader width={20} height={20} />}
        </RowStatus>
      </ChainRow>
    </TraceEvent>
  )
}

export function ChainSelectorWidget() {
  const { chainId } = useWeb3React()
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const showTestnets = useAtomValue(showTestnetsAtom)
  const walletSupportsChain = useWalletSupportedChains()

  const [supportedChains, unsupportedChains] = useMemo(() => {
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

  const chevronProps = {
    height: 20,
    width: 20,
    color: LIGHT_COLORS.textSecondary,
  }

  return (
    <Container ref={ref}>
      <MouseoverTooltip text={t`Your wallet's current network is unsupported.`} disabled={isSupported}>
        <SelectorButton $isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} data-testid="chain-selector">
          {!isSupported ? (
            <AlertTriangle size={20} color={LIGHT_COLORS.textSecondary} />
          ) : (
            <ChainLogo src={info.logoUrl} alt={info.label} data-testid="chain-selector-logo" />
          )}
          {isOpen ? <ChevronUp {...chevronProps} /> : <ChevronDown {...chevronProps} />}
        </SelectorButton>
      </MouseoverTooltip>
      {isOpen && (
        <Dropdown ref={modalRef} data-testid="chain-selector-options">
          {supportedChains.map((selectorChain) => (
            <ChainRowItem
              disabled={!walletSupportsChain.includes(selectorChain)}
              onSelectChain={onSelectChain}
              targetChain={selectorChain}
              key={selectorChain}
              isPending={selectorChain === pendingChainId}
            />
          ))}
          {unsupportedChains.map((selectorChain) => (
            <ChainRowItem
              disabled
              onSelectChain={() => undefined}
              targetChain={selectorChain}
              key={selectorChain}
              isPending={false}
            />
          ))}
        </Dropdown>
      )}
    </Container>
  )
}
