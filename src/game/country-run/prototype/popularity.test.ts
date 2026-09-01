import { describe, expect, it } from 'vitest'
import { applyPopularityDelta, clampPopularity } from './popularity.ts'

describe('clampPopularity / applyPopularityDelta', () => {
  it('never goes above 100', () => {
    expect(clampPopularity(150)).toBe(100)
    expect(applyPopularityDelta(98, 10)).toBe(100)
  })

  it('never goes below 0', () => {
    expect(clampPopularity(-20)).toBe(0)
    expect(applyPopularityDelta(2, -10)).toBe(0)
  })

  it('stays within bounds for a long chain of deltas', () => {
    let popularity = 52
    for (let i = 0; i < 50; i++) {
      popularity = applyPopularityDelta(popularity, 10)
      expect(popularity).toBeLessThanOrEqual(100)
      expect(popularity).toBeGreaterThanOrEqual(0)
    }
  })
})
