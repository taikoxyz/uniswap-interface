import { ChainId } from '@uniswap/sdk-core'
import { TAIKO_HOODI_CHAIN_ID } from './src/config/chains'

/* eslint-env node */
require('dotenv').config()

/**
 * Hardhat configuration for Taiko-only deployment.
 * This deployment does not use network forks or external RPC endpoints.
 */
module.exports = {
  networks: {
    hardhat: {
      chainId: TAIKO_HOODI_CHAIN_ID,
      accounts: {
        count: 2,
      },
      mining: {
        auto: true, // automine to make tests easier to write.
        interval: 0, // do not interval mine so that tests remain deterministic
      },
    },
  },
}
