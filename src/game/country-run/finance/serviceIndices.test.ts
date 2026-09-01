import { describe, expect, it } from 'vitest'
import { compositeServiceIndex, driftServiceIndices, SERVICE_INDEX_CONFIG } from './serviceIndices.ts'
import { NEUTRAL_SERVICE_INDICES } from './financeTypes.ts'

const NEUTRAL_INPUTS = { healthFundingDelta: 0, educationFundingDelta: 0, securityFundingDelta: 0, administrationFundingDelta: 0, administrationReformLevel: 0 }

describe('M6 §45-46 service indices — gradual, bounded drift toward a funding-implied target, never an instant jump', () => {
  it('stays at 100 when funding is unchanged (baseline == target)', () => {
    const next = driftServiceIndices(NEUTRAL_SERVICE_INDICES, NEUTRAL_INPUTS)
    expect(next).toEqual(NEUTRAL_SERVICE_INDICES)
  })

  it('a funding increase moves the index toward, but NOT instantly to, its target ("a +10bn budget should not instantly raise quality by 10%")', () => {
    const next = driftServiceIndices(NEUTRAL_SERVICE_INDICES, { ...NEUTRAL_INPUTS, healthFundingDelta: 10 })
    const target = 100 + 10 * SERVICE_INDEX_CONFIG.fundingSensitivity
    expect(next.health).toBeGreaterThan(100)
    expect(next.health).toBeLessThan(target) // only a fraction of the way there after one turn
  })

  it('sustained funding converges toward the target over many turns without overshooting', () => {
    let indices = NEUTRAL_SERVICE_INDICES
    for (let i = 0; i < 300; i++) indices = driftServiceIndices(indices, { ...NEUTRAL_INPUTS, healthFundingDelta: 10 })
    const target = 100 + 10 * SERVICE_INDEX_CONFIG.fundingSensitivity
    expect(indices.health).toBeCloseTo(target, 0)
    expect(indices.health).toBeLessThanOrEqual(target + 0.001) // never overshoots
  })

  it('a funding cut drifts the index down, and administration also responds to publicSectorReform level', () => {
    const cut = driftServiceIndices(NEUTRAL_SERVICE_INDICES, { ...NEUTRAL_INPUTS, healthFundingDelta: -12 })
    expect(cut.health).toBeLessThan(100)

    const reformed = driftServiceIndices(NEUTRAL_SERVICE_INDICES, { ...NEUTRAL_INPUTS, administrationReformLevel: 0.35 })
    expect(reformed.administration).toBeGreaterThan(100)
  })

  it('never exceeds the documented plausibility clamp, even under repeated extreme funding swings', () => {
    let indices = NEUTRAL_SERVICE_INDICES
    for (let i = 0; i < 200; i++) indices = driftServiceIndices(indices, { ...NEUTRAL_INPUTS, healthFundingDelta: 20, educationFundingDelta: 20, securityFundingDelta: 20, administrationFundingDelta: 20 })
    for (const value of Object.values(indices)) {
      expect(value).toBeLessThanOrEqual(SERVICE_INDEX_CONFIG.max)
      expect(value).toBeGreaterThanOrEqual(SERVICE_INDEX_CONFIG.min)
    }
  })

  it('compositeServiceIndex is the plain average of the 4 indices', () => {
    expect(compositeServiceIndex({ health: 110, education: 90, security: 100, administration: 100 })).toBeCloseTo(100, 5)
  })
})
