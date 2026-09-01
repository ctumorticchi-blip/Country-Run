import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { EconomicState, Turn } from '../../../engine/state/gameState.ts'
import type { ScheduledImplementation } from '../parliament/implementationSchedule.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'
import type { PromiseCategory } from '../promises/promiseTypes.ts'
import type { FinanceLevels, RevenueBlockId, SpendingBlockId } from './financeTypes.ts'
import { getRevenueTier, NEUTRAL_REVENUE_LEVELS, OTHER_REVENUE_BASELINE, REVENUE_BLOCK_ORDER, REVENUE_BLOCKS } from './revenueBlocks.ts'
import { getSpendingTier, NEUTRAL_SPENDING_LEVELS, SPENDING_BLOCK_ORDER, SPENDING_BLOCKS } from './spendingBlocks.ts'

/**
 * M6 §7-8, §18: the mandate's second scheduling engine. Every M5 reform
 * bill schedules ONE `ScheduledImplementation` at bill adoption; M6 finance
 * blocks reuse the exact same queue (`parliament/implementationSchedule.ts`)
 * but ONE ENTRY PER CHANGED BLOCK, each with that block's OWN
 * `implementationTiming` — a Budget Bill vote is a single Parliament event,
 * but the pension "structural reform" tier can legitimately phase in over
 * more turns than a "maintain health" tier that changes nothing. This
 * REPLACES M5's `budgetLevelsToPolicyInput`-as-absolute-level pattern:
 * instead of re-deriving a full absolute policy input from `financeLevels`
 * every turn (M5's `enactedBudgetPolicy` component), M6 finance blocks feed
 * `implementedReformPolicies` the same way a reform bill does — a per-change
 * DELTA, added exactly once when it matures, so re-selecting an unchanged
 * tier next year contributes nothing further (M6 §1's non-negotiable
 * rule, exercised uniformly for spending, taxes, AND pensions).
 */

const PRIMARY_SPENDING_BASELINE = SPENDING_BLOCK_ORDER.reduce((sum, id) => sum + SPENDING_BLOCKS[id].baseline, 0)
/** Documented calibration placeholder — the France-2027 starting `interestCost` (see `data/initialState.ts`), used only as a DISPLAY reference for the M6 §6 reconciliation baseline, never fed to the engine (the real interest cost is always `economic.interestCost`, computed fresh every turn). */
export const DEBT_INTEREST_BASELINE = 101
export const SPENDING_BASELINE_TOTAL = PRIMARY_SPENDING_BASELINE + DEBT_INTEREST_BASELINE

export const REVENUE_BASELINE_TOTAL = REVENUE_BLOCK_ORDER.reduce((sum, id) => sum + REVENUE_BLOCKS[id].baseline, 0) + OTHER_REVENUE_BASELINE

export const NEUTRAL_FINANCE_LEVELS: { spending: FinanceLevels<SpendingBlockId>; revenue: FinanceLevels<RevenueBlockId> } = {
  spending: { ...NEUTRAL_SPENDING_LEVELS },
  revenue: { ...NEUTRAL_REVENUE_LEVELS },
}

export function diffPolicyEffect(next: Partial<EconomicPolicyInput>, prev: Partial<EconomicPolicyInput>): Partial<EconomicPolicyInput> {
  const delta: Partial<EconomicPolicyInput> = {}
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)] as (keyof EconomicPolicyInput)[])
  for (const key of keys) {
    const d = (next[key] ?? 0) - (prev[key] ?? 0)
    if (d !== 0) delta[key] = d
  }
  return delta
}

export interface FinanceBlockChange {
  kind: 'spending' | 'revenue'
  blockId: SpendingBlockId | RevenueBlockId
  blockLabel: string
  previousTierId: string
  newTierId: string
  newTierLabel: string
  /** The tier's own headline number this cycle (not a delta-of-deltas — the plain "what does the new tier cost/raise"). */
  annualFiscalDelta: number
  /** The CHANGE in annualFiscalDelta vs the previous tier — "what's actually being decided this cycle" (M6 §29-31). */
  fiscalChange: number
  /** Field-wise delta of `policyEffect`s — what actually gets scheduled. */
  effectDelta: Partial<EconomicPolicyInput>
  implementationTiming: number
  temporary: boolean
  durationTurns?: number
  riskDescription?: string
  promiseLinks?: string[]
}

