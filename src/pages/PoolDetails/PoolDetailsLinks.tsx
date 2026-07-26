import { Trans } from '@lingui/macro'
import Column from 'components/Column'
import Row from 'components/Row'
import { useState, useCallback } from 'react'
import { Copy, CheckCircle, ExternalLink as ExternalLinkIcon } from 'react-feather'
import styled from 'styled-components'
import { ThemedText } from 'theme'
import { ExplorerDataType, getExplorerLink } from 'utils/getExplorerLink'
import { shortenAddress } from 'utils/addresses'

const LinksContainer = styled(Column)`
  gap: 24px;
  padding: 24px;
  background: ${({ theme }) => theme.surface2};
  border-radius: 16px;
  margin-top: 24px;
`

const LinkRow = styled(Row)`
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`

const LinkLabel = styled(ThemedText.BodySecondary)`
  color: ${({ theme }) => theme.neutral2};
  min-width: 60px;
`

const AddressContainer = styled(Row)`
  gap: 8px;
  align-items: center;
  flex: 1;
`

const AddressText = styled(ThemedText.BodyPrimary)`
  font-family: 'Courier New', monospace;
`

const IconButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.neutral2};
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.neutral1};
  }

  &:active {
    opacity: 0.7;
  }
`

const ExternalLinkButton = styled.a`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.neutral2};
  transition: color 0.2s ease;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.accent1};
  }
`

const SuccessIcon = styled(CheckCircle)`
  color: ${({ theme }) => theme.success};
`

interface PoolDetailsLinksProps {
  poolAddress: string
  token0Address: string
  token0Symbol: string
  token1Address: string
  token1Symbol: string
  chainId?: number
}

interface CopyButtonProps {
  address: string
  onCopy: (address: string) => void
  isCopied: boolean
}

function CopyButton({ address, onCopy, isCopied }: CopyButtonProps) {
  const handleClick = useCallback(() => {
    onCopy(address)
  }, [address, onCopy])

  return (
    <IconButton onClick={handleClick} title="Copy address">
      {isCopied ? <SuccessIcon size={16} /> : <Copy size={16} />}
    </IconButton>
  )
}

interface ExplorerLinkProps {
  chainId: number
  address: string
  type: ExplorerDataType
}

function ExplorerLink({ chainId, address, type }: ExplorerLinkProps) {
  const explorerUrl = getExplorerLink(chainId, address, type)

  return (
    <ExternalLinkButton href={explorerUrl} target="_blank" rel="noopener noreferrer" title="View on explorer">
      <ExternalLinkIcon size={16} />
    </ExternalLinkButton>
  )
}

export function PoolDetailsLinks({
  poolAddress,
  token0Address,
  token0Symbol,
  token1Address,
  token1Symbol,
  chainId = 1,
}: PoolDetailsLinksProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const handleCopy = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => {
        setCopiedAddress(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }, [])

  return (
    <LinksContainer>
      <ThemedText.HeadlineMedium>
        <Trans>Links</Trans>
      </ThemedText.HeadlineMedium>

      <LinkRow>
        <LinkLabel>
          <Trans>Pool</Trans>
        </LinkLabel>
        <AddressContainer>
          <AddressText>{shortenAddress(poolAddress, 6, 4)}</AddressText>
          <CopyButton address={poolAddress} onCopy={handleCopy} isCopied={copiedAddress === poolAddress} />
          <ExplorerLink chainId={chainId} address={poolAddress} type={ExplorerDataType.ADDRESS} />
        </AddressContainer>
      </LinkRow>

      <LinkRow>
        <LinkLabel>{token0Symbol}</LinkLabel>
        <AddressContainer>
          <AddressText>{shortenAddress(token0Address, 6, 4)}</AddressText>
          <CopyButton address={token0Address} onCopy={handleCopy} isCopied={copiedAddress === token0Address} />
          <ExplorerLink chainId={chainId} address={token0Address} type={ExplorerDataType.TOKEN} />
        </AddressContainer>
      </LinkRow>

      <LinkRow>
        <LinkLabel>{token1Symbol}</LinkLabel>
        <AddressContainer>
          <AddressText>{shortenAddress(token1Address, 6, 4)}</AddressText>
          <CopyButton address={token1Address} onCopy={handleCopy} isCopied={copiedAddress === token1Address} />
          <ExplorerLink chainId={chainId} address={token1Address} type={ExplorerDataType.TOKEN} />
        </AddressContainer>
      </LinkRow>
    </LinksContainer>
  )
}
