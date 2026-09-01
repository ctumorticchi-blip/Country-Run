import { BUDGET_CATEGORY_ORDER } from '../budget/budgetCategories.ts'
import { budgetLevelsToPolicyInput, netChangeFromCurrentPolicy } from '../budget/budgetEffects.ts'
import type { BudgetLevels } from '../budget/budgetTypes.ts'
import { ABSOLUTE_MAJORITY } from '../prototype/parliament.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'
import type { PolicyAffinity, PolicyDimension } from './politicalTypes.ts'

export const BUDGET_BILL_ID = 'budget-bill'

/** Md€/year magnitude beyond which the net budget stance alone starts meaningfully swaying fiscal-discipline-sensitive blocs. */
const FISCAL_DISCIPLINE_SCALE = 40
/** A category's own level, scaled to roughly [-1, 1] against its typical tier magnitude, for the affinity dot product. */
const CATEGORY_TAG_SCALE = 12

function clamp11(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

function addTag(tags: PolicyAffinity, dimension: PolicyDimension, delta: number): void {
  tags[dimension] = clamp11((tags[dimension] ?? 0) + delta)
}

/** Each category's ABSOLUTE stance shifts its own dimension (blocs react to where policy currently stands, not just this cycle's move), and the overall net level shifts `fiscalDiscipline` — a big spender reads as bad for discipline-sensitive blocs (M4 §22, extended to 7 categories in M5 §30). */
function deriveBudgetPolicyTags(levels: BudgetLevels, totalLevel: number): PolicyAffinity {
  const tags: PolicyAffinity = { fiscalDiscipline: clamp11(-totalLevel / FISCAL_DISCIPLINE_SCALE) }
  const sign = (level: number) => clamp11(level / CATEGORY_TAG_SCALE)

  addTag(tags, 'health', sign(levels.health))
  addTag(tags, 'publicSpending', sign(levels.health) * 0.3)
  addTag(tags, 'education', sign(levels.education))
  addTag(tags, 'publicInvestment', sign(levels.publicInvestment))
  addTag(tags, 'publicSpending', sign(levels.publicInvestment) * 0.3)
  addTag(tags, 'defense', sign(levels.defense))
  addTag(tags, 'housing', sign(levels.housingTerritories))
  addTag(tags, 'publicSpending', sign(levels.housingTerritories) * 0.2)
  addTag(tags, 'environment', sign(levels.greenTransition))
  addTag(tags, 'publicInvestment', sign(levels.greenTransition) * 0.3)
  addTag(tags, 'fiscalDiscipline', -sign(levels.administrationEfficiency) * 0.5)
  addTag(tags, 'publicSpending', sign(levels.administrationEfficiency) * 0.3)

  return tags
}

/**
 * Derives THIS budget cycle's mandatory Budget Bill from the player's
 * ACTUAL Budget Builder choices (M4 §21-22, M5 §28-29) — `newLevels` is
 * the FULL absolute policy stance (fed to the engine as-is; the engine's
 * own `computePolicyDelta` handles turning consecutive absolute totals
 * into a one-time delta, never re-adding a sustained level), while
 * `fiscalCost` reports the MARGINAL change from `previousLevels` — "what's
 * actually being decided this cycle" for display and controversy. Every
 * field is a pure function of its inputs; nothing here is stored, so
 * re-deriving it after a `SET_BUDGET_TIER` always reflects the current
 * draft with no stale copy to desync.
 */
export function deriveBudgetBill(newLevels: BudgetLevels, previousLevels: BudgetLevels, budgetLabel: string): PoliticalBillDefinition {
  const economicPolicyEffect = budgetLevelsToPolicyInput(newLevels)
  const netChange = netChangeFromCurrentPolicy(newLevels, previousLevels)
  const totalLevel = BUDGET_CATEGORY_ORDER.reduce((sum, id) => sum + newLevels[id], 0)
  const changedCount = BUDGET_CATEGORY_ORDER.filter((id) => newLevels[id] !== previousLevels[id]).length
  const controversy = Math.min(1, 0.1 + changedCount * 0.1 + Math.abs(netChange) / 60)

  return {
    id: BUDGET_BILL_ID,
    title: budgetLabel,
    description: 'Le budget annuel de l’État — le vote parlementaire le plus important de l’année.',
    policyTags: deriveBudgetPolicyTags(newLevels, totalLevel),
    economicPolicyEffect,
    fiscalCost: netChange,
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
