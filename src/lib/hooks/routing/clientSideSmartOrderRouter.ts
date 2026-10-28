import { BigintIsh, ChainId, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
// This file is lazy-loaded, so the import of smart-order-router is intentional.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  AlphaRouter,
  AlphaRouterConfig,
  BatchParams,
  FailureOverrides,
  OnChainQuoteProvider,
  QuoteRetryOptions,
  UniswapMulticallProvider,
} from '@uniswap/smart-order-router'
import { isTaikoChain } from 'config/chains'
import { asSupportedChain } from 'constants/chains'
import { RPC_PROVIDERS } from 'constants/providers'
import { nativeOnChain } from 'constants/tokens'
import JSBI from 'jsbi'
import { GetQuoteArgs, QuoteResult, QuoteState, SwapRouterNativeAssets } from 'state/routing/types'
import { transformSwapRouteToGetQuoteResult } from 'utils/transformSwapRouteToGetQuoteResult'

// Declare routers cache - initialized as empty Map
let routersCache: Map<ChainId, AlphaRouter> | undefined

function getRoutersCache(): Map<ChainId, AlphaRouter> {
  if (!routersCache) {
    routersCache = new Map<ChainId, AlphaRouter>()
  }
  return routersCache
}

/**
 * Taiko nodes reject an eth_call whose execution exceeds the zk gas limit ("Revm error: zk gas limit
 * exceeded", -32005), which is far below the gas the smart-order-router's default quote batches can burn
 * (patched Taiko defaults: 10 quotes x 12M gas per eth_call).
 *
 * The limit is weighted per opcode, not per EVM gas, so the margin below is empirical and workload
 * dependent. Measured on Taiko mainnet: 6 full QuoterV2 quotes (~3.7M EVM gas) fit in one eth_call while
 * 7 (~4.25M) do not, but a hashing-heavy loop already fails at ~3.5M EVM gas. We therefore cap every quote
 * batch at 2 x 1.2M = 2.4M gas. 1.2M covers a single-hop quote that scans to the end of the tick range (~0.86M).
 */
export const TAIKO_QUOTE_BATCH_PARAMS: BatchParams = {
  multicallChunk: 2,
  gasLimitPerCall: 1_200_000,
  quoteMinSuccessRate: 0.1,
}

/**
 * Fallback used when a first pass leaves too many quotes failed (eg multi-hop quotes that need more than
 * the per-call budget above): one quote per eth_call with the whole 2.4M budget, so the worst case per
 * eth_call stays equal to the base batches while each quote gets twice the gas.
 */
export const TAIKO_QUOTE_FAILURE_OVERRIDES: FailureOverrides = {
  multicallChunk: 1,
  gasLimitOverride: 2_400_000,
}

export const TAIKO_QUOTE_RETRY_OPTIONS: QuoteRetryOptions = { retries: 2, minTimeout: 100, maxTimeout: 1000 }

// Same as the AlphaRouter default; pool/token reads are cheap and stay well under the zk gas limit.
export const TAIKO_MULTICALL_GAS_LIMIT_PER_CALL = 375_000

function createAlphaRouter(chainId: ChainId, provider: (typeof RPC_PROVIDERS)[keyof typeof RPC_PROVIDERS]) {
  if (!isTaikoChain(chainId)) return new AlphaRouter({ chainId, provider })

  const multicall2Provider = new UniswapMulticallProvider(chainId, provider, TAIKO_MULTICALL_GAS_LIMIT_PER_CALL)
  const onChainQuoteProvider = new OnChainQuoteProvider(
    chainId,
    provider,
    multicall2Provider,
    TAIKO_QUOTE_RETRY_OPTIONS,
    TAIKO_QUOTE_BATCH_PARAMS,
    TAIKO_QUOTE_FAILURE_OVERRIDES,
    TAIKO_QUOTE_FAILURE_OVERRIDES
  )
  return new AlphaRouter({ chainId, provider, multicall2Provider, onChainQuoteProvider })
}

export function getRouter(chainId: ChainId): AlphaRouter {
  const routers = getRoutersCache()
  const router = routers.get(chainId)
  if (router) return router

  const supportedChainId = asSupportedChain(chainId)
  if (supportedChainId) {
    const provider = RPC_PROVIDERS[supportedChainId]
    const newRouter = createAlphaRouter(chainId, provider)
    routers.set(chainId, newRouter)
    return newRouter
  }

  throw new Error(`Router does not support this chain (chainId: ${chainId}).`)
}

async function getQuote(
  {
    tradeType,
    tokenIn,
    tokenOut,
    amount: amountRaw,
  }: {
    tradeType: TradeType
    tokenIn: { address: string; chainId: number; decimals: number; symbol?: string }
    tokenOut: { address: string; chainId: number; decimals: number; symbol?: string }
    amount: BigintIsh
  },
  router: AlphaRouter,
  routerConfig: Partial<AlphaRouterConfig>
): Promise<QuoteResult> {
  const tokenInIsNative = Object.values(SwapRouterNativeAssets).includes(tokenIn.address as SwapRouterNativeAssets)
  const tokenOutIsNative = Object.values(SwapRouterNativeAssets).includes(tokenOut.address as SwapRouterNativeAssets)

  const currencyIn = tokenInIsNative
    ? nativeOnChain(tokenIn.chainId)
    : new Token(tokenIn.chainId, tokenIn.address, tokenIn.decimals, tokenIn.symbol)
  const currencyOut = tokenOutIsNative
    ? nativeOnChain(tokenOut.chainId)
    : new Token(tokenOut.chainId, tokenOut.address, tokenOut.decimals, tokenOut.symbol)

  const baseCurrency = tradeType === TradeType.EXACT_INPUT ? currencyIn : currencyOut
  const quoteCurrency = tradeType === TradeType.EXACT_INPUT ? currencyOut : currencyIn

  const amount = CurrencyAmount.fromRawAmount(baseCurrency, JSBI.BigInt(amountRaw))
  // TODO (WEB-2055): explore initializing client side routing on first load (when amountRaw is null) if there are enough users using client-side router preference.
  const swapRoute = await router.route(amount, quoteCurrency, tradeType, /*swapConfig=*/ undefined, routerConfig)

  if (!swapRoute) {
    return { state: QuoteState.NOT_FOUND }
  }

  return transformSwapRouteToGetQuoteResult(tradeType, amount, swapRoute)
}

export async function getClientSideQuote(
  {
    tokenInAddress,
    tokenInChainId,
    tokenInDecimals,
    tokenInSymbol,
    tokenOutAddress,
    tokenOutChainId,
    tokenOutDecimals,
    tokenOutSymbol,
    amount,
    tradeType,
  }: GetQuoteArgs,
  router: AlphaRouter,
  config: Partial<AlphaRouterConfig>
) {
  return getQuote(
    {
      tradeType,
      tokenIn: {
        address: tokenInAddress,
        chainId: tokenInChainId,
        decimals: tokenInDecimals,
        symbol: tokenInSymbol,
      },
      tokenOut: {
        address: tokenOutAddress,
        chainId: tokenOutChainId,
        decimals: tokenOutDecimals,
        symbol: tokenOutSymbol,
      },
      amount,
    },
    router,
    config
  )
}
