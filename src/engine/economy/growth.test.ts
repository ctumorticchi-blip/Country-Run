import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import { computeGrowth, computePotentialGrowth, type ComputeGrowthInput } from './growth.ts'
import { NEUTRAL_POLICY_INPUT } from './types.ts'
import type { WorldState } from './types.ts'

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 0,
  ecbRate: 3,
  oilPriceIndex: 100,
  globalTradeGrowth: 0,
  externalInflation: 0,
}

function baseInput(overrides?: Partial<ComputeGrowthInput>): ComputeGrowthInput {
  return {
    potentialGrowth: 1.2,
    gdp: 2800,
    policyInput: NEUTRAL_POLICY_INPUT,
    policyDelta: NEUTRAL_POLICY_INPUT,
    world: NEUTRAL_WORLD,
    consumerConfidencePrev: 50,
    businessConfidencePrev: 50,
    productivityGrowth: 0.8,
    publicSectorEfficiencyPrev: 55,
    crisisEffect: 0,
    rng: new SeededRng('growth-test'),
    config: { ...DEFAULT_ECONOMIC_ENGINE_CONFIG.growth, noiseStdDev: 0 },
    ...overrides,
  }
}

describe('computePotentialGrowth', () => {
  it('is labor contribution + productivity passthrough', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.potentialGrowth
    const result = computePotentialGrowth(1.0, config)
    expect(result).toBeCloseTo(config.laborContribution + 1.0 * config.productivityPassthrough)
  })

  it('increases with higher productivity growth', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.potentialGrowth
    expect(computePotentialGrowth(2.0, config)).toBeGreaterThan(computePotentialGrowth(0.5, config))
  })
})

describe('computeGrowth', () => {
  it('with neutral policy/world/confidence, growth is close to potential + productivity passthrough', () => {
    const { growth, contributions } = computeGrowth(baseInput())
    expect(contributions.fiscalImpulse).toBeCloseTo(0)
    expect(contributions.externalEffect).toBeCloseTo(0)
    expect(contributions.confidenceEffect).toBeCloseTo(0)
    expect(growth).toBeCloseTo(1.2 + 0.8 * DEFAULT_ECONOMIC_ENGINE_CONFIG.growth.productivityPassthrough)
  })

  it('a positive public-investment impulse (a CHANGE in policy stance) increases growth', () => {
    const neutral = computeGrowth(baseInput())
    const stimulusDelta = { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 20 }
    const stimulated = computeGrowth(baseInput({ policyDelta: stimulusDelta }))
    expect(stimulated.growth).toBeGreaterThan(neutral.growth)
    expect(stimulated.contributions.fiscalImpulse).toBeGreaterThan(0)
  })

  it('a SUSTAINED public-investment level with no further change contributes nothing further to growth', () => {
    // policyInput carries the sustained level, but policyDelta (the change since last turn) is
    // neutral — growth must not keep being boosted turn after turn by an unchanging spending level.
    const sustained = computeGrowth(
      baseInput({ policyInput: { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 20 }, policyDelta: NEUTRAL_POLICY_INPUT }),
    )
    expect(sustained.contributions.fiscalImpulse).toBeCloseTo(0)
  })

  it('a tax increase (positive tax impulse) reduces growth', () => {
    const neutral = computeGrowth(baseInput())
    const taxed = computeGrowth(baseInput({ policyInput: { ...NEUTRAL_POLICY_INPUT, householdTaxImpulse: 15 } }))
    expect(taxed.growth).toBeLessThan(neutral.growth)
  })

  it('stronger eurozone/trade growth increases the external contribution', () => {
    const result = computeGrowth(
      baseInput({ world: { ...NEUTRAL_WORLD, eurozoneGrowth: 2, globalTradeGrowth: 3 } }),
    )
    expect(result.contributions.externalEffect).toBeGreaterThan(0)
  })

  it('a crisis effect (from a shock) pulls growth down', () => {
    const neutral = computeGrowth(baseInput())
    const crisis = computeGrowth(baseInput({ crisisEffect: -1.5 }))
    expect(crisis.growth).toBeCloseTo(neutral.growth - 1.5)
  })

  it('higher confidence increases growth via the confidence effect', () => {
    const low = computeGrowth(baseInput({ consumerConfidencePrev: 30, businessConfidencePrev: 30 }))
    const high = computeGrowth(baseInput({ consumerConfidencePrev: 80, businessConfidencePrev: 80 }))
    expect(high.growth).toBeGreaterThan(low.growth)
  })

  it('is deterministic for the same seed and inputs', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.growth // includes noise this time
    const run = () => computeGrowth(baseInput({ rng: new SeededRng('replay'), config })).growth
    expect(run()).toBe(run())
  })

  it('noise stays within the configured bound', () => {
    const rng = new SeededRng('noise-bound-check')
    for (let i = 0; i < 200; i++) {
      const { contributions } = computeGrowth(baseInput({ rng, config: DEFAULT_ECONOMIC_ENGINE_CONFIG.growth }))
      expect(Math.abs(contributions.noise)).toBeLessThanOrEqual(DEFAULT_ECONOMIC_ENGINE_CONFIG.growth.noiseStdDev)
    }
  })

  it('public sector efficiency scales the effectiveness of public investment', () => {
    const investmentDelta = { ...NEUTRAL_POLICY_INPUT, publicInvestmentChanges: 20 }
    const inefficient = computeGrowth(baseInput({ policyDelta: investmentDelta, publicSectorEfficiencyPrev: 20 }))
    const efficient = computeGrowth(baseInput({ policyDelta: investmentDelta, publicSectorEfficiencyPrev: 90 }))
    expect(efficient.growth).toBeGreaterThan(inefficient.growth)
  })
})
