import { useWeb3React } from '@web3-react/core'
import { ZERO_PERCENT } from 'constants/misc'
import { AllowanceState } from 'hooks/usePermit2Allowance'
import { TradeState } from 'state/routing/types'
import { Field } from 'state/swap/actions'
import { SwapInfo } from 'state/swap/hooks'
import {
  TEST_ALLOWED_SLIPPAGE,
  TEST_TOKEN_1,
  TEST_TOKEN_2,
  TEST_TRADE_EXACT_INPUT,
  toCurrencyAmount,
} from 'test-utils/constants'
import { mocked } from 'test-utils/mocked'
import { render, screen } from 'test-utils/render'

import { Swap } from '.'

// The swap button must mirror the ConfirmSwapModal render gate (`allowance.state !== LOADING`):
// while the token allowance read is in flight, clicking used to be a silent no-op because the
// button was enabled but the modal refused to render ("the pink button isn't working"). These
// tests pin the fix: the button is disabled and labeled "Loading…" until the allowance resolves.

let mockAllowance: { state: AllowanceState }
jest.mock('hooks/usePermit2Allowance', () => ({
  __esModule: true,
  ...jest.requireActual('hooks/usePermit2Allowance'),
  default: () => mockAllowance,
}))

let mockSwapInfo: SwapInfo
jest.mock('state/swap/hooks', () => ({
  ...jest.requireActual('state/swap/hooks'),
  useDerivedSwapInfo: () => mockSwapInfo,
}))

const mockSwapCallback = jest.fn()
jest.mock('hooks/useSwapCallback', () => ({
  ...jest.requireActual('hooks/useSwapCallback'),
  useSwapCallback: () => mockSwapCallback,
}))

describe('Swap button allowance gating', () => {
  beforeEach(() => {
    mocked(useWeb3React).mockReturnValue({
      account: '0x52270d8234b864dcAC9947f510CE9275A8a116Db',
      chainId: 1,
      connector: {},
    } as unknown as ReturnType<typeof useWeb3React>)

    mockSwapInfo = {
      trade: { state: TradeState.VALID, trade: TEST_TRADE_EXACT_INPUT, swapQuoteLatency: 100 },
      allowedSlippage: TEST_ALLOWED_SLIPPAGE,
      autoSlippage: TEST_ALLOWED_SLIPPAGE,
      currencyBalances: {
        [Field.INPUT]: toCurrencyAmount(TEST_TOKEN_1, 100_000),
        [Field.OUTPUT]: toCurrencyAmount(TEST_TOKEN_2, 100_000),
      },
      parsedAmount: toCurrencyAmount(TEST_TOKEN_1, 1000),
      currencies: { [Field.INPUT]: TEST_TOKEN_1, [Field.OUTPUT]: TEST_TOKEN_2 },
      inputError: undefined,
      inputTax: ZERO_PERCENT,
      outputTax: ZERO_PERCENT,
    } as SwapInfo
  })

  it('disables the swap button and shows Loading… while the allowance read is in flight', () => {
    mockAllowance = { state: AllowanceState.LOADING }
    render(<Swap chainId={1} />)

    const button = screen.getByTestId('swap-button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Loading…')
  })

  it('enables the swap button once the allowance has resolved', () => {
    mockAllowance = { state: AllowanceState.ALLOWED }
    render(<Swap chainId={1} />)

    const button = screen.getByTestId('swap-button')
    expect(button).not.toBeDisabled()
    expect(button).not.toHaveTextContent('Loading…')
  })
})
