import { InterfacePageName } from '@uniswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import { Trace } from 'analytics'
import { asSupportedChain } from 'constants/chains'
import { useDefaultsFromURLSearch } from 'state/swap/hooks'
import styled, { ThemeProvider } from 'styled-components'
import { getTheme } from 'theme'

import { Swap } from '../Swap'
import { Field } from 'state/swap/actions'

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
  align-items: center;
  background: #ffffff;
  overflow: auto;
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
