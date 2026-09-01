import { describe, expect, it } from 'vitest'
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_ORDER,
  getTier,
  NEUTRAL_BUDGET_LEVELS,
  NEUTRAL_BUDGET_SELECTIONS,
  selectionsFromLevels,
} from './budgetCategories.ts'
import type { BudgetLevels } from './budgetTypes.ts'

describe('BUDGET_CATEGORIES — content shape (M5 §30-31)', () => {
  it('has exactly the 7 documented categories, matching BUDGET_CATEGORY_ORDER', () => {
    expect(BUDGET_CATEGORY_ORDER).toHaveLength(7)
    expect(Object.keys(BUDGET_CATEGORIES).sort()).toEqual([...BUDGET_CATEGORY_ORDER].sort())
  })

  it('every category has 3 or 4 tiers, each with a unique id within the category', () => {
    for (const id of BUDGET_CATEGORY_ORDER) {
      const tiers = BUDGET_CATEGORIES[id].tiers
      expect(tiers.length).toBeGreaterThanOrEqual(3)
      expect(tiers.length).toBeLessThanOrEqual(4)
      expect(new Set(tiers.map((t) => t.id)).size).toBe(tiers.length)
    }
  })

  it('every category has exactly one neutral (value 0) "maintain" tier', () => {
    for (const id of BUDGET_CATEGORY_ORDER) {
      const maintainTiers = BUDGET_CATEGORIES[id].tiers.filter((t) => t.value === 0)
      expect(maintainTiers).toHaveLength(1)
      expect(maintainTiers[0].id).toBe('maintain')
    }
  })

  it('NEUTRAL_BUDGET_LEVELS is all zeros and NEUTRAL_BUDGET_SELECTIONS is all "maintain"', () => {
    for (const id of BUDGET_CATEGORY_ORDER) {
      expect(NEUTRAL_BUDGET_LEVELS[id]).toBe(0)
      expect(NEUTRAL_BUDGET_SELECTIONS[id]).toBe('maintain')
    }
  })
})

describe('getTier', () => {
  it('resolves a real tier id to its definition', () => {
    const tier = getTier('health', 'hospitalPlan')
    expect(tier.value).toBe(10)
  })

  it('throws on an unknown tier id for a given category', () => {
    expect(() => getTier('health', 'not-a-real-tier')).toThrow()
  })
})

describe('selectionsFromLevels', () => {
  it('maps a set of levels back to the tier ids that produce them', () => {
    const levels: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 10, education: -8 }
    const selections = selectionsFromLevels(levels)
    expect(selections.health).toBe('hospitalPlan')
    expect(selections.education).toBe('cuts')
    expect(selections.defense).toBe('maintain')
  })

  it('falls back to "maintain" for a level that matches no tier (e.g. after a concession nudged it off-grid)', () => {
    const offGrid: BudgetLevels = { ...NEUTRAL_BUDGET_LEVELS, health: 3.5 }
    expect(selectionsFromLevels(offGrid).health).toBe('maintain')
  })

  it('round-trips: selectionsFromLevels(levels) resolved back through getTier reproduces the same values for every ON-GRID level', () => {
    const levels: BudgetLevels = { health: 10, education: 8, publicInvestment: -10, defense: 0, housingTerritories: 8, greenTransition: -4, administrationEfficiency: -12 }
    const selections = selectionsFromLevels(levels)
    for (const id of BUDGET_CATEGORY_ORDER) {
      expect(getTier(id, selections[id]).value).toBe(levels[id])
    }
  })
})