/** Every block whose DRAFT tier differs from its currently-enacted tier — the empty array means "nothing to schedule" (a budget resubmitted unchanged). */
export function computeFinanceChanges(
  draftSpending: FinanceLevels<SpendingBlockId>,
  currentSpending: FinanceLevels<SpendingBlockId>,
  draftRevenue: FinanceLevels<RevenueBlockId>,
  currentRevenue: FinanceLevels<RevenueBlockId>,
): FinanceBlockChange[] {
  const changes: FinanceBlockChange[] = []

  for (const blockId of SPENDING_BLOCK_ORDER) {
    const previousTierId = currentSpending[blockId]
    const newTierId = draftSpending[blockId]
    if (previousTierId === newTierId) continue
    const previousTier = getSpendingTier(blockId, previousTierId)
    const newTier = getSpendingTier(blockId, newTierId)
    changes.push({
      kind: 'spending',
      blockId,
      blockLabel: SPENDING_BLOCKS[blockId].label,
      previousTierId,
      newTierId,
      newTierLabel: newTier.label,
      annualFiscalDelta: newTier.annualFiscalDelta,
      fiscalChange: newTier.annualFiscalDelta - previousTier.annualFiscalDelta,
      effectDelta: diffPolicyEffect(newTier.policyEffect, previousTier.policyEffect),
      implementationTiming: newTier.implementationTiming,
      temporary: newTier.temporaryOrPermanent === 'TEMPORARY',
      riskDescription: newTier.riskDescription,
      promiseLinks: newTier.promiseLinks,
    })
  }

  for (const blockId of REVENUE_BLOCK_ORDER) {
    const previousTierId = currentRevenue[blockId]
    const newTierId = draftRevenue[blockId]
    if (previousTierId === newTierId) continue
    const previousTier = getRevenueTier(blockId, previousTierId)
    const newTier = getRevenueTier(blockId, newTierId)
    const block = REVENUE_BLOCKS[blockId]
    const change: FinanceBlockChange = {
      kind: 'revenue',
      blockId,
      blockLabel: block.label,
      previousTierId,
      newTierId,
      newTierLabel: newTier.label,
      annualFiscalDelta: -newTier.annualFiscalDelta, // revenue UP is fiscally GOOD (reduces the deficit) — flip sign to match the shared "positive = worse for the balance" ledger convention
      fiscalChange: -(newTier.annualFiscalDelta - previousTier.annualFiscalDelta),
      effectDelta: diffPolicyEffect(newTier.policyEffect, previousTier.policyEffect),
      implementationTiming: newTier.implementationTiming,
      temporary: false,
      riskDescription: newTier.riskDescription,
      promiseLinks: newTier.promiseLinks,
    }
    changes.push(change)
    if (block.temporaryInflationChannel) {
      // M6 §23: consumption-tax moves also fire a ONE-YEAR-ONLY inflation/confidence impulse —
      // never a second permanent tax-impulse level (see revenueBlocks.ts's module doc).
      const impulseDelta = newTier.annualFiscalDelta - previousTier.annualFiscalDelta
      if (impulseDelta !== 0) {
        changes.push({
          kind: 'revenue',
          blockId,
          blockLabel: `${block.label} — effet prix transitoire`,
          previousTierId,
          newTierId,
          newTierLabel: newTier.label,
          annualFiscalDelta: 0,
          fiscalChange: 0,
          effectDelta: { householdTaxImpulse: impulseDelta },
          implementationTiming: newTier.implementationTiming,
          temporary: true,
          durationTurns: 6,
        })
      }
    }
  }

  return changes
}

/** Converts a set of finance changes into the mandate's `ScheduledImplementation` queue entries — reuses the exact plumbing a reform bill schedules through (`beginMandateTurn` folds these into `implementedReformPolicies` exactly once, at maturity). */
export function scheduleFinanceChanges(changes: readonly FinanceBlockChange[], adoptedTurn: Turn, nextYearStartTurn: Turn, budgetLabel: string): ScheduledImplementation[] {
  return changes
    .filter((c) => Object.keys(c.effectDelta).length > 0)
    .map((c) => ({
      sourceId: `budget:${c.blockId}:${budgetLabel}`,
      label: `${budgetLabel} — ${c.blockLabel} — ${c.newTierLabel}`,
      adoptedTurn,
      scheduledTurn: nextYearStartTurn + c.implementationTiming,
      policyEffect: c.effectDelta,
    }))
}

/** Sums every change's `effectDelta` into one `Partial<EconomicPolicyInput>` — used ONLY as the Budget Bill's display/concession-base `economicPolicyEffect` (`parliament/budgetBillDerivation.ts`); the actual per-block scheduling with each block's own `implementationTiming` happens separately via `scheduleFinanceChanges`. */
export function sumFinanceChangeEffects(changes: readonly FinanceBlockChange[]): Partial<EconomicPolicyInput> {
  const merged: Partial<EconomicPolicyInput> = {}
  for (const c of changes) {
    for (const key of Object.keys(c.effectDelta) as (keyof EconomicPolicyInput)[]) {
      merged[key] = (merged[key] ?? 0) + (c.effectDelta[key] ?? 0)
    }
  }
  return merged
}

