import { describe, expect, it } from 'vitest'
import { SeededRng } from '../seeded-rng/SeededRng.ts'
import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from './config/defaultConfig.ts'
import {
  computeFiscalBalance,
  computePublicRevenue,
  computePublicSpending,
  type ComputeRevenueInput,
  type ComputeSpendingInput,
} from './fiscal.ts'

function revenueInput(overrides?: Partial<ComputeRevenueInput>): ComputeRevenueInput {
  return {
    publicRevenuePrev: 1350,
    nominalGrowth: 3.0,
    taxChanges: 0,
    rng: new SeededRng('revenue-test'),
    config: { ...DEFAULT_ECONOMIC_ENGINE_CONFIG.revenue, noiseStdDev: 0 },
    ...overrides,
  }
}

describe('computePublicRevenue', () => {
  it('stronger nominal growth produces a higher revenue level, all else equal', () => {
    const low = computePublicRevenue(revenueInput({ nominalGrowth: 1.0 }))
    const high = computePublicRevenue(revenueInput({ nominalGrowth: 5.0 }))
    expect(high.publicRevenue).toBeGreaterThan(low.publicRevenue)
  })

  it('does not apply the full annual growth rate in one turn', () => {
    const { publicRevenue } = computePublicRevenue(revenueInput({ nominalGrowth: 12 }))
    // A full annual 12% applied whole would give ~1512; a single turn's slice should land far short of that.
    expect(publicRevenue).toBeLessThan(1380)
  })

  it('a tax increase (positive taxChanges) raises revenue immediately by that amount', () => {
    const baseline = computePublicRevenue(revenueInput())
    const withTaxHike = computePublicRevenue(revenueInput({ taxChanges: 15 }))
    expect(withTaxHike.publicRevenue - baseline.publicRevenue).toBeCloseTo(15)
  })

  it('produces a controlled, seed-driven revenue surprise', () => {
    const rng = new SeededRng('surprise-check')
    const { revenueSurprise } = computePublicRevenue(
      revenueInput({ rng, config: DEFAULT_ECONOMIC_ENGINE_CONFIG.revenue }),
    )
    expect(revenueSurprise).not.toBe(0)
    expect(Math.abs(revenueSurprise)).toBeLessThan(1350 * DEFAULT_ECONOMIC_ENGINE_CONFIG.revenue.noiseStdDev)
  })

  it('is deterministic for the same seed and inputs', () => {
    const config = DEFAULT_ECONOMIC_ENGINE_CONFIG.revenue
    const run = () => computePublicRevenue(revenueInput({ rng: new SeededRng('replay'), config })).publicRevenue
    expect(run()).toBe(run())
  })
})

function spendingInput(overrides?: Partial<ComputeSpendingInput>): ComputeSpendingInput {
  return {
    publicSpendingPrev: 1500,
    interestCostPrev: 70,
    interestCostNext: 70,
    currentSpendingChanges: 0,
    publicInvestmentChanges: 0,
    transfersChanges: 0,
    config: DEFAULT_ECONOMIC_ENGINE_CONFIG.spending,
    ...overrides,
  }
}

describe('computePublicSpending', () => {
  it('discretionary spending increases raise total spending by that amount', () => {
    const baseline = computePublicSpending(spendingInput())
    const withIncrease = computePublicSpending(spendingInput({ currentSpendingChanges: 20 }))
    expect(withIncrease - baseline).toBeCloseTo(20)
  })

  it('a rising interest cost increases total spending by exactly the interest delta', () => {
    const baseline = computePublicSpending(spendingInput())
    const withHigherInterest = computePublicSpending(spendingInput({ interestCostNext: 90 }))
    expect(withHigherInterest - baseline).toBeCloseTo(20)
  })

  it('does not apply the full annual baseline drift in one turn', () => {
    const spending = computePublicSpending(spendingInput({ config: { baselineDrift: 12 } }))
    // Primary spending is 1430; a full 12% annual bump applied whole would give ~1601.6 + 70 = 1671.6;
    // one turn's linear slice (2%) should land far short of that.
    expect(spending).toBeLessThan(1600)
    expect(spending).toBeGreaterThan(1500)
  })
})

describe('computeFiscalBalance', () => {
  it('revenue below spending is a deficit (negative balance, positive deficit)', () => {
    const { fiscalBalance, deficit } = computeFiscalBalance(1350, 1500, 2800)
    expect(fiscalBalance).toBeCloseTo(-150)
    expect(deficit).toBeCloseTo(150)
  })

  it('revenue above spending is a surplus (positive balance, zero deficit)', () => {
    const { fiscalBalance, deficit } = computeFiscalBalance(1600, 1500, 2800)
    expect(fiscalBalance).toBeCloseTo(100)
    expect(deficit).toBe(0)
  })

  it('deficitRatio is deficit / nominalGdp * 100', () => {
    const { deficitRatio } = computeFiscalBalance(1350, 1500, 3000)
    expect(deficitRatio).toBeCloseTo((150 / 3000) * 100)
  })
})
