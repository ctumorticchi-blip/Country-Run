import { describe, expect, it } from 'vitest'
import { computeInitialPoliticalCapital, MAX_POLITICAL_CAPITAL, MIN_POLITICAL_CAPITAL } from './politicalCapital.ts'

describe('computeInitialPoliticalCapital — bounded [0, 100]', () => {
  it('never leaves [MIN_POLITICAL_CAPITAL, MAX_POLITICAL_CAPITAL] across the full input space', () => {
    for (const scorePct of [50.5, 51, 52, 53, 54]) {
      for (const majority of ['MAJORITÉ_ABSOLUE', 'MAJORITÉ_RELATIVE', 'ASSEMBLÉE_FRAGMENTÉE'] as const) {
        for (const coherence of [0, 0.25, 0.5, 0.75, 1]) {
          const capital = computeInitialPoliticalCapital(scorePct, majority, coherence)
          expect(capital).toBeGreaterThanOrEqual(MIN_POLITICAL_CAPITAL)
          expect(capital).toBeLessThanOrEqual(MAX_POLITICAL_CAPITAL)
        }
      }
    }
  })

  it('an absolute majority yields more capital than a fragmented assembly, all else equal', () => {
    const absolute = computeInitialPoliticalCapital(52, 'MAJORITÉ_ABSOLUE', 0.5)
    const fragmented = computeInitialPoliticalCapital(52, 'ASSEMBLÉE_FRAGMENTÉE', 0.5)
    expect(absolute).toBeGreaterThan(fragmented)
  })
})
