import { useDisableNFTRoutes } from 'hooks/useDisableNFTRoutes'
import { useIsMobile, useIsTablet } from 'nft/hooks'
import { useIsNavSearchInputVisible } from 'nft/hooks/useIsNavSearchInputVisible'
import { mocked } from 'test-utils/mocked'
import { render, screen } from 'test-utils/render'

import { SearchBar } from './SearchBar'

jest.mock('hooks/useDisableNFTRoutes')
jest.mock('nft/hooks')
jest.mock('nft/hooks/useIsNavSearchInputVisible')

describe('disable nft on searchbar', () => {
  beforeEach(() => {
    mocked(useIsMobile).mockReturnValue(false)
    mocked(useIsTablet).mockReturnValue(false)
    mocked(useIsNavSearchInputVisible).mockReturnValue(true)
  })

  // SearchBar's placeholder is driven by isMobileOrTablet, not
  // useDisableNFTRoutes, so the only placeholder we assert here is the desktop one.
  it('should render desktop placeholder', () => {
    mocked(useDisableNFTRoutes).mockReturnValue(false)
    const { container } = render(<SearchBar />)
    expect(container).toMatchSnapshot()
    expect(screen.queryByPlaceholderText('Search tokens and NFT collections')).toBeVisible()
  })
})
