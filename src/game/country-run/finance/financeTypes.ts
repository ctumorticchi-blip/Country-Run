import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'

/**
 * M6 §1-6: the complete public-finance decomposition — 9 controllable
 * spending blocks (debt interest is a 10th, but it is LOCKED/CALCULATED,
 * never a player tier, so it lives outside this union — see
 * `financeEffects.ts`'s `DEBT_INTEREST_BLOCK_LABEL`) and 4 controllable
 * revenue blocks (a 5th, "other revenue", is a non-player display residual
 * — see `revenueBlocks.ts`).
 */
export type SpendingBlockId =
  | 'pensions'
  | 'health'
  | 'solidarity'
  | 'education'
  | 'economyInvestment'
  | 'defense'
  | 'security'
  | 'territories'
  | 'administration'

export type RevenueBlockId = 'householdTax' | 'businessTax' | 'consumptionTax' | 'socialContributions'

/** M6 §3: every baseline figure must carry a provenance status — never label an invented 2027 game-design number OBSERVED. */
export type DataProvenance = 'OBSERVED' | 'FORECAST' | 'GAME_ESTIMATE' | 'SIMULATED'

/**
 * One selectable tier within a spending or revenue block (M6 §7). Unlike
 * M5's `BudgetTier` (a single `engineField`/`value` pair), a tier here
 * carries its FULL `policyEffect` — an absolute annualized level across
 * however many `EconomicPolicyInput` fields it genuinely touches. This is
 * what fixes the M5-era tax/revenue wiring gap by construction: a tax
 * tier's `policyEffect` sets `taxChanges` (the field the engine's own
 * `computePublicRevenue` actually reads) AND the matching `*TaxImpulse`
 * field (confidence/inflation side effect) in the same place, so the two
 * can never drift apart again (see `docs/ECONOMY_BUDGET_M6.md`, "Recettes
 * — le correctif M6").
 */
export interface FinanceTier {
  id: string
  label: string
  /** Md€/year vs a true zero baseline — the headline number shown on the tier button. Spending: positive = more spending. Revenue: positive = more revenue (a tax INCREASE). Always the sum of `policyEffect`'s fiscally-relevant fields, kept consistent by construction (see reconciliation tests). */
  annualFiscalDelta: number
  /** The ABSOLUTE annualized level this tier contributes when selected — fed to the engine as-is; `computePolicyDelta` (M1.5) is what keeps a sustained, unchanged tier from re-adding itself (M6 §1's non-negotiable rule). */
  policyEffect: Partial<EconomicPolicyInput>
  description: string
  /** Turns before this tier's `policyEffect` is fully felt — 0 = immediate (folds in the turn the budget is adopted), >0 = scheduled via the same `implementationSchedule.ts` queue a reform bill uses (M6 §8: "pension savings should phase in"). */
  implementationTiming: number
  temporaryOrPermanent: 'PERMANENT' | 'TEMPORARY'
  /** Plain-language, non-numeric effect notes for the tier's expanded card (M6 §38 "policy impact cards") — never a fake-precise number beyond `annualFiscalDelta` itself. */
  economicEffects: string[]
  publicServiceEffects?: string[]
  /** Short display-only labels (e.g. "Discipline budgétaire") — informational chips, NOT what drives Parliament bloc math. The real `PolicyAffinity` a Budget Bill carries is still derived from each block's actual level/sign in `parliament/budgetBillDerivation.ts` (M6 §52: "do not hand-author annual budget ideology"). */
  politicalTags?: string[]
  promiseLinks?: string[]
  riskDescription?: string
}

export interface FinanceBlockConfig<Id extends string> {
  id: Id
  label: string
  /** Reference annualized envelope, Md€/year — display only, the M6 §6 reconciliation baseline (see `spendingBlocks.ts`/`revenueBlocks.ts` module doc for the exact sum-to-calibrated-total check). */
  baseline: number
  provenance: DataProvenance
  tiers: FinanceTier[]
  /**
   * M6 §23: set only on the consumption-tax block. A CHANGE to this
   * block's level schedules a one-year (6-turn), non-repeating inflation/
   * confidence impulse via the fiscal ledger — not a second permanent
   * `*TaxImpulse` level — so a VAT move produces a temporary price-level
   * effect (matching how a real VAT change drops out of the y/y inflation
   * base after a year) rather than an inflation shock re-added every turn
   * the new rate stays in place.
   */
  temporaryInflationChannel?: boolean
}

/** The player's SELECTED tier id per block for the budget cycle being drafted. */
export type FinanceSelections<Id extends string> = Record<Id, string>

/** The PERSISTENT tier id per block, carried across every budget cycle (M6's analogue of M5's absolute `BudgetLevels`, generalized to store a tier id rather than a bare number since a tier can now touch several engine fields at once). */
export type FinanceLevels<Id extends string> = Record<Id, string>

export interface ServiceIndices {
  health: number
  education: number
  security: number
  administration: number
}

/** Every index starts at 100 — "an index, not a score" (M6 §45), a plausible 5-year range is roughly 85-115. */
export const NEUTRAL_SERVICE_INDICES: ServiceIndices = { health: 100, education: 100, security: 100, administration: 100 }

export type FiscalLedgerCategory = 'SPENDING' | 'REVENUE'
export type FiscalLedgerOriginType = 'BUDGET' | 'REFORM' | 'EVENT' | 'CONCESSION'

/**
 * M6 §40-41: a lightweight EXPLAINABILITY layer over the policy inputs that
 * actually drive the engine — never a second accounting engine. Every
 * entry is appended at the exact moment its `policyEffect` is folded into
 * `implementedReformPolicies`/`budgetLevels` (see `gameReducer.ts`), so the
 * ledger can never show a fiscal effect that isn't ALSO genuinely active in
 * the merged policy the engine receives — see `fiscalLedger.ts`'s
 * reconciliation helper and its test for the mechanical proof.
 */
export interface FiscalLedgerEntry {
  id: string
  sourceId: string
  label: string
  /** Md€/year, signed so POSITIVE always means "worse for the fiscal balance" (a spending rise or a revenue cut) — the same convention `parliament/concessions.ts`'s `fiscalDeltaPerYear` already uses. */
  annualAmount: number
  startTurn: number
  /** `null` = still active (permanent, or a temporary measure not yet expired). */
  endTurn: number | null
  category: FiscalLedgerCategory
  temporary: boolean
  originType: FiscalLedgerOriginType
  policyEffect: Partial<EconomicPolicyInput>
}
