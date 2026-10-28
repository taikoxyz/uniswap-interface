import { ChainId } from '@uniswap/sdk-core'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { AlphaRouter, OnChainQuoteProvider, UniswapMulticallProvider } from '@uniswap/smart-order-router'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { RPC_PROVIDERS } from 'constants/providers'

import {
  getRouter,
  TAIKO_MULTICALL_GAS_LIMIT_PER_CALL,
  TAIKO_QUOTE_BATCH_PARAMS,
  TAIKO_QUOTE_FAILURE_OVERRIDES,
  TAIKO_QUOTE_RETRY_OPTIONS,
} from './clientSideSmartOrderRouter'

jest.mock('@uniswap/smart-order-router', () => ({
  AlphaRouter: jest.fn(),
  OnChainQuoteProvider: jest.fn(),
  UniswapMulticallProvider: jest.fn(),
}))

const MockAlphaRouter = AlphaRouter as jest.MockedClass<typeof AlphaRouter>
const MockOnChainQuoteProvider = OnChainQuoteProvider as jest.MockedClass<typeof OnChainQuoteProvider>
const MockUniswapMulticallProvider = UniswapMulticallProvider as jest.MockedClass<typeof UniswapMulticallProvider>

// Measured against rpc.mainnet.taiko.xyz: 6 full QuoterV2 quotes (~3.7M EVM gas) in one eth_call succeed,
// 7 (~4.25M) fail with "Revm error: zk gas limit exceeded". The limit is weighted per opcode (a hashing-heavy
// loop fails at ~3.5M EVM gas), so this only guards against regressions in the constants, not against the node's
// actual limit moving or a heavier workload: re-measure against the live RPC when changing the values.
const LOWEST_FAILING_QUOTE_BATCH_GAS = 4_250_000

describe('getRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([TAIKO_MAINNET_CHAIN_ID, TAIKO_HOODI_CHAIN_ID])(
    'builds chain %s with small quote batches that stay under the zk gas limit',
    (chainId) => {
      const router = getRouter(chainId as ChainId)
      const provider = RPC_PROVIDERS[chainId as keyof typeof RPC_PROVIDERS]

      expect(MockUniswapMulticallProvider).toHaveBeenCalledWith(chainId, provider, TAIKO_MULTICALL_GAS_LIMIT_PER_CALL)
      const multicall2Provider = MockUniswapMulticallProvider.mock.instances[0]

      expect(MockOnChainQuoteProvider).toHaveBeenCalledWith(
        chainId,
        provider,
        multicall2Provider,
        TAIKO_QUOTE_RETRY_OPTIONS,
        TAIKO_QUOTE_BATCH_PARAMS,
        TAIKO_QUOTE_FAILURE_OVERRIDES,
        TAIKO_QUOTE_FAILURE_OVERRIDES
      )
      expect(MockAlphaRouter).toHaveBeenCalledWith({
        chainId,
        provider,
        multicall2Provider,
        onChainQuoteProvider: MockOnChainQuoteProvider.mock.instances[0],
      })
      expect(router).toBe(MockAlphaRouter.mock.instances[0])
    }
  )

  it('caches the router per chain', () => {
    const first = getRouter(TAIKO_MAINNET_CHAIN_ID as ChainId)
    const second = getRouter(TAIKO_MAINNET_CHAIN_ID as ChainId)

    expect(second).toBe(first)
  })

  it('keeps the worst-case gas of every Taiko quote batch well below the observed zk gas limit', () => {
    const batches = [
      TAIKO_QUOTE_BATCH_PARAMS.multicallChunk * TAIKO_QUOTE_BATCH_PARAMS.gasLimitPerCall,
      TAIKO_QUOTE_FAILURE_OVERRIDES.multicallChunk * TAIKO_QUOTE_FAILURE_OVERRIDES.gasLimitOverride,
    ]

    batches.forEach((worstCaseGas) => expect(worstCaseGas).toBeLessThanOrEqual(LOWEST_FAILING_QUOTE_BATCH_GAS * 0.6))
  })

  it('makes the retry overrides a real fallback: more gas per quote at the same worst case per eth_call', () => {
    const baseWorstCase = TAIKO_QUOTE_BATCH_PARAMS.multicallChunk * TAIKO_QUOTE_BATCH_PARAMS.gasLimitPerCall
    const fallbackWorstCase =
      TAIKO_QUOTE_FAILURE_OVERRIDES.multicallChunk * TAIKO_QUOTE_FAILURE_OVERRIDES.gasLimitOverride

    expect(TAIKO_QUOTE_FAILURE_OVERRIDES.gasLimitOverride).toBeGreaterThan(TAIKO_QUOTE_BATCH_PARAMS.gasLimitPerCall)
    expect(TAIKO_QUOTE_FAILURE_OVERRIDES.multicallChunk).toBeLessThan(TAIKO_QUOTE_BATCH_PARAMS.multicallChunk)
    expect(fallbackWorstCase).toBeLessThanOrEqual(baseWorstCase)
  })

  it('leaves non-Taiko chains on the smart-order-router defaults', () => {
    getRouter(ChainId.MAINNET)

    expect(MockAlphaRouter).toHaveBeenCalledWith({ chainId: ChainId.MAINNET, provider: undefined })
    expect(MockOnChainQuoteProvider).not.toHaveBeenCalled()
    expect(MockUniswapMulticallProvider).not.toHaveBeenCalled()
  })

  it('throws for unsupported chains', () => {
    expect(() => getRouter(12345 as ChainId)).toThrow('Router does not support this chain (chainId: 12345).')
  })
})
