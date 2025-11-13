import { ChainId, Token } from '@uniswap/sdk-core'
import { ChainTokenMap } from 'hooks/Tokens'

// Common tokens on Taiko Mainnet
const TAIKO_MAINNET_COMMON_TOKENS = [
  {
    address: '0xA51894664A773981C6C112C43ce576f315d5b1B6',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  {
    address: '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0xA9d23408b9bA935c230493c40C73824Df71A0975',
    symbol: 'TAIKO',
    name: 'Taiko Token',
    decimals: 18,
  },
  {
    address: '0x9c2dc7377717603eB92b2655c5f2E7997a4945BD',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
]

// Common tokens on Taiko Hoodi
const TAIKO_HOODI_COMMON_TOKENS = [
  {
    address: '0x3B39685B5495359c892DDD1057B5712F49976835',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  {
    address: '0xF2382db1E08b17a81566093F59E46f8DB2026202',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
]

/**
 * Creates a token map for Taiko chains with common tokens
 */
export function getTaikoTokenMap(): ChainTokenMap {
  const taikoMap: ChainTokenMap = {}

  // Add Taiko Mainnet tokens
  const taikoMainnetTokens: { [address: string]: Token } = {}
  TAIKO_MAINNET_COMMON_TOKENS.forEach((tokenInfo) => {
    const token = new Token(167000, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
    taikoMainnetTokens[tokenInfo.address.toLowerCase()] = token
  })
  taikoMap[167000] = taikoMainnetTokens

  // Add Taiko Hoodi tokens
  const taikoHoodiTokens: { [address: string]: Token } = {}
  TAIKO_HOODI_COMMON_TOKENS.forEach((tokenInfo) => {
    const token = new Token(167013, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
    taikoHoodiTokens[tokenInfo.address.toLowerCase()] = token
  })
  taikoMap[167013] = taikoHoodiTokens

  return taikoMap
}

/**
 * Merges Taiko tokens with existing token map
 */
export function mergeTaikoTokens(existingMap: ChainTokenMap): ChainTokenMap {
  const taikoTokens = getTaikoTokenMap()
  const merged = { ...existingMap }

  // Merge Taiko tokens into the map
  Object.keys(taikoTokens).forEach((chainIdStr) => {
    const chainId = Number(chainIdStr)
    merged[chainId] = {
      ...merged[chainId],
      ...taikoTokens[chainId],
    }
  })

  return merged
}
