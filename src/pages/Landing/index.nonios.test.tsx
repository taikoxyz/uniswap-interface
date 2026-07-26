import { render } from 'test-utils/render'

import Landing from '.'

jest.mock('utils/userAgent', () => {
  return {
    isIOS: false,
  }
})

// Skipped for the Taiko-only deployment: asserts the wallet.uniswap.org
// microsite link that upstream rendered on the landing page. The Taiko landing
// page removed the Uniswap Wallet download promotion entirely, so there is no
// microsite link to assert on.
it.skip('renders non-ios microsite link', () => {
  const { container } = render(<Landing />)
  expect(container.innerHTML.includes(`https://wallet.uniswap.org/?utm_source=home_page`)).toBeTruthy()
})
