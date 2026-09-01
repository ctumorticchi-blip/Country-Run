import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'

/**
 * M5 §30: 7 controllable policy blocks — game-control ENVELOPES, not literal
 * exhaustive COFOG accounting. Pensions/taxes stay reforms (`parliament/`)
 * rather than budget categories until a dedicated architecture exists for
 * them (documented limitation, see docs/MANDATE_M5.md).
 */
export type BudgetCategoryId =
  | 'health'
  | 'education'
  | 'publicInvestment'
  | 'defense'
  | 'housingTerritories'
  | 'greenTransition'
  | 'administrationEfficiency'

export type BudgetEngineField = Extract<
  keyof EconomicPolicyInput,
  'currentSpendingChanges' | 'educationInvestment' | 'publicInvestmentChanges' | 'infrastructureInvestment'
>

/** One selectable tier within a category — an ABSOLUTE annualized Md€/year level (M5 §31), not a delta from the previous cycle. Picking a tier makes it the new persistent level for that category. */
export interface BudgetTier {
  id: string
  label: string
  value: number
  copy: string
}

export interface BudgetCategoryConfig {
  id: BudgetCategoryId
  label: string
  /** Reference baseline annual spending, Md€ — display only, not itself fed to the engine (M5 §30: envelope, not exhaustive accounting). */
  baseline: number
  engineField: BudgetEngineField
  tiers: BudgetTier[]
}

/** The player's currently SELECTED tier id per category for the budget cycle being drafted (ephemeral UI draft — resolved to an absolute level on submission). */
export type BudgetSelections = Record<BudgetCategoryId, string>

/**
 * The PERSISTENT absolute Md€/year level per category, carried across every
 * budget cycle in the mandate (M5 §29). This — not `BudgetSelections` — is
 * what `mandate/turnController.ts` folds into the sustained policy input:
 * a category kept at the same level year over year contributes a zero
 * policy DELTA (computed by the engine itself via `computePolicyDelta`),
 * exactly the M1.5 discipline, now exercised every year instead of once.
 */
export type BudgetLevels = Record<BudgetCategoryId, number>

export type BercyWarningLevel = 'expansionist' | 'stimulus' | 'balanced' | 'consolidation' | 'austerity'

export interface BudgetImpactEstimate {
  /** Sum of all categories' Md€/year ABSOLUTE levels — the total fiscal stance the Bercy-style warning is based on. */
  totalAnnualLevel: number
  /** Sum of (new level - previous level) per category — M5 §32 "change vs current policy". */
  netChangeFromCurrentPolicy: number
  warningLevel: BercyWarningLevel
  /** Rough [low, high] band, percentage points, for the deficit ratio's next-turn move. */
  deficitRatioDeltaRange: [number, number]
  /** Rough [low, high] band, annualized pp, for growth over the next 12 months. */
  growthDeltaRange: [number, number]
  /** Rough [low, high] band for the popularity impact of this budget, in points. */
  popularityDeltaRange: [number, number]
  marketRisk: 'FAIBLE' | 'MODÉRÉ' | 'ÉLEVÉ'
}
