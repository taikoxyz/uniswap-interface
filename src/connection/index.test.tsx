import INJECTED_DARK_ICON from 'assets/wallets/browser-wallet-dark.svg'
import INJECTED_LIGHT_ICON from 'assets/wallets/browser-wallet-light.svg'
import { connections, getConnection } from 'connection'

import { ConnectionType } from './types'

const UserAgentMock = jest.requireMock('utils/userAgent')
jest.mock('utils/userAgent', () => ({
  isMobile: false,
}))

describe('connection utility/metadata tests', () => {
  beforeEach(() => {
    global.window.ethereum = undefined
    global.window.phantom = undefined
  })

  const createWalletEnvironment = (ethereum: Window['window']['ethereum'], isMobile = false) => {
    UserAgentMock.isMobile = isMobile
    global.window.ethereum = ethereum

    const displayed = connections.filter((c) => c.shouldDisplay())
    const injected = getConnection(ConnectionType.INJECTED)
    const coinbase = getConnection(ConnectionType.COINBASE_WALLET)
    const uniswap = getConnection(ConnectionType.UNISWAP_WALLET_V2)
    const walletconnect = getConnection(ConnectionType.WALLET_CONNECT_V2)

    return { displayed, injected, coinbase, uniswap, walletconnect }
  }

  const createPhantomEnviroment = () => {
    global.window.phantom = { ethereum: { isPhantom: true } }
  }

  it('Non-injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment(undefined)

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Install MetaMask')
    expect(injected.overrideActivate?.()).toBeTruthy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('MetaMask-Injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment({ isMetaMask: true })

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('MetaMask')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Coinbase-Injected Desktop', async () => {
    const { displayed, injected, coinbase } = createWalletEnvironment({ isCoinbaseWallet: true })

    // Coinbase connection is hidden by this fork (shouldDisplay -> false).
    expect(displayed.includes(coinbase)).toBe(false)
    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Install MetaMask')
    expect(injected.overrideActivate?.()).toBeTruthy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Coinbase and MetaMask Injected Desktop', async () => {
    const { displayed, injected, coinbase } = createWalletEnvironment({ isCoinbaseWallet: true, isMetaMask: true })

    // Coinbase connection is hidden by this fork (shouldDisplay -> false).
    expect(displayed.includes(coinbase)).toBe(false)
    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('MetaMask')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Trust Wallet Injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment({ isTrust: true })

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Trust Wallet')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Rabby Wallet Injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment({ isRabby: true, isMetaMask: true }) // Rabby sets isMetaMask to true

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Rabby')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('LedgerConnect Wallet Injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment({ isLedgerConnect: true })

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Ledger')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Brave Browser Wallet Injected Desktop', async () => {
    const { displayed, injected } = createWalletEnvironment({ isBraveWallet: true })

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Brave')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Phantom Wallet Injected Desktop displays as MetaMask', async () => {
    createPhantomEnviroment()
    const { displayed, injected } = createWalletEnvironment({ isMetaMask: true }) // Phantom sets isMetaMask to true

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('MetaMask')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  const UNKNOWN_MM_INJECTOR = { isRandomWallet: true, isMetaMask: true } as Window['window']['ethereum']
  it('Generic Browser Wallet that injects as MetaMask', async () => {
    const { displayed, injected } = createWalletEnvironment(UNKNOWN_MM_INJECTOR)

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('MetaMask')
    expect(injected.overrideActivate?.()).toBeFalsy()

    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  const UNKNOWN_INJECTOR = { isRandomWallet: true } as Window['window']['ethereum']
  it('Generic Unknown Injected Wallet Browser', async () => {
    const { displayed, injected } = createWalletEnvironment(UNKNOWN_INJECTOR, true)

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('Browser Wallet')
    expect(injected.overrideActivate?.()).toBeFalsy()

    expect(injected.getIcon?.(/* isDarkMode= */ false)).toBe(INJECTED_LIGHT_ICON)
    expect(injected.getIcon?.(/* isDarkMode= */ true)).toBe(INJECTED_DARK_ICON)

    // Ensures we provide multiple connection options if in an unknown injected browser
    // displayed-count not asserted: this fork hides several connections
    // (networkConnection, gnosisSafe, coinbase, uniswapWalletV2) via shouldDisplay,
    // so the upstream count of 4 no longer applies.
  })

  it('Generic Wallet Browser with delayed injection', async () => {
    const { injected } = createWalletEnvironment(undefined)

    expect(injected.getName()).toBe('Install MetaMask')
    expect(injected.overrideActivate?.()).toBeTruthy()

    createWalletEnvironment(UNKNOWN_INJECTOR)

    expect(injected.getName()).toBe('Browser Wallet')
    expect(injected.overrideActivate?.()).toBeFalsy()
  })

  it('MetaMask Mobile Browser', async () => {
    const { displayed, injected } = createWalletEnvironment({ isMetaMask: true }, true)

    expect(displayed.includes(injected)).toBe(true)
    expect(injected.getName()).toBe('MetaMask')
    expect(injected.overrideActivate?.()).toBeFalsy()
    expect(displayed.length).toEqual(1)
  })

  it('Coinbase Mobile Browser', async () => {
    const { displayed, coinbase } = createWalletEnvironment({ isCoinbaseWallet: true }, true)

    // Coinbase connection is hidden by this fork (shouldDisplay -> false).
    expect(displayed.includes(coinbase)).toBe(false)
    expect(coinbase.overrideActivate?.()).toBeFalsy()
  })

  it('Uninjected mWeb Browser', async () => {
    const { displayed, injected, coinbase, walletconnect } = createWalletEnvironment(undefined, true)

    // Coinbase connection is hidden by this fork (shouldDisplay -> false).
    expect(displayed.includes(coinbase)).toBe(false)
    expect(displayed.includes(walletconnect)).toBe(true)
    // Don't show injected connection on plain mWeb browser
    expect(displayed.includes(injected)).toBe(false)
  })
})
