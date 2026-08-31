import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import {
  computeBusinessConfidence,
  computeConsumerConfidence,
  computeMarketConfidence,
  type ComputeBusinessConfidenceInput,
  type ComputeConsumerConfidenceInput,
  type ComputeMarketConfidenceInput,
} from './confidence.ts'

function consumerInput(overrides?: Partial<ComputeConsumerConfidenceInput>): ComputeConsumerConfidenceInput {
  return {
    consumerConfidencePrev: 50,
    unemploymentNext: 7.5,
    structuralUnemploymentNext: 7.5,
    realIncomeGrowthAnnualized: 0,
    inflationNext: 2,
    marketConfidencePrev: 50,
    shockDelta: 0,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.confidence.consumer,
    ...overrides,
  }
}

describe('computeConsumerConfidence', () => {
  it('stays near 50 when nothing pulls it away from neutral', () => {
    const next = computeConsumerConfidence(consumerInput())
    expect(next).toBeCloseTo(50, 0)
  })

  it('unemployment below structural raises consumer confidence', () => {
    const next = computeConsumerConfidence(consumerInput({ unemploymentNext: 5, structuralUnemploymentNext: 7.5 }))
    expect(next).toBeGreaterThan(50)
  })

  it('high inflation reduces consumer confidence', () => {
    const next = computeConsumerConfidence(consumerInput({ inflationNext: 8 }))
    expect(next).toBeLessThan(50)
  })

  it('mean-reverts gradually, not instantly, toward the target', () => {
    const next = computeConsumerConfidence(consumerInput({ unemploymentNext: 3, structuralUnemploymentNext: 7.5 }))
    // A big employment signal should move confidence up, but not slam it to the extreme in one turn.
    expect(next).toBeGreaterThan(50)
    expect(next).toBeLessThan(90)
  })

  it('a shock delta applies on top of the mean-reversion step', () => {
    const withoutShock = computeConsumerConfidence(consumerInput())
    const withShock = computeConsumerConfidence(consumerInput({ shockDelta: -10 }))
    expect(withShock).toBeCloseTo(withoutShock - 10, 0)
  })

  it('stays within [0, 100] even for extreme inputs', () => {
    const next = computeConsumerConfidence(consumerInput({ shockDelta: -1000 }))
    expect(next).toBe(0)
  })
})

function businessInput(overrides?: Partial<ComputeBusinessConfidenceInput>): ComputeBusinessConfidenceInput {
  return {
    businessConfidencePrev: 50,
    growthNext: 1.2,
    potentialGrowthNext: 1.2,
    businessTaxImpulse: 0,
    gdp: 2800,
    effectiveDebtRateNext: 3.5, // realistic: ECB rate + baseline spread, not below the ECB rate
    ecbRate: 3.0,
    marketConfidencePrev: 50,
    consumerConfidencePrev: 50,
    shockDelta: 0,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.confidence.business,
    ...overrides,
  }
}

describe('computeBusinessConfidence', () => {
  it('growth above potential raises business confidence', () => {
    const next = computeBusinessConfidence(businessInput({ growthNext: 3 }))
    expect(next).toBeGreaterThan(50)
  })

  it('a business tax increase reduces business confidence', () => {
    const next = computeBusinessConfidence(businessInput({ businessTaxImpulse: 30 }))
    expect(next).toBeLessThan(50)
  })

  it('a wider financing spread over the ECB rate reduces business confidence', () => {
    const next = computeBusinessConfidence(businessInput({ effectiveDebtRateNext: 8, ecbRate: 3 }))
    expect(next).toBeLessThan(50)
  })
})

function marketInput(overrides?: Partial<ComputeMarketConfidenceInput>): ComputeMarketConfidenceInput {
  return {
    marketConfidencePrev: 50,
    debtRatioNext: 80, // below the 90 soft threshold -> no debt-ratio drag, isolates the signal under test
    deficitRatioNext: 2, // below the 3 soft threshold -> no deficit-ratio drag
    deficitRatioPrev: 2,
    growthNext: 1.2,
    potentialGrowthNext: 1.2,
    shockDelta: 0,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.confidence.market,
    ...overrides,
  }
}

describe('computeMarketConfidence', () => {
  it('a degraded trajectory (rising debt ratio and deficit ratio over turns) lowers market confidence', () => {
    let confidence = 55
    let debtRatio = 100
    let deficitRatio = 3
    for (let i = 0; i < 12; i++) {
      debtRatio += 3
      deficitRatio += 0.5
      confidence = computeMarketConfidence(
        marketInput({ marketConfidencePrev: confidence, debtRatioNext: debtRatio, deficitRatioNext: deficitRatio, deficitRatioPrev: deficitRatio - 0.5 }),
      )
    }
    expect(confidence).toBeLessThan(55)
  })

  it('an improving deficit trajectory raises the trajectory term', () => {
    const improving = computeMarketConfidence(marketInput({ deficitRatioPrev: 5, deficitRatioNext: 3 }))
    const worsening = computeMarketConfidence(marketInput({ deficitRatioPrev: 3, deficitRatioNext: 5 }))
    expect(improving).toBeGreaterThan(worsening)
  })

  it('higher growth relative to potential raises market confidence', () => {
    const next = computeMarketConfidence(marketInput({ growthNext: 3 }))
    expect(next).toBeGreaterThan(50)
  })
})
