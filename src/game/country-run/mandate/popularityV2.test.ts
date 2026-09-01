import { describe, expect, it } from 'vitest'
import {
  applyPopularityTurn,
  computePopularityTurnDelta,
  popularityDeltaFromBillOutcome,
  popularityDeltaFromPromiseResolution,
} from './popularityV2.ts'

describe('computePopularityTurnDelta (M5 §18-19)', () => {
  it('a quiet turn with no inputs at all produces zero movement', () => {
    expect(computePopularityTurnDelta({})).toBe(0)
  })

  it('a typical turn (small economic trend only) stays within ±2', () => {
    expect(computePopularityTurnDelta({ economicTrendDelta: 1.4 })).toBeLessThanOrEqual(2)
    expect(computePopularityTurnDelta({ economicTrendDelta: -1.4 })).toBeGreaterThanOrEqual(-2)
  })

  it('no single input can swing the turn past its own cap, even if passed an extreme raw value', () => {
    const delta = computePopularityTurnDelta({ economicTrendDelta: 999 })
    expect(delta).toBeLessThanOrEqual(2)
  })

  it('a major event choice can move popularity further than a quiet turn', () => {
    const quiet = computePopularityTurnDelta({ economicTrendDelta: 1 })
    const majorEvent = computePopularityTurnDelta({ eventChoiceDelta: 7 })
    expect(majorEvent).toBeGreaterThan(quiet)
  })

  it('combines multiple simultaneous inputs (a vote and an event on the same turn)', () => {
    const delta = computePopularityTurnDelta({ billOutcomeDelta: 3, eventChoiceDelta: -2 })
    expect(delta).toBe(1)
  })
})

describe('applyPopularityTurn', () => {
  it('clamps the result to [0, 100]', () => {
    expect(applyPopularityTurn(99, { eventChoiceDelta: 8 })).toBeLessThanOrEqual(100)
    expect(applyPopularityTurn(1, { eventChoiceDelta: -8 })).toBeGreaterThanOrEqual(0)
  })
})

describe('popularityDeltaFromPromiseResolution', () => {
  it('KEPT is positive and scales with difficulty', () => {
    expect(popularityDeltaFromPromiseResolution('KEPT', 'LOW')).toBeGreaterThan(0)
    expect(popularityDeltaFromPromiseResolution('KEPT', 'HIGH')).toBeGreaterThan(
      popularityDeltaFromPromiseResolution('KEPT', 'LOW'),
    )
  })

  it('BROKEN is negative and scales with difficulty', () => {
    expect(popularityDeltaFromPromiseResolution('BROKEN', 'LOW')).toBeLessThan(0)
    expect(popularityDeltaFromPromiseResolution('BROKEN', 'HIGH')).toBeLessThan(
      popularityDeltaFromPromiseResolution('BROKEN', 'LOW'),
    )
  })

  it('PARTIAL is neutral', () => {
    expect(popularityDeltaFromPromiseResolution('PARTIAL', 'HIGH')).toBe(0)
  })
})

describe('popularityDeltaFromBillOutcome', () => {
  it('a passing vote is positive, a defeat is negative', () => {
    expect(popularityDeltaFromBillOutcome(true, 0.3)).toBeGreaterThan(0)
    expect(popularityDeltaFromBillOutcome(false, 0.3)).toBeLessThan(0)
  })

  it('a more controversial defeat stings more than a mild one', () => {
    expect(popularityDeltaFromBillOutcome(false, 0.9)).toBeLessThan(popularityDeltaFromBillOutcome(false, 0.1))
  })
})
