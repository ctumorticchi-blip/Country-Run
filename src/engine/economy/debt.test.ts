import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import {
  computeDebt,
  computeEffectiveDebtRate,
  computeInterestCost,
  type ComputeDebtInput,
  type ComputeEffectiveDebtRateInput,
} from './debt.ts'
import type { WorldState } from './types.ts'

const NEUTRAL_WORLD: WorldState = {
  eurozoneGrowth: 1.2,
  ecbRate: 3.0,
  oilPriceIndex: 100,
  globalTradeGrowth: 2.0,
  externalInflation: 2.0,
}

function rateInput(overrides?: Partial<ComputeEffectiveDebtRateInput>): ComputeEffectiveDebtRateInput {
  return {
    effectiveDebtRatePrev: 2.0,
    world: NEUTRAL_WORLD,
    marketConfidencePrev: 55,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.debt,
    ...overrides,
  }
}

describe('computeEffectiveDebtRate', () => {
  it('moves only partially toward the new borrowing rate in one turn (progressive refinancing)', () => {
    const withHigherEcb = computeEffectiveDebtRate(rateInput({ world: { ...NEUTRAL_WORLD, ecbRate: 6.0 } }))
    const newBorrowingRate = 6.0 + DEFAULT_ECONOMIC_ENGINE_CONFIG.debt.baselineSpread
    // A jump from 3% to 6% ECB rate should nudge the blended rate up, but nowhere near the full new borrowing rate in one turn.
    expect(withHigherEcb).toBeGreaterThan(2.0)
    expect(withHigherEcb).toBeLessThan(newBorrowingRate - 1)
  })

  it('after many turns of a stable higher ECB rate, the effective rate converges toward the new borrowing rate', () => {
    let rate = 2.0
    const world = { ...NEUTRAL_WORLD, ecbRate: 6.0 }
    for (let i = 0; i < 60; i++) {
      rate = computeEffectiveDebtRate(rateInput({ effectiveDebtRatePrev: rate, world }))
    }
    const newBorrowingRate = 6.0 + DEFAULT_ECONOMIC_ENGINE_CONFIG.debt.baselineSpread
    expect(rate).toBeCloseTo(newBorrowingRate, 1)
  })

  it('lower market confidence widens the spread and raises the effective rate trajectory', () => {
    const highConfidence = computeEffectiveDebtRate(rateInput({ marketConfidencePrev: 80 }))
    const lowConfidence = computeEffectiveDebtRate(rateInput({ marketConfidencePrev: 10 }))
    expect(lowConfidence).toBeGreaterThan(highConfidence)
  })

  it('never drops below the configured minimum', () => {
    const rate = computeEffectiveDebtRate(
      rateInput({ effectiveDebtRatePrev: 0, world: { ...NEUTRAL_WORLD, ecbRate: -5 }, marketConfidencePrev: 100 }),
    )
    expect(rate).toBeGreaterThanOrEqual(DEFAULT_ECONOMIC_ENGINE_CONFIG.debt.minEffectiveDebtRate)
  })
})

describe('computeInterestCost', () => {
  it('is the effective rate applied to the PREVIOUS debt stock', () => {
    expect(computeInterestCost(2.5, 3000)).toBeCloseTo(75)
  })
})

function debtInput(overrides?: Partial<ComputeDebtInput>): ComputeDebtInput {
  return {
    debtPrev: 3200,
    nominalGdpNext: 2800,
    fiscalBalance: -150, // Md€/year deficit
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.debt,
    ...overrides,
  }
}

describe('computeDebt', () => {
  it('a deficit increases nominal debt', () => {
    const { debt } = computeDebt(debtInput({ fiscalBalance: -150 }))
    expect(debt).toBeGreaterThan(3200)
  })

  it('a surplus decreases nominal debt', () => {
    const { debt } = computeDebt(debtInput({ fiscalBalance: 50 }))
    expect(debt).toBeLessThan(3200)
  })

  it('only accumulates 1/6th of the annualized deficit per turn, not the full annual amount', () => {
    const { debt } = computeDebt(debtInput({ fiscalBalance: -600 }))
    // A full annual deficit of 600 applied whole would give 3800; one turn's slice should land near 3200 + 100.
    expect(debt).toBeCloseTo(3300, 0)
    expect(debt).toBeLessThan(3800)
  })

  it('debt ratio can fall even while nominal debt rises, if nominal GDP grows enough', () => {
    const { debt, debtRatio } = computeDebt(debtInput({ debtPrev: 3200, nominalGdpNext: 3400, fiscalBalance: -150 }))
    expect(debt).toBeGreaterThan(3200) // nominal debt still went up
    const debtRatioPrev = (3200 / 2800) * 100
    expect(debtRatio).toBeLessThan(debtRatioPrev) // but the ratio improved
  })

  it('debtRatio is debt / nominalGdp * 100', () => {
    const { debt, debtRatio } = computeDebt(debtInput({ nominalGdpNext: 3000, fiscalBalance: 0 }))
    expect(debtRatio).toBeCloseTo((debt / 3000) * 100)
  })

  it('never goes negative', () => {
    const { debt } = computeDebt(debtInput({ debtPrev: 5, fiscalBalance: 1000 }))
    expect(debt).toBeGreaterThanOrEqual(0)
  })
})
