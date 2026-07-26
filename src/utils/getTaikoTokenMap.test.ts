import { getAddress } from '@ethersproject/address'

import { getTaikoTokenMap, mergeTaikoTokens } from './getTaikoTokenMap'

const TAIKO_MAINNET_CHAIN_ID = 167000
const TAIKO_HOODI_CHAIN_ID = 167013
// Checksummed TAIKO token address (as produced by currencyId() / ethers Contract.address).
const TAIKO_ADDRESS = '0xA9d23408b9bA935c230493c40C73824Df71A0975'
// Checksummed WETH address on Taiko Hoodi.
const HOODI_WETH_ADDRESS = '0x3B39685B5495359c892DDD1057B5712F49976835'

describe('getTaikoTokenMap', () => {
  it('keys tokens by their checksummed address so lookups by currencyId resolve (not "Unknown")', () => {
    const map = getTaikoTokenMap()
    const mainnet = map[TAIKO_MAINNET_CHAIN_ID]!

    // The activity/popup code looks tokens up by the checksummed currencyId, e.g.
    // tokens[chainId][approval.tokenAddress]. That key must exist.
    expect(mainnet[TAIKO_ADDRESS]).toBeDefined()
    expect(mainnet[TAIKO_ADDRESS]?.symbol).toBe('TAIKO')

    // Guard against a regression to lowercase keying, which made every lookup miss.
    expect(mainnet[TAIKO_ADDRESS.toLowerCase()]).toBeUndefined()
  })

  it.each([TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID])(
    'uses the checksummed address as the key for every common token on chain %i',
    (chainId) => {
      const tokens = getTaikoTokenMap()[chainId]!
      expect(Object.keys(tokens).length).toBeGreaterThan(0)
      Object.entries(tokens).forEach(([key, token]) => {
        expect(key).toBe(getAddress(key))
        expect(token?.address).toBe(key)
      })
    }
  )

  it('keys Hoodi tokens by their checksummed address so lookups by currencyId resolve', () => {
    const hoodi = getTaikoTokenMap()[TAIKO_HOODI_CHAIN_ID]!
    expect(hoodi[HOODI_WETH_ADDRESS]?.symbol).toBe('WETH')
    expect(hoodi[HOODI_WETH_ADDRESS.toLowerCase()]).toBeUndefined()
  })

  it('merges Taiko tokens into an existing map under checksummed keys', () => {
    const merged = mergeTaikoTokens({})
    expect(merged[TAIKO_MAINNET_CHAIN_ID]?.[TAIKO_ADDRESS]?.symbol).toBe('TAIKO')
    expect(merged[TAIKO_HOODI_CHAIN_ID]?.[HOODI_WETH_ADDRESS]?.symbol).toBe('WETH')
  })
})
