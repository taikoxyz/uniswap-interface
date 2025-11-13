import { ChainId, Token } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import ERC20_ABI from 'abis/erc20.json'
import { Contract } from 'ethers'
import { useEffect, useState } from 'react'
import { RPC_PROVIDERS } from 'constants/providers'

export interface TaikoTokenBalance {
  token: Token
  balance: string
  rawBalance: string
}

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
    address: '0xF2382db1E08b17A81566093f59E46F8db2026202',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
]

/**
 * Fetches token balances for common tokens on Taiko chains
 */
export function useTaikoTokenBalances(account: string | undefined, chainId: ChainId | undefined) {
  const { provider: walletProvider } = useWeb3React()
  const [balances, setBalances] = useState<TaikoTokenBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!account || !chainId) {
      setLoading(false)
      return
    }

    const commonTokens =
      chainId === 167000 ? TAIKO_MAINNET_COMMON_TOKENS : chainId === 167013 ? TAIKO_HOODI_COMMON_TOKENS : []

    if (commonTokens.length === 0) {
      setLoading(false)
      return
    }

    const fetchBalances = async () => {
      setLoading(true)
      try {
        const provider = walletProvider || RPC_PROVIDERS[chainId]
        if (!provider) {
          setLoading(false)
          return
        }

        const balancePromises = commonTokens.map(async (tokenInfo) => {
          try {
            const token = new Token(chainId, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
            const contract = new Contract(tokenInfo.address, ERC20_ABI, provider)
            const rawBalance = await contract.balanceOf(account)
            const balance = rawBalance.toString()

            // Only return if balance > 0
            if (rawBalance.gt(0)) {
              return { token, balance, rawBalance: rawBalance.toString() }
            }
            return null
          } catch (error) {
            console.error(`Error fetching balance for ${tokenInfo.symbol}:`, error)
            return null
          }
        })

        const results = await Promise.all(balancePromises)
        const nonZeroBalances = results.filter((b): b is TaikoTokenBalance => b !== null)
        setBalances(nonZeroBalances)
      } catch (error) {
        console.error('Error fetching token balances:', error)
        setBalances([])
      } finally {
        setLoading(false)
      }
    }

    fetchBalances()
  }, [account, chainId, walletProvider])

  return { balances, loading }
}
