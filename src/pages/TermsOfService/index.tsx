import { Trans } from '@lingui/macro'
import { useEffect } from 'react'
import { ArrowLeft } from 'react-feather'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { ExternalLink, ThemedText } from 'theme'

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

export default function TermsOfService() {
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
        <Trans>Terms of Service</Trans>
      </Title>
      <LastModified>
        <Trans>Last Modified: November 12, 2025</Trans>
      </LastModified>

      <Notice>
        <ThemedText.SubHeader>
          <Strong>
            <Trans>IMPORTANT:</Trans>
          </Strong>{' '}
          <Trans>
            This Agreement contains important information, including a binding arbitration provision and a class
            action waiver, both of which impact your rights as to how disputes are resolved. Our Services are only
            available to you — and you should only access any of our Services — if you agree completely with these
            terms.
          </Trans>
        </ThemedText.SubHeader>
      </Notice>

      <Paragraph>
        <Trans>
          These Terms of Service (the &quot;Agreement&quot; or &quot;Terms&quot;) explain the terms and conditions
          by which you may access and use the Services provided in connection with{' '}
        </Trans>
        <ExternalLink href="https://swap.hoodi.taiko.xyz/">https://swap.hoodi.taiko.xyz/</ExternalLink>
        <Trans>
          {' '}
          (referred to herein as &quot;Taiko DEX,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). The
          Services shall include the website-hosted user interface (the &quot;Interface&quot; or &quot;DEX&quot;)
          and any other services that link to this Agreement.
        </Trans>
      </Paragraph>

      <Paragraph>
        <Trans>
          You must read this Agreement carefully as it governs your use of the Services. By accessing or using any
          of the Services, you signify that you have read, understand, and agree to be bound by this Agreement in
          its entirety. If you do not agree, you are not authorized to access or use the Services and should not use
          the Services.
        </Trans>
      </Paragraph>

      <Section>
        <SectionTitle>1. Our Services</SectionTitle>

        <SubsectionTitle>1.1 The Interface</SubsectionTitle>
        <Paragraph>
          <Trans>
            The Interface provides a web-based means of access to decentralized exchange functionality on the Taiko
            blockchain network, which allows users to swap certain compatible digital assets. The Interface is a fork
            of the Uniswap interface, adapted for use on the Taiko network.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Trans>
            The Interface is distinct from the underlying blockchain protocols and smart contracts and is one, but
            not the exclusive, means of accessing decentralized exchange functionality on Taiko. We do not control or
            operate the underlying blockchain protocols, smart contracts, or the Taiko network itself.
          </Trans>
        </Paragraph>

        <SubsectionTitle>1.2 The Taiko Network</SubsectionTitle>
        <Paragraph>
          <Trans>
            Taiko is a fully open-source, permissionless, Ethereum-equivalent ZK-Rollup. The Taiko network operates
            as a based rollup with decentralized sequencing. While we provide an interface to access functionality on
            Taiko, we do not control, own, or operate the Taiko blockchain, its smart contracts, or the underlying
            protocols.
          </Trans>
        </Paragraph>

        <SubsectionTitle>1.3 Non-Custodial and No Fiduciary Duties</SubsectionTitle>
        <Paragraph>
          <Trans>
            The Services are non-custodial, meaning we do not custody, control, or manage user funds or private keys.
            You are solely responsible for the custody of the cryptographic private keys to the digital asset wallets
            you hold.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Trans>
            This Agreement is not intended to, and does not, create or impose any fiduciary duties on us. To the
            fullest extent permitted by law, you acknowledge and agree that we owe no fiduciary duties or liabilities
            to you or any other party, and that to the extent any such duties or liabilities may exist at law or in
            equity, those duties and liabilities are hereby irrevocably disclaimed, waived, and eliminated.
          </Trans>
        </Paragraph>

        <SubsectionTitle>1.4 Wallet Connection</SubsectionTitle>
        <Paragraph>
          <Trans>
            To access the Interface, you must use a non-custodial wallet software, which allows you to interact with
            public blockchains. Your relationship with that non-custodial wallet provider is governed by the
            applicable terms of service of that provider. We do not have custody or control over the contents of your
            wallet and have no ability to retrieve or transfer its contents.
          </Trans>
        </Paragraph>

        <SubsectionTitle>1.5 Fees</SubsectionTitle>
        <Paragraph>
          <Strong>
            <Trans>Transaction Fees:</Trans>
          </Strong>{' '}
          <Trans>
            When you use the Interface to conduct transactions on the Taiko network, you will be required to pay
            network fees (gas fees) to validators on the Taiko network.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>Interface Fees:</Trans>
          </Strong>{' '}
          <Trans>
            We may charge fees for use of the Interface. Any applicable fees will be displayed to you before you
            complete a transaction.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>Third-Party Fees:</Trans>
          </Strong>{' '}
          <Trans>
            Third parties may charge fees for services integrated with or accessed through the Interface. You are
            solely responsible for paying all such fees.
          </Trans>
        </Paragraph>

        <SubsectionTitle>1.6 Third-Party Services and Content</SubsectionTitle>
        <Paragraph>
          <Trans>
            Our Services may include integrations, links, or other access to third-party services, sites, technology,
            APIs, content, and resources (each a &quot;Third-Party Service&quot;). Your access and use of the
            Third-Party Services may also be subject to additional terms and conditions, privacy policies, or other
            agreements with such third party.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Trans>
            You agree to comply with all terms, conditions, and policies applicable to any Third-Party Services. You,
            and not Taiko DEX, will be responsible for any and all costs and charges associated with your use of any
            Third-Party Services. We enable these Third-Party Services merely as a convenience and the integration or
            inclusion of such Third-Party Services does not imply an endorsement or recommendation.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>2. Eligibility</SectionTitle>
        <Paragraph>
          <Trans>To access or use the Services, you must satisfy each of the following eligibility requirements:</Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Trans>
              You are at least 18 years of age or the legal age for entering into legally binding agreements under
              applicable law
            </Trans>
          </BulletItem>
          <BulletItem>
            <Trans>
              You are not a resident, national, or agent of, or an entity organized, incorporated, or doing business
              in any Prohibited Jurisdiction
            </Trans>
          </BulletItem>
          <BulletItem>
            <Trans>
              You are not listed on, or affiliated with any person or entity listed on, any Sanctions Lists
            </Trans>
          </BulletItem>
          <BulletItem>
            <Trans>You do not intend to transact with any Restricted Person or Prohibited Jurisdiction</Trans>
          </BulletItem>
          <BulletItem>
            <Trans>
              You are not using, and will not in the future use, a VPN or other privacy tool to circumvent the
              restrictions set out in this Agreement
            </Trans>
          </BulletItem>
          <BulletItem>
            <Trans>
              Your access does not violate any Applicable Laws or contribute to or facilitate any illegal activity
            </Trans>
          </BulletItem>
          <BulletItem>
            <Trans>You have not been previously suspended or removed from using our Services</Trans>
          </BulletItem>
        </BulletList>
      </Section>

      <Section>
        <SectionTitle>3. No Warranties</SectionTitle>
        <Paragraph>
          <Strong>
            <Trans>
              Each of our Services and any Third-Party Services are provided on an &quot;AS IS&quot; and &quot;AS
              AVAILABLE&quot; basis. TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND ANY PROVIDERS OF THIRD-PARTY
              SERVICES DISCLAIM ANY REPRESENTATIONS AND WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR
              STATUTORY, INCLUDING, BUT NOT LIMITED TO, THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
              PARTICULAR PURPOSE.
            </Trans>
          </Strong>
        </Paragraph>
        <Paragraph>
          <Trans>YOU ACKNOWLEDGE AND AGREE THAT YOUR USE OF EACH OF OUR SERVICES IS AT YOUR OWN RISK.</Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>4. Limitation of Liability</SectionTitle>
        <Paragraph>
          <Strong>
            <Trans>
              TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE BE LIABLE TO YOU FOR ANY INCIDENTAL,
              INDIRECT, SPECIAL, PUNITIVE, CONSEQUENTIAL OR SIMILAR DAMAGES OR LIABILITIES WHATSOEVER ARISING OUT OF
              OR IN CONNECTION WITH THE SERVICES.
            </Trans>
          </Strong>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>
              OUR TOTAL LIABILITY TO YOU FOR ANY DAMAGES, LOSSES, AND CAUSES OF ACTION SHALL NOT EXCEED ONE HUNDRED
              U.S. DOLLARS ($100).
            </Trans>
          </Strong>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>5. Dispute Resolution</SectionTitle>
        <Notice>
          <Strong>
            <Trans>
              PLEASE READ THIS SECTION CAREFULLY. IT REQUIRES YOU TO ARBITRATE DISPUTES WITH US AND LIMITS THE MANNER
              IN WHICH YOU CAN SEEK RELIEF FROM US.
            </Trans>
          </Strong>
        </Notice>
        <Paragraph>
          <Trans>
            You and we agree that any dispute, claim, or controversy between you and us arising in connection with or
            relating in any way to this Agreement or to your relationship with us will be determined by mandatory
            binding individual (not class) arbitration.
          </Trans>
        </Paragraph>
        <Paragraph>
          <Strong>
            <Trans>
              YOU AGREE THAT, BY ENTERING INTO THIS AGREEMENT, YOU AND WE ARE EACH WAIVING THE RIGHT TO A TRIAL BY
              JURY OR TO PARTICIPATE IN A CLASS ACTION.
            </Trans>
          </Strong>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>6. Governing Law</SectionTitle>
        <Paragraph>
          <Trans>
            This Agreement and any action related thereto will be governed by the laws of the Cayman Islands without
            regard to its conflict of laws provisions.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>7. Privacy Policy</SectionTitle>
        <Paragraph>
          <Trans>Please refer to our</Trans>{' '}
          <Link to="/privacy-policy">
            <Trans>Privacy Policy</Trans>
          </Link>{' '}
          <Trans>
            for information about how we collect, use, and disclose information about you. The Privacy Policy is
            incorporated into this Agreement by reference.
          </Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>8. Contact Us</SectionTitle>
        <Paragraph>
          <Trans>We welcome comments, questions, concerns, or suggestions. Please visit</Trans>{' '}
          <ExternalLink href="https://taiko.xyz">https://taiko.xyz</ExternalLink>{' '}
          <Trans>for more information.</Trans>
        </Paragraph>
      </Section>

      <Section>
        <SectionTitle>
          <Trans>Additional Disclosures</Trans>
        </SectionTitle>

        <SubsectionTitle>
          <Trans>Blockchain Technology Risks</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>By using the Services, you understand and accept that:</Trans>
        </Paragraph>
        <BulletList>
          <BulletItem>
            <Strong>
              <Trans>Blockchain transactions are irreversible:</Trans>
            </Strong>{' '}
            <Trans>Once a transaction is confirmed on the blockchain, it cannot be reversed, cancelled, or refunded</Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Network congestion:</Trans>
            </Strong>{' '}
            <Trans>
              The Taiko network and underlying blockchain infrastructure may experience periods of congestion,
              leading to delayed transactions and higher fees
            </Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Smart contract risks:</Trans>
            </Strong>{' '}
            <Trans>
              Smart contracts are subject to bugs, vulnerabilities, and exploits. We do not guarantee the security or
              functionality of any smart contracts
            </Trans>
          </BulletItem>
          <BulletItem>
            <Strong>
              <Trans>Wallet security:</Trans>
            </Strong>{' '}
            <Trans>
              You are solely responsible for securing your wallet and private keys. Loss of private keys may result
              in permanent loss of assets
            </Trans>
          </BulletItem>
        </BulletList>

        <SubsectionTitle>
          <Trans>Tax Obligations</Trans>
        </SubsectionTitle>
        <Paragraph>
          <Trans>
            You are solely responsible for determining what, if any, taxes apply to your transactions and to
            withhold, collect, report, and remit the correct amounts of taxes to the appropriate tax authorities. We
            are not responsible for determining, withholding, collecting, reporting, or remitting the taxes that
            apply to your transactions.
          </Trans>
        </Paragraph>
      </Section>

      <Paragraph style={{ marginTop: 48, fontSize: 14, fontStyle: 'italic' }}>
        <Trans>Last Updated: November 12, 2025</Trans>
      </Paragraph>
    </PageWrapper>
  )
}
