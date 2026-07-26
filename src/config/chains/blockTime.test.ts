import { ChainId } from '@uniswap/sdk-core'

import {
  blocksPerWindow,
  DATA_REFRESH_WINDOW_MS,
  DEFAULT_AVERAGE_BLOCK_TIME_MS,
  getAverageBlockTimeMs,
  TAIKO_BLOCK_TIME_MS,
} from './blockTime'
import { TAIKO_HOODI_CHAIN_ID, TAIKO_MAINNET_CHAIN_ID } from './taiko'

describe('blockTime', () => {
  describe('getAverageBlockTimeMs', () => {
    it('returns the Taiko block time for Taiko chains', () => {
      expect(getAverageBlockTimeMs(TAIKO_MAINNET_CHAIN_ID)).toEqual(TAIKO_BLOCK_TIME_MS)
      expect(getAverageBlockTimeMs(TAIKO_HOODI_CHAIN_ID)).toEqual(TAIKO_BLOCK_TIME_MS)
    })

    it('defaults Taiko chains to 2s blocks when no override is set', () => {
      expect(getAverageBlockTimeMs(TAIKO_MAINNET_CHAIN_ID)).toEqual(2_000)
    })

    it('falls back to the L1 cadence for unknown or missing chains', () => {
      expect(getAverageBlockTimeMs(ChainId.MAINNET)).toEqual(DEFAULT_AVERAGE_BLOCK_TIME_MS)
      expect(getAverageBlockTimeMs(undefined)).toEqual(DEFAULT_AVERAGE_BLOCK_TIME_MS)
    })
  })

  describe('blocksPerWindow', () => {
    it('spans the data refresh window with 6 blocks on 2s Taiko chains', () => {
      expect(blocksPerWindow(TAIKO_MAINNET_CHAIN_ID)).toEqual(6)
      expect(blocksPerWindow(TAIKO_HOODI_CHAIN_ID)).toEqual(6)
    })

    it('is a single block for 12s chains', () => {
      expect(blocksPerWindow(ChainId.MAINNET)).toEqual(1)
      expect(blocksPerWindow(undefined)).toEqual(1)
    })

    it('supports custom windows', () => {
      expect(blocksPerWindow(TAIKO_MAINNET_CHAIN_ID, 60_000)).toEqual(30)
      expect(blocksPerWindow(ChainId.MAINNET, 6_000)).toEqual(1) // never less than 1 block
    })

    it('scales with the configured block time (0.5s cutover)', () => {
      expect(Math.round(DATA_REFRESH_WINDOW_MS / 500)).toEqual(24)
    })
  })

  describe('REACT_APP_TAIKO_BLOCK_TIME_MS override', () => {
    const ENV_KEY = 'REACT_APP_TAIKO_BLOCK_TIME_MS'
    const originalValue = process.env[ENV_KEY]

    afterEach(() => {
      if (originalValue === undefined) {
        delete process.env[ENV_KEY]
      } else {
        process.env[ENV_KEY] = originalValue
      }
      jest.restoreAllMocks()
    })

    function loadWithEnv(value?: string): typeof import('./blockTime') {
      let mod: typeof import('./blockTime') | undefined
      jest.isolateModules(() => {
        if (value === undefined) {
          delete process.env[ENV_KEY]
        } else {
          process.env[ENV_KEY] = value
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        mod = require('./blockTime')
      })
      if (!mod) throw new Error('failed to load blockTime module')
      return mod
    }

    it('applies a valid override to Taiko chains', () => {
      const mod = loadWithEnv('500')
      expect(mod.TAIKO_BLOCK_TIME_MS).toEqual(500)
      expect(mod.getAverageBlockTimeMs(TAIKO_MAINNET_CHAIN_ID)).toEqual(500)
      expect(mod.blocksPerWindow(TAIKO_MAINNET_CHAIN_ID)).toEqual(24)
      // Other chains are unaffected by the Taiko override.
      expect(mod.getAverageBlockTimeMs(ChainId.MAINNET)).toEqual(DEFAULT_AVERAGE_BLOCK_TIME_MS)
    })

    it.each(['not-a-number', '0', '-2000', '600000'])('rejects invalid override %p', (value) => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const mod = loadWithEnv(value)
      expect(mod.TAIKO_BLOCK_TIME_MS).toEqual(2_000)
      expect(error).toHaveBeenCalled()
    })

    it('uses the default when unset', () => {
      const mod = loadWithEnv(undefined)
      expect(mod.TAIKO_BLOCK_TIME_MS).toEqual(2_000)
    })
  })
})
