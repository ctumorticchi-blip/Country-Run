import { describe, expect, it } from 'vitest'
import { GOVERNMENT_PROFILES } from './governmentProfiles.ts'
import type { GovernmentModifiers } from './governmentTypes.ts'

const DIMENSIONS: (keyof GovernmentModifiers)[] = [
  'economicExecution',
  'fiscalForecastAccuracy',
  'reformEffectiveness',
  'parliamentNegotiation',
  'popularityResilience',
  'marketCredibility',
  'implementationSpeed',
]

describe('governmentProfiles — modifier bounds', () => {
  it('has exactly 4 profiles', () => {
    expect(GOVERNMENT_PROFILES).toHaveLength(4)
  })

  it('every modifier is within [0.90, 1.10]', () => {
    for (const profile of GOVERNMENT_PROFILES) {
      for (const dimension of DIMENSIONS) {
        expect(profile.modifiers[dimension]).toBeGreaterThanOrEqual(0.9)
        expect(profile.modifiers[dimension]).toBeLessThanOrEqual(1.1)
      }
    }
  })

  it('every profile has at least one strong dimension (>=1.05) and one weak dimension (<=0.95)', () => {
    for (const profile of GOVERNMENT_PROFILES) {
      const values = DIMENSIONS.map((d) => profile.modifiers[d])
      expect(Math.max(...values)).toBeGreaterThanOrEqual(1.05)
      expect(Math.min(...values)).toBeLessThanOrEqual(0.95)
    }
  })
})

describe('governmentProfiles — no dominant profile', () => {
  it('no profile is >= another on every single dimension', () => {
    for (const a of GOVERNMENT_PROFILES) {
      for (const b of GOVERNMENT_PROFILES) {
        if (a.id === b.id) continue
        const aDominatesB = DIMENSIONS.every((d) => a.modifiers[d] >= b.modifiers[d])
        expect(aDominatesB).toBe(false)
      }
    }
  })
})
