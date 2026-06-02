import { getAddress } from '@ethersproject/address'

import { getTaikoTokenMap, mergeTaikoTokens } from './getTaikoTokenMap'

const TAIKO_MAINNET_CHAIN_ID = 167000
// Checksummed TAIKO token address (as produced by currencyId() / ethers Contract.address).
const TAIKO_ADDRESS = '0xA9d23408b9bA935c230493c40C73824Df71A0975'

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

  it('uses the checksummed address as the key for every common token', () => {
    const mainnet = getTaikoTokenMap()[TAIKO_MAINNET_CHAIN_ID]!
    Object.entries(mainnet).forEach(([key, token]) => {
      expect(key).toBe(getAddress(key))
      expect(token?.address).toBe(key)
    })
  })

  it('merges Taiko tokens into an existing map under checksummed keys', () => {
    const merged = mergeTaikoTokens({})
    expect(merged[TAIKO_MAINNET_CHAIN_ID]?.[TAIKO_ADDRESS]?.symbol).toBe('TAIKO')
  })
})
