import { InterfacePageName } from '@uniswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import { Trace } from 'analytics'
import Web3Status from 'components/Web3Status'
import { asSupportedChain } from 'constants/chains'
import { Field } from 'state/swap/actions'
import { useDefaultsFromURLSearch } from 'state/swap/hooks'
import styled, { ThemeProvider } from 'styled-components'
import { getTheme } from 'theme'

import { Swap } from '../Swap'
import { ChainSelectorWidget } from './ChainSelectorWidget'

// Full-window wrapper for iframe embedding - no background, no decorations
const WidgetWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #ffffff;
  overflow: auto;
`

const WidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  background: ${({ theme }) => theme.surface1};
  border-bottom: 1px solid ${({ theme }) => theme.surface3};
`

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

// Light theme for widget
const lightTheme = getTheme(false)

export default function Widget() {
  const { chainId: connectedChainId } = useWeb3React()
  const loadedUrlParams = useDefaultsFromURLSearch()
  const supportedChainId = asSupportedChain(connectedChainId)

  return (
    <ThemeProvider theme={lightTheme}>
      <Trace page={InterfacePageName.SWAP_PAGE} shouldLogImpression>
        <WidgetWrapper>
          <WidgetHeader>
            <HeaderControls>
              <ChainSelectorWidget />
            </HeaderControls>
            <HeaderControls>
              <Web3Status />
            </HeaderControls>
          </WidgetHeader>
          <Swap
            chainId={supportedChainId ?? connectedChainId}
            initialInputCurrencyId={loadedUrlParams?.[Field.INPUT]?.currencyId}
            initialOutputCurrencyId={loadedUrlParams?.[Field.OUTPUT]?.currencyId}
            disableTokenInputs={supportedChainId === undefined}
            compact
          />
        </WidgetWrapper>
      </Trace>
    </ThemeProvider>
  )
}
