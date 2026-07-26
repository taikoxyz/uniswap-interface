import { Trans } from '@lingui/macro'
import { useEffect } from 'react'
import { ArrowLeft } from 'react-feather'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { ExternalLink } from 'theme'

const PageWrapper = styled.div`
  max-width: 800px;
  width: 100%;
  padding: 48px 20px;
  margin: 0 auto;
`

const BackButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.accent1};
  text-decoration: none;
  margin-bottom: 24px;
  font-weight: 535;

  &:hover {
    opacity: 0.8;
  }
`

const Title = styled.h1`
  font-size: 48px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: ${({ theme }) => theme.neutral1};
`

const LastModified = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
  margin-bottom: 48px;
`

const Section = styled.section`
  margin-bottom: 40px;
`

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 500;
  margin: 32px 0 16px 0;
  color: ${({ theme }) => theme.neutral1};
`

const SubsectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 535;
  margin: 24px 0 12px 0;
  color: ${({ theme }) => theme.neutral1};
`

const Paragraph = styled.p`
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.neutral2};
  margin: 16px 0;
`

const BulletList = styled.ul`
  margin: 16px 0;
  padding-left: 24px;
  color: ${({ theme }) => theme.neutral2};
`

const BulletItem = styled.li`
  font-size: 16px;
  line-height: 24px;
  margin: 8px 0;
`

const Notice = styled.div`
  background: ${({ theme }) => theme.surface2};
  border-left: 4px solid ${({ theme }) => theme.accent1};
  padding: 16px;
  margin: 24px 0;
  border-radius: 8px;
`

