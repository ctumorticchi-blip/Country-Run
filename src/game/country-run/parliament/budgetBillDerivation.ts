import { BUDGET_CATEGORY_ORDER } from '../budget/budgetCategories.ts'
import { budgetSelectionsToPolicyDelta, computeNetAnnualChange } from '../budget/budgetEffects.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'
import { ABSOLUTE_MAJORITY } from '../prototype/parliament.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'
import type { PolicyAffinity } from './politicalTypes.ts'

export const BUDGET_BILL_ID = 'budget-bill'

/** Md€/year magnitude beyond which the net budget stance alone starts meaningfully swaying fiscal-discipline-sensitive blocs. */
const FISCAL_DISCIPLINE_SCALE = 40

function clamp11(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

function addTag(tags: PolicyAffinity, dimension: keyof PolicyAffinity, delta: number): void {
  tags[dimension] = clamp11((tags[dimension] ?? 0) + delta)
}

/** Each category's level shifts its own dimension, and the overall net change shifts `fiscalDiscipline` — a big spender reads as bad for discipline-sensitive blocs even before per-category reactions (M4 §22). */
function deriveBudgetPolicyTags(selections: BudgetSelections, netAnnualChange: number): PolicyAffinity {
  const tags: PolicyAffinity = { fiscalDiscipline: clamp11(-netAnnualChange / FISCAL_DISCIPLINE_SCALE) }

  const levelSign: Record<'cut' | 'maintain' | 'invest', number> = { cut: -0.6, maintain: 0, invest: 0.6 }
  addTag(tags, 'health', levelSign[selections.health])
  addTag(tags, 'publicSpending', levelSign[selections.health] * 0.3)
  addTag(tags, 'education', levelSign[selections.education])
  addTag(tags, 'publicInvestment', levelSign[selections.investment])
  addTag(tags, 'publicSpending', levelSign[selections.investment] * 0.3)
  addTag(tags, 'defense', levelSign[selections.defense])

  return tags
}

/**
 * Derives the year's mandatory Budget Bill from the player's ACTUAL Budget
 * Builder choices (M4 §21-22) — replacing M2's fixed negotiate/maintain/
 * concede vote. Every field is a pure function of `selections`; nothing
 * here is stored, so re-deriving it after a `SET_BUDGET_LEVEL` always
 * reflects the current draft with no stale copy to desync.
 */
export function deriveBudgetBill(selections: BudgetSelections): PoliticalBillDefinition {
  const economicPolicyEffect = budgetSelectionsToPolicyDelta(selections)
  const fiscalCost = computeNetAnnualChange(selections)
  const extremeCount = BUDGET_CATEGORY_ORDER.filter((id) => selections[id] !== 'maintain').length
  const controversy = Math.min(1, 0.1 + extremeCount * 0.12 + Math.abs(fiscalCost) / 60)

  return {
    id: BUDGET_BILL_ID,
    title: 'BUDGET 2028',
    description: 'Le budget annuel de l’État — le vote parlementaire le plus important de l’année.',
    policyTags: deriveBudgetPolicyTags(selections, fiscalCost),
    economicPolicyEffect,
    fiscalCost,
    reformIntensity: 0.2,
    controversy,
    promiseLinks: [],
    requiredPoliticalCapital: 4,
    urgency: 'HIGH',
    negotiability: 0.8,
    concessionsAvailable: [
      'INCREASE_HOUSING_FUNDING',
      'INCREASE_HEALTH_FUNDING',
      'INCREASE_GREEN_INVESTMENT',
      'INCREASE_TERRITORIAL_SUPPORT',
      'CUT_BUSINESS_TAX',
      'REDUCE_SPENDING_CAP',
    ],
    voteThreshold: ABSOLUTE_MAJORITY,
    implementationDelay: 0,
  }
}
