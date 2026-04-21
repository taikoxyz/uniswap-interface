import { ChainId } from '@uniswap/sdk-core'

import { getChainPriority } from './chains'

// Define an array of test cases with chainId and expected priority
// Priorities are offset by 1 from Uniswap's upstream because TAIKO_HOODI_CHAIN_ID
// takes priority 0 (see getChainPriority in ./chains).
const chainPriorityTestCases: [ChainId, number][] = [
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
]

test.each(chainPriorityTestCases)(
  'getChainPriority returns expected priority for a given ChainId %O',
  (chainId: ChainId, expectedPriority: number) => {
    const priority = getChainPriority(chainId)
    expect(priority).toBe(expectedPriority)
  }
)