const Strong = styled.strong`
  font-weight: 535;
  color: ${({ theme }) => theme.neutral1};
`

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <PageWrapper>
      <BackButton to="/">
        <ArrowLeft size={20} />
        <Trans>Back to App</Trans>
      </BackButton>

      <Title>
        <Trans>Privacy Policy</Trans>
      </Title>
      <LastModified>
        <Trans>Last Updated: November 12, 2025</Trans>
      </LastModified>

      <Section>
        <SectionTitle>
          <Trans>Introduction</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>
            This Privacy Policy (the &quot;Policy&quot;) explains how the Taiko DEX interface available at
          </Trans>{' '}
          <ExternalLink href="https://swap.taiko.xyz/">https://swap.taiko.xyz/</ExternalLink>{' '}
          <Trans>
            (the &quot;DEX&quot;, &quot;Interface&quot;, &quot;Services&quot;, &quot;we&quot;, &quot;us&quot; or
            &quot;our&quot;) collects, uses, and shares data in connection with your use of our decentralized exchange
            services. Your use of the Services is subject to this Policy as well as our
          </Trans>{' '}
          <Link to="/terms-of-service">
            <Trans>Terms of Service</Trans>
          </Link>
          .
        </Paragraph>

        <Notice>
          <Paragraph style={{ margin: 0 }}>
            <Strong>
              <Trans>Privacy is central to everything we do at Taiko.</Trans>
            </Strong>{' '}
            <Trans>
              Accordingly, we aspire to be transparent about what little data we do collect. We do not maintain user
              accounts and do not collect and store personal data, such as your name or internet protocol
              (&quot;IP&quot;) address.
            </Trans>
          </Paragraph>
        </Notice>

        <Paragraph>
          <Strong>
            <Trans>Important Distinction:</Trans>
          </Strong>{' '}
          <Trans>
            The Taiko DEX interface is separate from the underlying Taiko blockchain protocol and smart contracts. This
            Policy applies only to the DEX interface. The Taiko protocol is a decentralized, permissionless blockchain
            network that is not governed by any single entity.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Information We Do NOT Collect</Trans>
        </SectionTitle>
        <Paragraph>
          <Strong>
            <Trans>We do NOT collect and store personal data, including:</Trans>
          </Strong>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>First name, last name</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Street address</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Date of birth</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Email address</Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>IP address</Trans>
            </Strong>
          </BulletItem>
          <BulletItem>
            <Trans>Phone number</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Government-issued identification</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Financial account information</Trans>
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Information We Collect</Trans>
        </SectionTitle>

        <SubsectionTitle>
          <Trans>1. Publicly-Available Blockchain Data</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>
            When you connect your non-custodial blockchain wallet to the Services, we collect and log your
            publicly-available blockchain address to:
          </Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>Learn more about your use of the Services</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Screen your wallet for any prior illicit activity</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Improve our Services</Trans>
          </BulletItem>
        </BulletList>
        <Paragraph>
          <Trans>This information is publicly available on the Taiko blockchain and Ethereum blockchain.</Trans>
        </Paragraph>

        <SubsectionTitle>
          <Trans>2. Information from Web Tracking Tools</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>
            We use web tracking tools including cookies, web beacons, and similar technologies to collect information
            about your use of the Services. This may include:
          </Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>Device type (mobile, desktop, tablet)</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Browser type and version</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Browser or device language</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Operating system</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Referring and exit pages</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Date and time stamps</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Usage patterns and preferences</Trans>
          </BulletItem>
        </BulletList>
        <Paragraph>
          <Trans>
            You can manage your cookie preferences through your browser settings, limit advertising ID usage on mobile
            devices, or use privacy plug-ins or extensions.
          </Trans>
        </Paragraph>

        <SubsectionTitle>
          <Trans>3. Information from Third-Party Service Providers</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>
            We may receive information from third-party service providers that help us analyze blockchain data, prevent
            fraud, and improve our Services. We do not share your data with any third parties for marketing purposes.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>How We Use Information</Trans>
        </SectionTitle>

        <SubsectionTitle>
          <Trans>Provide and Improve Services</Trans>
        </SubsectionTitle>
        <BulletList>
          <BulletItem>
            <Trans>Operate, maintain, and enhance the DEX interface</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Make data-driven decisions to improve user experience</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Develop new features and functionality</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Analyze usage patterns and trends</Trans>
          </BulletItem>
        </BulletList>

        <SubsectionTitle>
          <Trans>Safety and Security</Trans>
        </SubsectionTitle>
        <BulletList>
          <BulletItem>
            <Trans>Detect and prevent fraudulent or illegal activity</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Screen for sanctioned addresses and illicit activity</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Identify and resolve potential security issues, such as bugs</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Protect the rights and safety of users and the Services</Trans>
          </BulletItem>
        </BulletList>

        <SubsectionTitle>
          <Trans>Legal Compliance</Trans>
        </SubsectionTitle>
        <BulletList>
          <BulletItem>
            <Trans>Comply with applicable laws, regulations, and legal processes</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Respond to lawful requests from government entities and law enforcement</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Enforce our Terms of Service and other agreements</Trans>
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Sharing and Disclosure of Information</Trans>
        </SectionTitle>

        <SubsectionTitle>
          <Trans>Service Providers</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>We may share information with third-party service providers who help us:</Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>Analyze blockchain data</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Detect illicit activity</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Improve security and prevent fraud</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Maintain and enhance our Services</Trans>
          </BulletItem>
        </BulletList>
        <Paragraph>
          <Trans>
            These providers are contractually obligated to protect your information and use it only for the purposes we
            specify.
          </Trans>
        </Paragraph>

        <SubsectionTitle>
          <Trans>Blockchain Data</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>
            All transaction data on the Taiko blockchain is public by nature. When you conduct transactions through the
            Services, this information is recorded on the blockchain and is publicly accessible.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Third-Party Services</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>The Services may integrate with or provide links to third-party services, including:</Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>Wallet providers</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Token bridges</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Analytics services</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>Other DeFi protocols</Trans>
          </BulletItem>
        </BulletList>
        <Paragraph>
          <Trans>
            This Policy does not apply to third-party services. We are not responsible for the privacy practices of
            third parties. We encourage you to review the privacy policies of any third-party services before using
            them.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Data Retention</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>
            We retain information only for as long as necessary to fulfill the purposes described in this Policy, unless
            a longer retention period is required or permitted by law. When information is no longer needed, we will
            delete or anonymize it.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Security</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>
            We implement reasonable security measures to protect your information from unauthorized access, alteration,
            disclosure, or destruction. However, no method of transmission over the internet or electronic storage is
            100% secure. We cannot guarantee absolute security.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Your Rights and Choices</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>Depending on your location, you may have certain rights regarding your information:</Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Strong>
              <Trans>Access:</Trans>
            </Strong>{' '}
            <Trans>Request information about the data we collect</Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Correction:</Trans>
            </Strong>{' '}
            <Trans>Request correction of inaccurate information</Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Deletion:</Trans>
            </Strong>{' '}
            <Trans>Request deletion of your information (subject to legal obligations)</Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Objection:</Trans>
            </Strong>{' '}
            <Trans>Object to certain processing of your information</Trans>
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Changes to This Policy</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>
            We may update this Policy from time to time to reflect changes in our practices or for other operational,
            legal, or regulatory reasons. We will notify you of material changes by posting the updated Policy on the
            Services with a new &quot;Last Updated&quot; date.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Trans>
            Your continued use of the Services after any changes indicates your acceptance of the updated Policy. We
            encourage you to review this Policy periodically.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Contact Us</Trans>
        </SectionTitle>
        <Paragraph>
          <Trans>
            If you have any questions, concerns, or requests regarding this Policy or our privacy practices, please
            contact us at:
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>Taiko DEX</Strong>
          <br />
          <Trans>Website:</Trans> <ExternalLink href="https://taiko.xyz">https://taiko.xyz</ExternalLink>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Additional Information About Taiko</Trans>
        </SectionTitle>
        <Paragraph>
          <Strong>
            <Trans>About Taiko:</Trans>
          </Strong>{' '}
          <Trans>
            Taiko is a fully open-source, permissionless, Ethereum-equivalent ZK-Rollup designed to scale Ethereum while
            maintaining its core principles of decentralization, security, and censorship resistance. The Taiko DEX
            interface provides access to decentralized exchange functionality on the Taiko network.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>Decentralization:</Trans>
          </Strong>{' '}
          <Trans>
            Taiko operates as a based rollup with no centralized sequencer, relying on Ethereum validators to maintain
            network decentralization and security.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>Transparency:</Trans>
          </Strong>{' '}
          <Trans>
            As an open-source project, Taiko&apos;s code is publicly available for review and audit, reinforcing our
            commitment to transparency and community collaboration.
          </Trans>
        </Paragraph>
      </Section>

      <Paragraph style={{ marginTop: 48, fontSize: 14, fontStyle: 'italic' }}>
        <Trans>
          This Privacy Policy is effective as of the date listed above and applies to all users of the Taiko DEX
          interface.
        </Trans>
      </Paragraph>
    </PageWrapper>
  )
}
