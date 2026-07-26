import { ChainId } from '@uniswap/sdk-core'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

import { getChainPriority } from './chains'

// Define an array of test cases with chainId and expected priority.
// In this Taiko fork, Taiko Hoodi is the highest-priority chain and the
// upstream chains are each shifted down by one.
const chainPriorityTestCases: [ChainId | number, number][] = [
  [TAIKO_HOODI_CHAIN_ID, 0],
  [ChainId.MAINNET, 1],
  [ChainId.GOERLI, 1],
  [ChainId.SEPOLIA, 1],
  [ChainId.ARBITRUM_ONE, 2],
  [ChainId.ARBITRUM_GOERLI, 2],
  [ChainId.OPTIMISM, 3],
  [ChainId.OPTIMISM_GOERLI, 3],
  [ChainId.POLYGON, 4],
  [ChainId.POLYGON_MUMBAI, 4],
  [ChainId.BASE, 5],
  [ChainId.BNB, 6],
  [ChainId.AVALANCHE, 7],
  [ChainId.CELO, 8],
  [ChainId.CELO_ALFAJORES, 8],
  // Taiko mainnet is not explicitly prioritized and falls through to the default
  [TAIKO_MAINNET_CHAIN_ID, 10],
]

test.each(chainPriorityTestCases)(
  'getChainPriority returns expected priority for a given ChainId %O',
  (chainId: ChainId | number, expectedPriority: number) => {
    const priority = getChainPriority(chainId)
    expect(priority).toBe(expectedPriority)
  }
)
