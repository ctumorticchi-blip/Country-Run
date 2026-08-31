import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'

/** M2 only implements these four controllable budget categories (see docs/GAMEPLAY_M2.md). */
export type BudgetCategoryId = 'health' | 'education' | 'investment' | 'defense'

/** Every category offers exactly three levels: cut spending, keep it flat, or invest more. */
export type BudgetLevel = 'cut' | 'maintain' | 'invest'

/**
 * Which `EconomicPolicyInput` field a category's Md€ delta feeds. Several
 * categories can share a field (health and defense both feed
 * `currentSpendingChanges` — the engine only cares about the aggregate, not
 * which ministry it came from); `budgetEffects.ts` sums per field.
 */
export type BudgetEngineField = Extract<
  keyof EconomicPolicyInput,
  'currentSpendingChanges' | 'educationInvestment' | 'publicInvestmentChanges'
>

export interface BudgetCategoryConfig {
  id: BudgetCategoryId
  label: string
  /** Current baseline annual spending, Md€ — display only, not itself fed to the engine. */
  baseline: number
  engineField: BudgetEngineField
  levels: Record<BudgetLevel, number>
  copy: Record<BudgetLevel, string>
}

/** The player's current choice for every category. */
export type BudgetSelections = Record<BudgetCategoryId, BudgetLevel>

export const NEUTRAL_BUDGET_SELECTIONS: BudgetSelections = {
  health: 'maintain',
  education: 'maintain',
  investment: 'maintain',
  defense: 'maintain',
}

export type BercyWarningLevel = 'expansionist' | 'stimulus' | 'balanced' | 'consolidation' | 'austerity'

export interface BudgetImpactEstimate {
  /** Sum of all categories' Md€/year deltas — the number the Bercy warning is based on. */
  netAnnualChange: number
  warningLevel: BercyWarningLevel
  /** Rough [low, high] band, percentage points, for the deficit ratio's next-turn move. */
  deficitRatioDeltaRange: [number, number]
  /** Rough [low, high] band, annualized pp, for growth over the next 12 months. */
  growthDeltaRange: [number, number]
  /** Rough [low, high] band for the popularity impact of this budget, in points. */
  popularityDeltaRange: [number, number]
  marketRisk: 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ'
}
