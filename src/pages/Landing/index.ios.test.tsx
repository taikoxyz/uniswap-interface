import { render } from 'test-utils/render'

import Landing from '.'

jest.mock('utils/userAgent', () => {
  return {
    isIOS: true,
  }
})

// Skipped for the Taiko-only deployment: asserts the Uniswap Wallet iOS App
// Store link that upstream rendered on the landing page. The Taiko landing
// page removed the Uniswap Wallet download promotion entirely, so there is no
// microsite link to assert on.
it.skip('renders ios microsite link', () => {
  const { container } = render(<Landing />)
  expect(container.innerHTML.includes(`https://apps.apple.com/app/apple-store/id6443944476`)).toBeTruthy()
})
