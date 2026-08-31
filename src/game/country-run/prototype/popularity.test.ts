import { describe, expect, it } from 'vitest'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetSelections } from '../budget/budgetTypes.ts'
import {
  applyPopularityDelta,
  clampPopularity,
  popularityFromBudget,
  popularityFromParliamentOutcome,
  popularityFromYearEndOutcomes,
} from './popularity.ts'

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

describe('popularityFromYearEndOutcomes', () => {
  it('rewards improved purchasing power', () => {
    expect(popularityFromYearEndOutcomes(1, 0)).toBeGreaterThan(0)
  })

  it('penalizes worsening unemployment', () => {
    expect(popularityFromYearEndOutcomes(0, 1)).toBeLessThan(0)
  })

  it('stays within the documented rough magnitude bands', () => {
    const best = popularityFromYearEndOutcomes(5, -5)
    const worst = popularityFromYearEndOutcomes(-5, 5)
    expect(best).toBeLessThanOrEqual(4)
    expect(worst).toBeGreaterThanOrEqual(-6)
  })
})

describe('popularityFromBudget', () => {
  it('is 0 for an all-maintained budget', () => {
    expect(popularityFromBudget(NEUTRAL_BUDGET_SELECTIONS)).toBe(0)
  })

  it('is positive for a heavily investing budget', () => {
    const selections: BudgetSelections = { health: 'invest', education: 'invest', investment: 'maintain', defense: 'maintain' }
    expect(popularityFromBudget(selections)).toBeGreaterThan(0)
  })

  it('is negative for heavy spending cuts', () => {
    const selections: BudgetSelections = { health: 'cut', education: 'cut', investment: 'maintain', defense: 'maintain' }
    expect(popularityFromBudget(selections)).toBeLessThan(0)
  })

  it('gives defense a smaller effect than health/education, per the prototype brief', () => {
    const defenseInvest: BudgetSelections = { ...NEUTRAL_BUDGET_SELECTIONS, defense: 'invest' }
    const healthInvest: BudgetSelections = { ...NEUTRAL_BUDGET_SELECTIONS, health: 'invest' }
    expect(Math.abs(popularityFromBudget(defenseInvest))).toBeLessThan(Math.abs(popularityFromBudget(healthInvest)))
  })
})

describe('popularityFromParliamentOutcome', () => {
  it('costs a flat -2 on rejection, per the M2 brief', () => {
    expect(popularityFromParliamentOutcome('rejected')).toBe(-2)
  })

  it('is neutral on adoption', () => {
    expect(popularityFromParliamentOutcome('adopted')).toBe(0)
  })
})
