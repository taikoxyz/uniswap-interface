import { Trans } from '@lingui/macro'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { ThemedText } from 'theme'

const StyledLink = styled(Link)`
  font-weight: 535;
  color: ${({ theme }) => theme.neutral2};
  text-decoration: none;
`

const LastUpdatedText = styled.span`
  color: ${({ theme }) => theme.neutral3};
`

const LAST_UPDATED_DATE = '11.12.25'

export default function PrivacyPolicyNotice() {
  return (
    <ThemedText.BodySmall color="neutral2">
      <Trans>By connecting a wallet, you agree to Taiko DEX&apos;s</Trans>{' '}
      <StyledLink to="/terms-of-service">
        <Trans>Terms of Service</Trans>{' '}
      </StyledLink>
      <Trans>and consent to its</Trans>{' '}
      <StyledLink to="/privacy-policy">
        <Trans>Privacy Policy.</Trans>
      </StyledLink>
      <LastUpdatedText>
        {' ('}
        <Trans>Last Updated</Trans>
        {` ${LAST_UPDATED_DATE})`}
      </LastUpdatedText>
    </ThemedText.BodySmall>
  )
}
