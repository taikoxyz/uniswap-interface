import { shouldCheck } from './updater'

describe('transactions updater', () => {
  describe('shouldCheck', () => {
    it('returns true if no receipt and never checked', () => {
      expect(shouldCheck(10, { addedTime: 100 })).toEqual(true)
    })
    it('returns false if has receipt and never checked', () => {
      expect(shouldCheck(10, { addedTime: 100, receipt: {} })).toEqual(false)
    })
    it('returns true if has not been checked in 1 blocks', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime(), lastCheckedBlockNumber: 9 })).toEqual(true)
    })
    it('returns false if checked in last 3 blocks and greater than 20 minutes old', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 8 })).toEqual(
        false
      )
    })
    it('returns true if not checked in last 5 blocks and greater than 20 minutes old', () => {
      expect(shouldCheck(10, { addedTime: new Date().getTime() - 21 * 60 * 1000, lastCheckedBlockNumber: 5 })).toEqual(
        true
      )
    })
    it('returns false if checked in last 10 blocks and greater than 60 minutes old', () => {
      expect(shouldCheck(20, { addedTime: new Date().getTime() - 61 * 60 * 1000, lastCheckedBlockNumber: 11 })).toEqual(
        false
      )
    })
    it('returns true if checked in last 3 blocks and greater than 60 minutes old', () => {
      expect(shouldCheck(20, { addedTime: new Date().getTime() - 61 * 60 * 1000, lastCheckedBlockNumber: 10 })).toEqual(
        true
      )
    })

    describe('with a 2s block time (Taiko today)', () => {
      const BLOCK_TIME = 2_000
      it('checks fresh transactions on every new block', () => {
        expect(shouldCheck(100, { addedTime: new Date().getTime(), lastCheckedBlockNumber: 99 }, BLOCK_TIME)).toEqual(
          true
        )
      })
      it('backs off to ~36s when pending longer than 5 minutes', () => {
        const addedTime = new Date().getTime() - 21 * 60 * 1000
        // 17 blocks * 2s = 34s: too soon. 18 blocks * 2s = 36s: due.
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 83 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 82 }, BLOCK_TIME)).toEqual(true)
      })
      it('backs off to ~2m when pending longer than an hour', () => {
        const addedTime = new Date().getTime() - 61 * 60 * 1000
        // 59 blocks * 2s = 118s: too soon. 60 blocks * 2s = 120s: due.
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 41 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(100, { addedTime, lastCheckedBlockNumber: 40 }, BLOCK_TIME)).toEqual(true)
      })
    })

    describe('with a 0.5s block time (Taiko roadmap)', () => {
      const BLOCK_TIME = 500
      it('backs off to ~36s when pending longer than 5 minutes', () => {
        const addedTime = new Date().getTime() - 21 * 60 * 1000
        // 71 blocks * 0.5s = 35.5s: too soon. 72 blocks * 0.5s = 36s: due.
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 929 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 928 }, BLOCK_TIME)).toEqual(true)
      })
      it('backs off to ~2m when pending longer than an hour', () => {
        const addedTime = new Date().getTime() - 61 * 60 * 1000
        // 239 blocks * 0.5s = 119.5s: too soon. 240 blocks * 0.5s = 120s: due.
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 761 }, BLOCK_TIME)).toEqual(false)
        expect(shouldCheck(1000, { addedTime, lastCheckedBlockNumber: 760 }, BLOCK_TIME)).toEqual(true)
      })
    })
  })
})
