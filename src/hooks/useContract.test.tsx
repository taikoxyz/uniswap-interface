import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import ERC20_ABI from 'abis/erc20.json'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { RPC_PROVIDERS } from 'constants/providers'
import { EventEmitter } from 'events'
import { mocked } from 'test-utils/mocked'
import { act, renderHook } from 'test-utils/render'

import { useContract } from './useContract'

const TOKEN_ADDRESS = '0xA51894664A773981C6C112C43ce576f315d5b1B6' // WETH on Taiko mainnet
const ACCOUNT = '0x0000000000000000000000000000000000000001'

// Mimics the interface's own RPC provider closely enough for ethers' Contract and the ambient
// BlockNumberProvider mounted by the test wrapper.
class FakeAppProvider extends EventEmitter {
  readonly _isProvider = true
  async getBlockNumber() {
    return 1
  }
}

// Mimics a connected wallet's provider; getSigner mirrors ethers' JsonRpcProvider shape closely
// enough for getContract's signer path.
class FakeWalletProvider extends FakeAppProvider {
  getSigner(account: string) {
    return {
      connectUnchecked: () => ({ _isSigner: true, provider: this, getAddress: async () => account }),
    }
  }
}

function mockWeb3(chainId: number, provider: FakeWalletProvider, account?: string) {
  mocked(useWeb3React).mockReturnValue({ chainId, provider, account } as unknown as ReturnType<typeof useWeb3React>)
}

describe('useContract', () => {
  let appProvider: FakeAppProvider
  let walletProvider: FakeWalletProvider

  beforeEach(() => {
    appProvider = new FakeAppProvider()
    walletProvider = new FakeWalletProvider()
    // Each jest test file gets its own module registry, so this mutation cannot leak into other
    // test files.
    ;(RPC_PROVIDERS as Record<number, unknown>)[TAIKO_MAINNET_CHAIN_ID] = appProvider
  })

  it('binds read-only contracts to the app RPC provider, not the wallet', async () => {
    mockWeb3(TAIKO_MAINNET_CHAIN_ID, walletProvider, ACCOUNT)
    const { result } = renderHook(() => useContract(TOKEN_ADDRESS, ERC20_ABI, false))
    await act(async () => undefined) // flush the ambient block feed's initial getBlockNumber()
    expect(result.current?.provider).toBe(appProvider)
    expect(result.current?.signer).toBeNull()
  })

  it('binds signer-capable contracts to the app RPC provider while no account is connected', async () => {
    mockWeb3(TAIKO_MAINNET_CHAIN_ID, walletProvider, undefined)
    const { result } = renderHook(() => useContract(TOKEN_ADDRESS, ERC20_ABI, true))
    await act(async () => undefined)
    expect(result.current?.provider).toBe(appProvider)
    expect(result.current?.signer).toBeNull()
  })

  it('keeps signer-attached contracts on the wallet provider', async () => {
    mockWeb3(TAIKO_MAINNET_CHAIN_ID, walletProvider, ACCOUNT)
    const { result } = renderHook(() => useContract(TOKEN_ADDRESS, ERC20_ABI, true))
    await act(async () => undefined)
    expect(result.current?.signer).toBeTruthy()
    expect(result.current?.provider).toBe(walletProvider)
  })

  it('falls back to the wallet provider for chains the interface has no provider for', async () => {
    mockWeb3(ChainId.MAINNET, walletProvider, undefined)
    const { result } = renderHook(() => useContract(TOKEN_ADDRESS, ERC20_ABI, false))
    await act(async () => undefined)
    expect(result.current?.provider).toBe(walletProvider)
  })
})
