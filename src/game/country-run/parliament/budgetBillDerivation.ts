import { sumFinanceChangeEffects, type FinanceBlockChange } from '../finance/financeEffects.ts'
import type { RevenueBlockId, SpendingBlockId } from '../finance/financeTypes.ts'
import { ABSOLUTE_MAJORITY } from '../prototype/parliament.ts'
import type { PoliticalBillDefinition } from './billTypes.ts'
import type { PolicyAffinity, PolicyDimension } from './politicalTypes.ts'

export const BUDGET_BILL_ID = 'budget-bill'

/** Md€/year magnitude beyond which the net budget stance alone starts meaningfully swaying fiscal-discipline-sensitive blocs. */
const FISCAL_DISCIPLINE_SCALE = 40
/** A block's own CHANGE this cycle, scaled to roughly [-1, 1] against its typical tier magnitude, for the affinity dot product. */
const BLOCK_TAG_SCALE = 12

function clamp11(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

function addTag(tags: PolicyAffinity, dimension: PolicyDimension, delta: number): void {
  tags[dimension] = clamp11((tags[dimension] ?? 0) + delta)
}

const SPENDING_TAG_DIMENSION: Record<SpendingBlockId, PolicyDimension | null> = {
  pensions: 'pensions',
  health: 'health',
  solidarity: null,
  education: 'education',
  economyInvestment: 'publicInvestment',
  defense: 'defense',
  security: null,
  territories: 'housing',
  administration: null,
}

const REVENUE_TAG_DIMENSION: Record<RevenueBlockId, PolicyDimension> = {
  householdTax: 'householdTax',
  businessTax: 'businessTax',
  consumptionTax: 'householdTax',
  socialContributions: 'businessTax',
}

/**
 * Each CHANGED block shifts its own dimension (blocs react to what's
 * actually being decided this cycle, per M6 §52's "do not hand-author
 * annual budget ideology" — this is still entirely magnitude/sign-derived,
 * never a per-tier authored ideology), and the overall net structural
 * change shifts `fiscalDiscipline` — a budget that raises spending/cuts
 * taxes reads as bad for discipline-sensitive blocs, a consolidation reads
 * as good (M4 §22, extended to the full M6 finance model).
 */
function deriveBudgetPolicyTags(changes: readonly FinanceBlockChange[], netStructuralChange: number): PolicyAffinity {
  const tags: PolicyAffinity = { fiscalDiscipline: clamp11(-netStructuralChange / FISCAL_DISCIPLINE_SCALE) }

  for (const change of changes) {
    if (change.kind === 'spending') {
      const dimension = SPENDING_TAG_DIMENSION[change.blockId as SpendingBlockId]
      if (dimension) addTag(tags, dimension, clamp11(change.fiscalChange / BLOCK_TAG_SCALE))
      if (change.blockId === 'administration') addTag(tags, 'fiscalDiscipline', -clamp11(change.fiscalChange / BLOCK_TAG_SCALE) * 0.5)
    } else {
      const dimension = REVENUE_TAG_DIMENSION[change.blockId as RevenueBlockId]
      // `businessTax`/`householdTax` dimensions are native-signed ("+1 = this bill RAISES that
      // tax", politicalTypes.ts) — `fiscalChange` is ledger-signed (positive = a CUT), so flip it.
      addTag(tags, dimension, clamp11(-change.fiscalChange / BLOCK_TAG_SCALE))
    }
  }

  return tags
}

/**
 * Derives THIS budget cycle's mandatory Budget Bill from the player's
 * ACTUAL Budget Builder choices — the complete M6 finance model (spending +
 * revenue), not just spending (M6 §52). `changes` is the exact same
 * `FinanceBlockChange[]` `gameReducer.ts` uses to schedule the per-block
 * implementations, so the bill's `economicPolicyEffect`/`fiscalCost`/
 * `policyTags` can never drift from what actually gets enacted on
 * adoption. Every field is a pure function of its inputs.
 */
export function deriveBudgetBill(changes: readonly FinanceBlockChange[], budgetLabel: string): PoliticalBillDefinition {
  const economicPolicyEffect = sumFinanceChangeEffects(changes)
  const netStructuralChange = changes.reduce((sum, c) => sum + c.fiscalChange, 0)
  const controversy = Math.min(1, 0.1 + changes.length * 0.06 + Math.abs(netStructuralChange) / 60)

  return {
    id: BUDGET_BILL_ID,
    title: budgetLabel,
    description: 'Le budget annuel de l’État — le vote parlementaire le plus important de l’année.',
    policyTags: deriveBudgetPolicyTags(changes, netStructuralChange),
    economicPolicyEffect,
    fiscalCost: netStructuralChange,
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
