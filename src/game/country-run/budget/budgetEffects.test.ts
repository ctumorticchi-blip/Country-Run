import { describe, expect, it } from 'vitest'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetSelections } from './budgetTypes.ts'
import { budgetSelectionsToPolicyDelta, classifyBercyWarning, computeNetAnnualChange, estimateBudgetImpact } from './budgetEffects.ts'

describe('budgetSelectionsToPolicyDelta', () => {
  it('is all-neutral (empty deltas) when every category is maintained', () => {
    expect(budgetSelectionsToPolicyDelta(NEUTRAL_BUDGET_SELECTIONS)).toEqual({ currentSpendingChanges: 0, educationInvestment: 0, publicInvestmentChanges: 0 })
  })

  it('sums health and defense into the SAME currentSpendingChanges field, additively', () => {
    const selections: BudgetSelections = { health: 'invest', education: 'maintain', investment: 'maintain', defense: 'invest' }
    const delta = budgetSelectionsToPolicyDelta(selections)
    // health +10, defense +10 => 20, not one overwriting the other.
    expect(delta.currentSpendingChanges).toBe(20)
  })

  it('maps education to educationInvestment (feeds the delayed productivity effect, per M2 §11)', () => {
    const selections: BudgetSelections = { ...NEUTRAL_BUDGET_SELECTIONS, education: 'invest' }
    expect(budgetSelectionsToPolicyDelta(selections).educationInvestment).toBe(8)
  })

  it('maps public investment to publicInvestmentChanges', () => {
    const selections: BudgetSelections = { ...NEUTRAL_BUDGET_SELECTIONS, investment: 'cut' }
    expect(budgetSelectionsToPolicyDelta(selections).publicInvestmentChanges).toBe(-10)
  })

  it('every level is an annualized Md€/year delta, matching the M2 brief exactly', () => {
    const allInvest: BudgetSelections = { health: 'invest', education: 'invest', investment: 'invest', defense: 'invest' }
    const delta = budgetSelectionsToPolicyDelta(allInvest)
    expect(delta.currentSpendingChanges).toBe(20) // health +10, defense +10
    expect(delta.educationInvestment).toBe(8)
    expect(delta.publicInvestmentChanges).toBe(15)
  })
})

describe('computeNetAnnualChange', () => {
  it('is 0 when every category is maintained', () => {
    expect(computeNetAnnualChange(NEUTRAL_BUDGET_SELECTIONS)).toBe(0)
  })

  it('sums every category regardless of which engine field it maps to', () => {
    const selections: BudgetSelections = { health: 'invest', education: 'invest', investment: 'invest', defense: 'invest' }
    // 10 + 8 + 15 + 10
    expect(computeNetAnnualChange(selections)).toBe(43)
  })

  it('cuts are negative', () => {
    const selections: BudgetSelections = { health: 'cut', education: 'cut', investment: 'cut', defense: 'cut' }
    // -8 -6 -10 -5
    expect(computeNetAnnualChange(selections)).toBe(-29)
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
  it('returns a zero-centered estimate for a neutral budget', () => {
    const estimate = estimateBudgetImpact(NEUTRAL_BUDGET_SELECTIONS, 2800)
    expect(estimate.netAnnualChange).toBe(0)
    expect(estimate.warningLevel).toBe('balanced')
    expect(estimate.marketRisk).toBe('FAIBLE')
  })

  it('always returns a [low, high] range, never a single precise number', () => {
    const selections: BudgetSelections = { health: 'invest', education: 'invest', investment: 'invest', defense: 'invest' }
    const estimate = estimateBudgetImpact(selections, 2800)
    expect(estimate.deficitRatioDeltaRange[0]).toBeLessThanOrEqual(estimate.deficitRatioDeltaRange[1])
    expect(estimate.growthDeltaRange[0]).toBeLessThanOrEqual(estimate.growthDeltaRange[1])
    expect(estimate.popularityDeltaRange[0]).toBeLessThanOrEqual(estimate.popularityDeltaRange[1])
  })

  it('flags high market risk for an extreme expansionist budget', () => {
    const selections: BudgetSelections = { health: 'invest', education: 'invest', investment: 'invest', defense: 'invest' }
    const estimate = estimateBudgetImpact(selections, 2800)
    expect(estimate.marketRisk).toBe('ÉLEVÉ')
  })

  it('flags high market risk for extreme austerity too', () => {
    const selections: BudgetSelections = { health: 'cut', education: 'cut', investment: 'cut', defense: 'cut' }
    const estimate = estimateBudgetImpact(selections, 2800)
    expect(estimate.marketRisk).toBe('ÉLEVÉ')
  })
})
