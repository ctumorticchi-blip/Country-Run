import { describe, expect, it } from 'vitest'
import { NEUTRAL_BUDGET_LEVELS, NEUTRAL_BUDGET_SELECTIONS } from './budgetCategories.ts'
import type { BudgetLevels } from './budgetTypes.ts'
import {
  budgetLevelsToPolicyInput,
  classifyBercyWarning,
  estimateBudgetImpact,
  netChangeFromCurrentPolicy,
  selectionsToLevels,
  totalBudgetLevel,
} from './budgetEffects.ts'

describe('selectionsToLevels / budgetLevelsToPolicyInput', () => {
  it('is all-zero when every category is at "maintain"', () => {
    expect(selectionsToLevels(NEUTRAL_BUDGET_SELECTIONS)).toEqual(NEUTRAL_BUDGET_LEVELS)
    expect(budgetLevelsToPolicyInput(NEUTRAL_BUDGET_LEVELS)).toEqual({
      currentSpendingChanges: 0,
      educationInvestment: 0,
      publicInvestmentChanges: 0,
      infrastructureInvestment: 0,
    })
  })

  it('sums health, defense AND administrationEfficiency into the SAME currentSpendingChanges field, additively', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10, defense: 10, administrationEfficiency: -5 }
    const policy = budgetLevelsToPolicyInput(levels)
    expect(policy.currentSpendingChanges).toBe(15)
  })

  it('maps education to educationInvestment', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, education: 8 }
    expect(budgetLevelsToPolicyInput(levels).educationInvestment).toBe(8)
  })

  it('sums publicInvestment AND housingTerritories into the SAME publicInvestmentChanges field', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, publicInvestment: 15, housingTerritories: 8 }
    expect(budgetLevelsToPolicyInput(levels).publicInvestmentChanges).toBe(23)
  })

  it('maps greenTransition to infrastructureInvestment', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, greenTransition: 8 }
    expect(budgetLevelsToPolicyInput(levels).infrastructureInvestment).toBe(8)
  })
})

describe('totalBudgetLevel / netChangeFromCurrentPolicy', () => {
  it('totalBudgetLevel is 0 for the neutral levels', () => {
    expect(totalBudgetLevel(NEUTRAL_BUDGET_LEVELS)).toBe(0)
  })

  it('netChangeFromCurrentPolicy is 0 when nothing changed year over year (M5 §29)', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    expect(netChangeFromCurrentPolicy(levels, levels)).toBe(0)
  })

  it('netChangeFromCurrentPolicy reflects only the MARGINAL move — kept at +10 => delta 0, raised to +15 => delta +5, cut to 0 => delta -10', () => {
    const previous: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    const kept: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10 }
    const raised: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 15 }
    const cut: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 0 }
    expect(netChangeFromCurrentPolicy(kept, previous)).toBe(0)
    expect(netChangeFromCurrentPolicy(raised, previous)).toBe(5)
    expect(netChangeFromCurrentPolicy(cut, previous)).toBe(-10)
  })
})

describe('classifyBercyWarning', () => {
  it('classifies each band from the M2 brief', () => {
    expect(classifyBercyWarning(30)).toBe('expansionist')
    expect(classifyBercyWarning(25.1)).toBe('expansionist')
    expect(classifyBercyWarning(15)).toBe('stimulus')
    expect(classifyBercyWarning(10)).toBe('stimulus')
    expect(classifyBercyWarning(0)).toBe('balanced')
    expect(classifyBercyWarning(-9)).toBe('balanced')
    expect(classifyBercyWarning(-15)).toBe('consolidation')
    expect(classifyBercyWarning(-25)).toBe('consolidation')
    expect(classifyBercyWarning(-30)).toBe('austerity')
  })
})

describe('estimateBudgetImpact', () => {
  it('returns a zero-centered estimate for a neutral, unchanged budget', () => {
    const estimate = estimateBudgetImpact(NEUTRAL_BUDGET_LEVELS, NEUTRAL_BUDGET_LEVELS, 2800)
    expect(estimate.totalAnnualLevel).toBe(0)
    expect(estimate.netChangeFromCurrentPolicy).toBe(0)
    expect(estimate.warningLevel).toBe('balanced')
    expect(estimate.marketRisk).toBe('FAIBLE')
  })

  it('always returns a [low, high] range, never a single precise number', () => {
    const levels: BudgetLevels = { health: 10, education: 8, publicInvestment: 15, defense: 10, housingTerritories: 8, greenTransition: 8, administrationEfficiency: 0 }
    const estimate = estimateBudgetImpact(levels, NEUTRAL_BUDGET_LEVELS, 2800)
    expect(estimate.deficitRatioDeltaRange[0]).toBeLessThanOrEqual(estimate.deficitRatioDeltaRange[1])
    expect(estimate.growthDeltaRange[0]).toBeLessThanOrEqual(estimate.growthDeltaRange[1])
    expect(estimate.popularityDeltaRange[0]).toBeLessThanOrEqual(estimate.popularityDeltaRange[1])
  })

  it('flags high market risk for an extreme expansionist total stance', () => {
    const levels: BudgetLevels = { health: 10, education: 8, publicInvestment: 15, defense: 10, housingTerritories: 8, greenTransition: 8, administrationEfficiency: 0 }
    const estimate = estimateBudgetImpact(levels, NEUTRAL_BUDGET_LEVELS, 2800)
    expect(estimate.marketRisk).toBe('ÉLEVÉ')
  })

  it('flags high market risk for extreme austerity too', () => {
    const levels: BudgetLevels = { health: -10, education: -8, publicInvestment: -10, defense: -5, housingTerritories: -6, greenTransition: -4, administrationEfficiency: -12 }
    const estimate = estimateBudgetImpact(levels, NEUTRAL_BUDGET_LEVELS, 2800)
    expect(estimate.marketRisk).toBe('ÉLEVÉ')
  })
})
