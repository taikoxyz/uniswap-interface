import { renderHook } from '@testing-library/react'

import { useQuantizedBlockNumber } from './multicall'

const STEP = 6

function renderQuantized(initial: { blockNumber?: number; step?: number; snapTo?: number }) {
  return renderHook(
    ({ blockNumber, step, snapTo }: { blockNumber?: number; step?: number; snapTo?: number }) =>
      useQuantizedBlockNumber(blockNumber, step ?? STEP, snapTo),
    { initialProps: initial }
  )
}

describe('useQuantizedBlockNumber', () => {
  it('is undefined until a block number arrives, then adopts it', () => {
    const { result, rerender } = renderQuantized({ blockNumber: undefined })
    expect(result.current).toBeUndefined()
    rerender({ blockNumber: 100 })
    expect(result.current).toEqual(100)
  })

  it('holds within a window and advances once a full step has passed', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 101 })
    rerender({ blockNumber: 105 })
    expect(result.current).toEqual(100) // < step ahead: hold
    rerender({ blockNumber: 106 })
    expect(result.current).toEqual(106) // step reached: advance
    rerender({ blockNumber: 111 })
    expect(result.current).toEqual(106) // next window starts from the adopted block
  })

  it('adopts a lower block number immediately (chain switch or reorg)', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 50 })
    expect(result.current).toEqual(50)
  })

  it('snaps forward to a receipt-confirmed block inside the window', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 102 })
    expect(result.current).toEqual(100)
    // The user's transaction confirmed in block 102: refresh immediately.
    rerender({ blockNumber: 102, snapTo: 102 })
    expect(result.current).toEqual(102)
    // The next steady-state advance is measured from the snapped block.
    rerender({ blockNumber: 107, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ blockNumber: 108, snapTo: 102 })
    expect(result.current).toEqual(108)
  })

  it('snaps even when the receipt block is ahead of the raw feed', () => {
    // Receipts can reference blocks the polled feed has not seen yet.
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 103 })
    expect(result.current).toEqual(103)
  })

  it('ignores snaps at or behind the quantized block', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100 })
    rerender({ blockNumber: 100, snapTo: 100 })
    expect(result.current).toEqual(100)
    rerender({ blockNumber: 100, snapTo: 99 })
    expect(result.current).toEqual(100)
  })

  it('does not resurrect a stale snap after moving to a lower block (chain switch)', () => {
    const { result, rerender } = renderQuantized({ blockNumber: 100, snapTo: 102 })
    expect(result.current).toEqual(102)
    rerender({ blockNumber: 50, snapTo: undefined })
    expect(result.current).toEqual(50)
  })
})
