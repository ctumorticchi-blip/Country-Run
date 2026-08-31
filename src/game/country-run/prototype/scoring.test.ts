import { describe, expect, it } from 'vitest'
import type { EconomicState } from '../../../engine/state/gameState.ts'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetSelections } from '../budget/budgetTypes.ts'
import { computeEndingTitle, computeScore } from './scoring.ts'

function makeEconomicState(overrides?: Partial<EconomicState>): EconomicState {
  return {
    gdp: 2800,
    nominalGdp: 2800,
    potentialGrowth: 0.9,
    growth: 0.9,
    inflation: 1.7,
    unemployment: 8.1,
    structuralUnemployment: 8.1,
    publicRevenue: 1372,
    publicSpending: 1512,
    fiscalBalance: -140,
    deficit: 140,
    deficitRatio: 5.0,
    debt: 3360,
    debtRatio: 120.0,
    effectiveDebtRate: 3.0,
    interestCost: 100.8,
    purchasingPower: 0,
    productivityGrowth: 0.83,
    consumerConfidence: 50,
    businessConfidence: 50,
    marketConfidence: 50,
    publicSectorEfficiency: 55,
    ...overrides,
  }
}

describe('computeScore', () => {
  it('stays within [0, 10000] for an unchanged (neutral) trajectory', () => {
    const start = makeEconomicState()
    const end = makeEconomicState()
    const score = computeScore(start, end, 52, NEUTRAL_BUDGET_SELECTIONS)
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(10000)
  })

  it('stays within [0, 10000] for a strongly improved trajectory', () => {
    const start = makeEconomicState()
    const end = makeEconomicState({ growth: 3, unemployment: 6, deficitRatio: 2, debtRatio: 110, purchasingPower: 2 })
    const score = computeScore(start, end, 90, NEUTRAL_BUDGET_SELECTIONS)
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(10000)
  })

  it('stays within [0, 10000] for a catastrophic trajectory', () => {
    const start = makeEconomicState()
    const end = makeEconomicState({ growth: -3, unemployment: 12, deficitRatio: 12, debtRatio: 140, purchasingPower: -3 })
    const score = computeScore(start, end, 10, NEUTRAL_BUDGET_SELECTIONS)
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(10000)
  })

  it('scores a strongly improved trajectory higher than a catastrophic one', () => {
    const start = makeEconomicState()
    const good = computeScore(start, makeEconomicState({ growth: 3, unemployment: 6, deficitRatio: 2, debtRatio: 110, purchasingPower: 2 }), 80, NEUTRAL_BUDGET_SELECTIONS)
    const bad = computeScore(start, makeEconomicState({ growth: -3, unemployment: 12, deficitRatio: 12, debtRatio: 140, purchasingPower: -3 }), 20, NEUTRAL_BUDGET_SELECTIONS)
    expect(good.total).toBeGreaterThan(bad.total)
  })

  it('a catastrophic debt/deficit blowout applies the penalty multiplier, even with strong popularity', () => {
    const start = makeEconomicState()
    const end = makeEconomicState({ debtRatio: 130, deficitRatio: 9 })
    const score = computeScore(start, end, 95, NEUTRAL_BUDGET_SELECTIONS)
    expect(score.catastropheMultiplier).toBeLessThan(1)
  })

  it('does not apply the catastrophe multiplier for a merely mediocre (not catastrophic) trajectory', () => {
    const start = makeEconomicState()
    const end = makeEconomicState({ debtRatio: 121, deficitRatio: 5.2, growth: 0.7, unemployment: 8.3 })
    const score = computeScore(start, end, 50, NEUTRAL_BUDGET_SELECTIONS)
    expect(score.catastropheMultiplier).toBe(1)
  })
})

describe('computeEndingTitle', () => {
  const start = makeEconomicState()

  it('assigns LA TEMPÊTE when multiple indicators deteriorate heavily', () => {
    const end = makeEconomicState({ growth: -1, unemployment: 10, debtRatio: 126 })
    expect(computeEndingTitle(start, end, 30, NEUTRAL_BUDGET_SELECTIONS)).toBe('LA TEMPÊTE')
  })

  it('assigns LE BÂTISSEUR for investment-focused, reasonable finances', () => {
    const selections: BudgetSelections = { ...NEUTRAL_BUDGET_SELECTIONS, investment: 'invest', education: 'invest' }
    const end = makeEconomicState({ debtRatio: 121.5, growth: 1.1 })
    expect(computeEndingTitle(start, end, 55, selections)).toBe('LE BÂTISSEUR')
  })

  it('assigns LE PRÉSIDENT PRUDENCE for strong fiscal discipline but weak growth', () => {
    const end = makeEconomicState({ deficitRatio: 4.2, growth: 0.5, debtRatio: 118 })
    expect(computeEndingTitle(start, end, 50, NEUTRAL_BUDGET_SELECTIONS)).toBe('LE PRÉSIDENT PRUDENCE')
  })

  it('never returns anything outside the documented title set', () => {
    const titles = new Set([
      'LE BÂTISSEUR',
      'LE GESTIONNAIRE',
      'LE PARI RISQUÉ',
      'LE PRÉSIDENT PRUDENCE',
      'LA TEMPÊTE',
    ])
    const end = makeEconomicState({ growth: 1.4, debtRatio: 122 })
    expect(titles.has(computeEndingTitle(start, end, 52, NEUTRAL_BUDGET_SELECTIONS))).toBe(true)
  })
})
