import { ChainId } from '@uniswap/sdk-core'
import { TAIKO_MAINNET_CHAIN_ID } from 'config/chains'

import { shouldCheck } from './updater'

describe('transactions updater', () => {
  describe('shouldCheck', () => {
    it('returns true if no receipt and never checked', () => {
      expect(shouldCheck(ChainId.MAINNET, 10, { addedTime: 100 })).toEqual(true)
    })
    it('returns false if has receipt and never checked', () => {
      expect(shouldCheck(ChainId.MAINNET, 10, { addedTime: 100, receipt: {} })).toEqual(false)
    })
    it('returns true if has not been checked in 1 blocks', () => {
      expect(shouldCheck(ChainId.MAINNET, 10, { addedTime: new Date().getTime(), lastCheckedBlockNumber: 9 })).toEqual(
        true
      )
    })
    it('returns false if checked in last 3 blocks and greater than 20 minutes old', () => {
      expect(
        shouldCheck(ChainId.MAINNET, 10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 8 })
      ).toEqual(false)
    })
    it('returns true if not checked in last 5 blocks and greater than 20 minutes old', () => {
      expect(
        shouldCheck(ChainId.MAINNET, 10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 5 })
      ).toEqual(true)
    })
    it('returns false if checked in last 10 blocks and greater than 60 minutes old', () => {
      expect(
        shouldCheck(ChainId.MAINNET, 20, {
          addedTime: new Date().getTime() - 61 * 60 * 1000,
          lastCheckedBlockNumber: 11,
        })
      ).toEqual(false)
    })
    it('returns true if checked in last 3 blocks and greater than 20 minutes old', () => {
      expect(
        shouldCheck(ChainId.MAINNET, 20, {
          addedTime: new Date().getTime() - 61 * 60 * 1000,
          lastCheckedBlockNumber: 10,
        })
      ).toEqual(true)
    })
    // On Taiko (2s blocks), thresholds scale 6x so the same wall-clock cadence is preserved.
    it('returns false on Taiko if checked in last 53 blocks and > 60 min old (scales 9 blocks * 6)', () => {
      expect(
        shouldCheck(TAIKO_MAINNET_CHAIN_ID, 100, {
          addedTime: new Date().getTime() - 61 * 60 * 1000,
          lastCheckedBlockNumber: 47,
        })
      ).toEqual(false)
    })
    it('returns true on Taiko if checked >54 blocks ago and > 60 min old', () => {
      expect(
        shouldCheck(TAIKO_MAINNET_CHAIN_ID, 100, {
          addedTime: new Date().getTime() - 61 * 60 * 1000,
          lastCheckedBlockNumber: 45,
        })
      ).toEqual(true)
    })
  })
})
