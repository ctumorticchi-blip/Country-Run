import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../../../engine/economy/config/defaultConfig.ts'
import { NEUTRAL_POLICY_INPUT } from '../../../engine/economy/types.ts'
import {
  applyExecutionScaling,
  applyPopularityResilience,
  deriveGovernmentEngineConfig,
  fiscalEstimateRangeWidth,
  governmentMarketConfidenceNudge,
  scaleParliamentPassProbability,
} from './governmentEffects.ts'
import type { GovernmentModifiers } from './governmentTypes.ts'

const NEUTRAL: GovernmentModifiers = {
  economicExecution: 1,
  fiscalForecastAccuracy: 1,
  reformEffectiveness: 1,
  parliamentNegotiation: 1,
  popularityResilience: 1,
  marketCredibility: 1,
  implementationSpeed: 1,
}

describe('governmentEffects — never mutates shared objects', () => {
  it('applyExecutionScaling returns a new object, leaving the input untouched', () => {
    const policy = { ...NEUTRAL_POLICY_INPUT, currentSpendingChanges: 10 }
    const scaled = applyExecutionScaling(policy, { ...NEUTRAL, economicExecution: 1.1 })
    expect(scaled).not.toBe(policy)
    expect(policy.currentSpendingChanges).toBe(10)
    expect(scaled.currentSpendingChanges).toBeCloseTo(11)
  })

  it('applyExecutionScaling scales reform fields by reformEffectiveness, not economicExecution', () => {
    const policy = { ...NEUTRAL_POLICY_INPUT, laborMarketReform: 0.5, currentSpendingChanges: 10 }
    const scaled = applyExecutionScaling(policy, { ...NEUTRAL, economicExecution: 1.2, reformEffectiveness: 0.9 })
    expect(scaled.laborMarketReform).toBeCloseTo(0.45)
    expect(scaled.currentSpendingChanges).toBeCloseTo(12)
  })

  it('deriveGovernmentEngineConfig returns a new config, leaving DEFAULT_ECONOMIC_ENGINE_CONFIG untouched', () => {
    const original = JSON.parse(JSON.stringify(DEFAULT_ECONOMIC_ENGINE_CONFIG)) as typeof DEFAULT_ECONOMIC_ENGINE_CONFIG
    const derived = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, { ...NEUTRAL, implementationSpeed: 1.1 })
    expect(derived).not.toBe(DEFAULT_ECONOMIC_ENGINE_CONFIG)
    expect(DEFAULT_ECONOMIC_ENGINE_CONFIG).toEqual(original)
  })
})

describe('governmentEffects — bounded outputs', () => {
  it('scaleParliamentPassProbability stays within [0.05, 0.98]', () => {
    expect(scaleParliamentPassProbability(0.9, { ...NEUTRAL, parliamentNegotiation: 1.1 })).toBeLessThanOrEqual(0.98)
    expect(scaleParliamentPassProbability(0.1, { ...NEUTRAL, parliamentNegotiation: 0.9 })).toBeGreaterThanOrEqual(0.05)
  })

  it('applyPopularityResilience only dampens negative deltas, never amplifies positive ones', () => {
    expect(applyPopularityResilience(4, { ...NEUTRAL, popularityResilience: 1.1 })).toBe(4)
    expect(applyPopularityResilience(-4, { ...NEUTRAL, popularityResilience: 1.1 })).toBeCloseTo(-4 / 1.1)
  })

  it('governmentMarketConfidenceNudge is 0 for a neutral profile and symmetric around it', () => {
    expect(governmentMarketConfidenceNudge(NEUTRAL)).toBe(0)
    expect(governmentMarketConfidenceNudge({ ...NEUTRAL, marketCredibility: 1.1 })).toBeGreaterThan(0)
    expect(governmentMarketConfidenceNudge({ ...NEUTRAL, marketCredibility: 0.9 })).toBeLessThan(0)
  })

  it('fiscalEstimateRangeWidth narrows with higher forecast accuracy', () => {
    const accurate = fiscalEstimateRangeWidth(10, { ...NEUTRAL, fiscalForecastAccuracy: 1.1 })
    const inaccurate = fiscalEstimateRangeWidth(10, { ...NEUTRAL, fiscalForecastAccuracy: 0.9 })
    expect(accurate).toBeLessThan(inaccurate)
  })

  it('deriveGovernmentEngineConfig shortens delay turns for a faster government, never below 1', () => {
    const fast = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, { ...NEUTRAL, implementationSpeed: 1.1 })
    const slow = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, { ...NEUTRAL, implementationSpeed: 0.9 })
    expect(fast.productivity.infrastructureDelayTurns).toBeLessThanOrEqual(slow.productivity.infrastructureDelayTurns)
    expect(fast.productivity.infrastructureDelayTurns).toBeGreaterThanOrEqual(1)
  })
})
