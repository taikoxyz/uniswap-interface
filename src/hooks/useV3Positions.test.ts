import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'
import { useTaikoV3Positions } from 'graphql/taiko/TaikoPositions'
import { useSingleCallResult, useSingleContractMultipleData } from 'lib/hooks/multicall'
import { mocked } from 'test-utils/mocked'
import { renderHook } from 'test-utils/render'

import { useV3NFTPositionManagerContract } from './useContract'
import { useV3Positions } from './useV3Positions'

jest.mock('graphql/taiko/TaikoPositions')
jest.mock('lib/hooks/multicall')
jest.mock('./useContract')

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const POSITION_MANAGER = {} as ReturnType<typeof useV3NFTPositionManagerContract>
const GRAPH_POSITION = {
  tokenId: BigNumber.from(42),
  fee: 3000,
  liquidity: BigNumber.from(1),
  tickLower: -120,
  tickUpper: 120,
  token0: '0x2222222222222222222222222222222222222222',
  token1: '0x3333333333333333333333333333333333333333',
  nonce: BigNumber.from(0),
  operator: '0x0000000000000000000000000000000000000000',
  feeGrowthInside0LastX128: BigNumber.from(0),
  feeGrowthInside1LastX128: BigNumber.from(0),
  tokensOwed0: BigNumber.from(0),
  tokensOwed1: BigNumber.from(0),
}

beforeEach(() => {
  jest.resetAllMocks()
  mocked(useV3NFTPositionManagerContract).mockReturnValue(POSITION_MANAGER)
  mocked(useSingleCallResult).mockReturnValue({ loading: false } as ReturnType<typeof useSingleCallResult>)
  mocked(useSingleContractMultipleData).mockReturnValue([])
})

it('uses the healthy Taiko subgraph result without RPC enumeration', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: TAIKO_MAINNET_CHAIN_ID } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    positions: [GRAPH_POSITION],
    fallbackToRpc: false,
  })

  const { result } = renderHook(() => useV3Positions(ACCOUNT))

  expect(result.current.positions).toEqual([GRAPH_POSITION])
  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [undefined])
})

it('restores RPC enumeration when the Taiko subgraph is unavailable', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: TAIKO_MAINNET_CHAIN_ID } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    fallbackToRpc: true,
  })

  renderHook(() => useV3Positions(ACCOUNT))

  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [ACCOUNT])
})

it('keeps the existing RPC path on non-Taiko chains', () => {
  mocked(useWeb3React).mockReturnValue({ chainId: ChainId.MAINNET } as ReturnType<typeof useWeb3React>)
  mocked(useTaikoV3Positions).mockReturnValue({
    loading: false,
    fallbackToRpc: false,
  })

  renderHook(() => useV3Positions(ACCOUNT))

  expect(useSingleCallResult).toHaveBeenCalledWith(POSITION_MANAGER, 'balanceOf', [ACCOUNT])
})
