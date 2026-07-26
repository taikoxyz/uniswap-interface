import { ReactNode } from 'react'
import styled from 'styled-components'

// Card shapes consumed by pages/Landing (all entries are currently commented out, so the
// explicit types keep the empty arrays from collapsing to never[]).
interface MainCard {
  to: string
  title: string
  description: string
  cta?: string
  darkBackgroundImgSrc: string
  lightBackgroundImgSrc: string
  elementName?: string
}

interface MoreCard {
  to: string
  external?: boolean
  title: string
  description: string
  cta?: string
  lightIcon: ReactNode
  darkIcon: ReactNode
  elementName?: string
}

export const MAIN_CARDS: MainCard[] = [
  // {
  //   to: '/swap',
  //   title: 'Swap tokens',
  //   description: 'Buy, sell, and explore tokens on Ethereum, Polygon, Optimism, and more.',
  //   cta: 'Trade Tokens',
  //   darkBackgroundImgSrc: swapCardImgSrc,
  //   lightBackgroundImgSrc: swapCardImgSrc,
  //   elementName: InterfaceElementName.ABOUT_PAGE_SWAP_CARD,
  // },
  // {
  //   to: '/nfts',
  //   title: 'Trade NFTs',
  //   description: 'Buy and sell NFTs across marketplaces to find more listings at better prices.',
  //   cta: 'Explore NFTs',
  //   darkBackgroundImgSrc: nftCardImgSrc,
  //   lightBackgroundImgSrc: nftCardImgSrc,
  //   elementName: InterfaceElementName.ABOUT_PAGE_NFTS_CARD,
  // },
]

const StyledCardLogo = styled.img`
  min-width: 20px;
  min-height: 20px;
  max-height: 48px;
  max-width: 48px;
`

export const MORE_CARDS: MoreCard[] = [
  // {
  //   to: 'https://support.uniswap.org/hc/en-us/articles/11306574799117-How-to-use-Moon-Pay-on-the-Uniswap-web-app-',
  //   external: true,
  //   title: 'Buy crypto',
  //   description: 'Buy crypto with your credit card or bank account at the best rates.',
  //   lightIcon: <DollarSign color={lightTheme.neutral3} size={48} />,
  //   darkIcon: <StyledCardLogo src={darkDollarImgSrc} alt="Earn" />,
  //   cta: 'Buy now',
  //   elementName: InterfaceElementName.ABOUT_PAGE_BUY_CRYPTO_CARD,
  // },
  // {
  //   to: '/pools',
  //   title: 'Earn',
  //   description: 'Provide liquidity to pools on Uniswap and earn fees on swaps.',
  //   lightIcon: <StyledCardLogo src={lightArrowImgSrc} alt="Analytics" />,
  //   darkIcon: <StyledCardLogo src={darkArrowImgSrc} alt="Analytics" />,
  //   cta: 'Provide liquidity',
  //   elementName: InterfaceElementName.ABOUT_PAGE_EARN_CARD,
  // },
  // {
  //   to: 'https://docs.uniswap.org',
  //   external: true,
  //   title: 'Build dApps',
  //   description: 'Build apps and tools on the largest DeFi protocol on Ethereum.',
  //   lightIcon: <Terminal color={lightTheme.neutral3} size={48} />,
  //   darkIcon: <StyledCardLogo src={darkTerminalImgSrc} alt="Developers" />,
  //   cta: 'Developer docs',
  //   elementName: InterfaceElementName.ABOUT_PAGE_DEV_DOCS_CARD,
  // },
]
