import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../data/initialState.ts'
import { computeEconomicSentimentDelta } from './economicSentiment.ts'
import { snapshotFrom, type EconomicSnapshot } from './economicSnapshots.ts'

const economic = createInitialGameState('sentiment-test-seed').economic

function snap(turn: number, overrides: Partial<EconomicSnapshot>): EconomicSnapshot {
  return { ...snapshotFrom(turn, economic, 50), ...overrides }
}

describe('computeEconomicSentimentDelta (M5 §19)', () => {
  it('returns 0 with fewer than 2 snapshots', () => {
    expect(computeEconomicSentimentDelta([])).toBe(0)
    expect(computeEconomicSentimentDelta([snap(1, {})])).toBe(0)
  })

  it('returns 0 when nothing tracked has moved', () => {
    const history = [snap(1, { unemployment: 7.5, growth: 1, purchasingPower: 100 }), snap(2, { unemployment: 7.5, growth: 1, purchasingPower: 100 })]
    expect(computeEconomicSentimentDelta(history)).toBe(0)
  })

  it('a high but rapidly falling unemployment rate reads MORE positively than a lower but slowly rising one (trend beats level)', () => {
    const fallingFromHigh = [snap(1, { unemployment: 9 }), snap(2, { unemployment: 8 })]
    const risingFromLow = [snap(1, { unemployment: 7.4 }), snap(2, { unemployment: 7.5 })]
    expect(computeEconomicSentimentDelta(fallingFromHigh)).toBeGreaterThan(computeEconomicSentimentDelta(risingFromLow))
  })

  it('improving growth and purchasing power contribute positively', () => {
    const history = [snap(1, { growth: 0.5, purchasingPower: 100 }), snap(2, { growth: 1.5, purchasingPower: 102 })]
    expect(computeEconomicSentimentDelta(history)).toBeGreaterThan(0)
  })

  it('worsening indicators contribute negatively', () => {
    const history = [snap(1, { growth: 1.5, unemployment: 7 }), snap(2, { growth: 0.2, unemployment: 8 })]
    expect(computeEconomicSentimentDelta(history)).toBeLessThan(0)
  })

  it('is always bounded to a small range regardless of how extreme the swing is', () => {
    const extreme = [snap(1, { unemployment: 20, growth: -10, purchasingPower: 50 }), snap(2, { unemployment: 2, growth: 10, purchasingPower: 200 })]
    const delta = computeEconomicSentimentDelta(extreme)
    expect(Math.abs(delta)).toBeLessThanOrEqual(2)
  })

  it('only reads the most recent window (a turn older than the window has no effect)', () => {
    const longHistory = [
      snap(1, { unemployment: 1000 }), // wildly different, but outside the 3-turn window
      snap(2, { unemployment: 5 }),
      snap(3, { unemployment: 7 }),
      snap(4, { unemployment: 8 }),
    ]
    const shortEquivalent = [snap(2, { unemployment: 5 }), snap(3, { unemployment: 7 }), snap(4, { unemployment: 8 })]
    expect(computeEconomicSentimentDelta(longHistory)).toBeCloseTo(computeEconomicSentimentDelta(shortEquivalent), 5)
  })
})