export interface BudgetEquation {
  revenueBn: number
  spendingBn: number
  balanceBn: number
  deficitBn: number
  deficitRatio: number
  revenuePctGdp: number
  spendingPctGdp: number
}

/** M6 §28: the actual budget equation, read straight from the authoritative simulated `EconomicState` — never re-derived from the block breakdown (which is a display decomposition, not a second source of truth). */
export function computeBudgetEquation(economic: EconomicState): BudgetEquation {
  const balanceBn = economic.publicRevenue - economic.publicSpending
  return {
    revenueBn: economic.publicRevenue,
    spendingBn: economic.publicSpending,
    balanceBn,
    deficitBn: Math.max(0, -balanceBn),
    deficitRatio: economic.deficitRatio,
    revenuePctGdp: (economic.publicRevenue / economic.nominalGdp) * 100,
    spendingPctGdp: (economic.publicSpending / economic.nominalGdp) * 100,
  }
}

/** A block's DISPLAY-only projected annual amount — reference baseline plus the currently-enacted tier's headline delta (M6 §30: base envelope vs presidential policy adjustment). Never the source of truth for the engine. */
export function projectedBlockAmount(baseline: number, tierAnnualFiscalDelta: number): number {
  return baseline + tierAnnualFiscalDelta
}

/** The non-controllable "other public revenue" bucket, shown as a residual so the 5 revenue blocks always sum to the REAL simulated `publicRevenue` (M6 §19). */
export function otherRevenueEstimate(economic: EconomicState, revenueLevels: FinanceLevels<RevenueBlockId>): number {
  const controlledTotal = REVENUE_BLOCK_ORDER.reduce((sum, id) => {
    const tier = getRevenueTier(id, revenueLevels[id])
    return sum + projectedBlockAmount(REVENUE_BLOCKS[id].baseline, tier.annualFiscalDelta)
  }, 0)
  return economic.publicRevenue - controlledTotal
}

export function debtInterestShareOfSpending(economic: EconomicState): number {
  if (economic.publicSpending <= 0) return 0
  return (economic.interestCost / economic.publicSpending) * 100
}

const SPENDING_BLOCK_PROMISE_CATEGORY: Record<SpendingBlockId, PromiseCategory> = {
  pensions: 'pensions',
  health: 'health',
  solidarity: 'publicServices',
  education: 'education',
  economyInvestment: 'investment',
  defense: 'security',
  security: 'publicServices',
  territories: 'investment',
  administration: 'publicServices',
}

/**
 * `PolicyHistoryEntry` records for an adopted budget's changed blocks — the
 * ONLY source `promises/promiseEvaluators.ts`'s M6 evaluators (tax cuts,
 * `no-tax-increase`, `protect-pensions`) read. Only built on ADOPTION (never
 * at proposal/submission) so a REJECTED budget line item can never falsely
 * satisfy or break a promise — a fix over M5's `SUBMIT_BUDGET`-time
 * recording, which could record a promise-relevant entry for a budget
 * Parliament went on to reject (see docs/ECONOMY_BUDGET_M6.md).
 */
export function policyHistoryEntriesFromFinanceChanges(changes: readonly FinanceBlockChange[], turn: Turn, budgetLabel: string): PolicyHistoryEntry[] {
  const entries: PolicyHistoryEntry[] = []
  for (const change of changes) {
    if (change.kind === 'spending') {
      entries.push({
        turn,
        sourceId: `budget:${change.blockId}:${budgetLabel}`,
        label: `${budgetLabel} — ${change.blockLabel} — ${change.newTierLabel}`,
        category: SPENDING_BLOCK_PROMISE_CATEGORY[change.blockId as SpendingBlockId],
        amount: change.fiscalChange,
      })
    } else if (change.effectDelta.taxChanges !== undefined) {
      // Skip the consumption-tax "effet prix transitoire" duplicate change (it never sets `taxChanges`).
      entries.push({
        turn,
        sourceId: `budget:${change.blockId}:${budgetLabel}`,
        label: `${budgetLabel} — ${change.blockLabel} — ${change.newTierLabel}`,
        category: 'taxation',
        amount: -change.fiscalChange, // un-flip the ledger sign back to "positive = a tax INCREASE"
      })
    }
  }
  return entries
}
