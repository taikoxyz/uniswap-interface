import { useWeb3React } from '@web3-react/core'
import { useMemo } from 'react'
import { Contract } from '@ethersproject/contracts'
import { useEffect, useState } from 'react'
import { Token } from '@uniswap/sdk-core'
import { RPC_PROVIDERS } from 'constants/providers'
import { useTaikoPortfolio, useTaikoTokenPrices } from 'graphql/taiko/TaikoPortfolio'
import { isTaikoChain } from 'config/chains/taiko'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// Common token addresses on Taiko Mainnet
const TAIKO_MAINNET_TOKEN_ADDRESSES = [
  '0xA51894664A773981C6C112C43ce576f315d5b1B6', // WETH
  '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b', // USDC
  '0xA9d23408b9bA935c230493c40C73824Df71A0975', // TAIKO
  '0x9c2dc7377717603eB92b2655c5f2E7997a4945BD', // USDT
]

// Common token addresses on Taiko Hoodi
const TAIKO_HOODI_TOKEN_ADDRESSES = [
  '0x3B39685B5495359c892DDD1057B5712F49976835', // WETH
  '0xF2382db1E08b17A81566093f59E46F8db2026202', // USDC (checksummed)
]

export interface TokenBalance {
  token: Token
  balance: string
  balanceUSD: number
}

export interface UseTaikoPortfolioValueResult {
  tokenBalances: TokenBalance[]
  lpPositionsValueUSD: number
  totalValueUSD: number
  loading: boolean
}

/**
 * Hook to calculate total portfolio value for Taiko chains
 * Combines token balances + LP positions value
 */
export function useTaikoPortfolioValue(account: string | undefined): UseTaikoPortfolioValueResult {
  const { chainId } = useWeb3React()
  const isTaiko = chainId && isTaikoChain(chainId)

  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)

  // Get token addresses based on chain
  const tokenAddresses = useMemo(() => {
    if (!chainId) return []
    return chainId === 167000 ? TAIKO_MAINNET_TOKEN_ADDRESSES : TAIKO_HOODI_TOKEN_ADDRESSES
  }, [chainId])

  // Get token prices from subgraph
  const { tokenPrices, loading: pricesLoading } = useTaikoTokenPrices(chainId || 167000, tokenAddresses)

  // Get LP positions value from subgraph
  const { totalValueUSD: lpPositionsValueUSD, loading: lpLoading } = useTaikoPortfolio(
    chainId || 167000,
    account || ''
  )

  // Fetch token balances on-chain
  useEffect(() => {
    if (!isTaiko || !chainId || !account || pricesLoading || tokenPrices.size === 0) {
      if (!isTaiko || !chainId || !account) {
        setTokenBalances([])
        setLoading(false)
      }
      return
    }

    const fetchBalances = async () => {
      setLoading(true)
      try {
        const provider = RPC_PROVIDERS[chainId]
        if (!provider) {
          setLoading(false)
          return
        }

        const balancePromises = tokenAddresses.map(async (tokenAddress) => {
          try {
            const tokenInfo = tokenPrices.get(tokenAddress.toLowerCase())
            if (!tokenInfo) return null

            const contract = new Contract(tokenAddress, ERC20_ABI, provider)
            const rawBalance = await contract.balanceOf(account)

            if (rawBalance.gt(0)) {
              const balance = rawBalance.toString()
              const balanceNum = parseFloat(balance) / Math.pow(10, tokenInfo.decimals)
              const balanceUSD = balanceNum * tokenInfo.priceUSD

              const token = new Token(
                chainId,
                tokenInfo.address,
                tokenInfo.decimals,
                tokenInfo.symbol,
                tokenInfo.name
              )

              return {
                token,
                balance: balanceNum.toFixed(6),
                balanceUSD,
              }
            }
            return null
          } catch (error) {
            console.error(`Error fetching balance for ${tokenAddress}:`, error)
            return null
          }
        })

        const results = await Promise.all(balancePromises)
        const validBalances = results.filter((b): b is TokenBalance => b !== null)
        setTokenBalances(validBalances)
      } catch (error) {
        console.error('Error fetching token balances:', error)
        setTokenBalances([])
      } finally {
        setLoading(false)
      }
    }

    fetchBalances()
  }, [isTaiko, chainId, account, tokenAddresses, tokenPrices, pricesLoading])

  const totalValueUSD = useMemo(() => {
    const tokenBalancesTotal = tokenBalances.reduce((sum, tb) => sum + tb.balanceUSD, 0)
    return tokenBalancesTotal + lpPositionsValueUSD
  }, [tokenBalances, lpPositionsValueUSD])

  return useMemo(
    () => ({
      tokenBalances,
      lpPositionsValueUSD,
      totalValueUSD,
      loading: loading || lpLoading || pricesLoading,
    }),
    [tokenBalances, lpPositionsValueUSD, totalValueUSD, loading, lpLoading, pricesLoading]
  )
}
