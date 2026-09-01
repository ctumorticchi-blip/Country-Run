import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { Turn } from '../../../engine/state/gameState.ts'
import type { FinanceBlockChange } from './financeEffects.ts'
import type { FiscalLedgerEntry, FiscalLedgerOriginType } from './financeTypes.ts'

/**
 * M6 §40-41: a lightweight EXPLAINABILITY layer over the policy inputs that
 * actually drive the engine — every ledger entry is appended at the exact
 * moment its `policyEffect` is folded into `implementedReformPolicies`
 * (budget blocks, reform bills, event choices, concessions all go through
 * this), never maintained as an independent parallel total. That is what
 * makes the reconciliation check in `financeEffects.test.ts` mechanical
 * rather than aspirational: `sumActiveLedgerPolicyEffect` walks the SAME
 * entries `gameReducer.ts` used to build `implementedReformPolicies`.
 */

function negatePolicyEffect(effect: Partial<EconomicPolicyInput>): Partial<EconomicPolicyInput> {
  const negated: Partial<EconomicPolicyInput> = {}
  for (const key of Object.keys(effect) as (keyof EconomicPolicyInput)[]) negated[key] = -(effect[key] ?? 0)
  return negated
}

/**
 * Ledger entry ids are DETERMINISTIC — derived only from the entry's own
 * `sourceId`/`startTurn`/position, never a module-level mutable counter.
 * A counter would depend on how many entries happened to be built earlier
 * in THIS process's lifetime, breaking the determinism a save/reload or a
 * same-seed replay depends on (M5 §57's explicit save/reload-vs-continuous
 * RNG-safety test would otherwise see a different id in each run).
 */
function ledgerId(sourceId: string, startTurn: Turn, index: number): string {
  return `${sourceId}:${String(startTurn)}:${String(index)}`
}

/** Builds the `FiscalLedgerEntry` records for one adopted budget's changed blocks — one entry per scheduled effect, marked temporary with its expiry turn when applicable (M6 §39). */
export function ledgerEntriesFromFinanceChanges(
  changes: readonly FinanceBlockChange[],
  nextYearStartTurn: Turn,
  budgetLabel: string,
): FiscalLedgerEntry[] {
  return changes
    .filter((c) => Object.keys(c.effectDelta).length > 0)
    .map((c, index) => {
      const startTurn = nextYearStartTurn + c.implementationTiming
      return {
        id: ledgerId(`budget:${c.blockId}:${budgetLabel}`, startTurn, index),
        sourceId: `budget:${c.blockId}:${budgetLabel}`,
        label: `${budgetLabel} — ${c.blockLabel} — ${c.newTierLabel}`,
        annualAmount: c.fiscalChange,
        startTurn,
        endTurn: c.temporary && c.durationTurns ? startTurn + c.durationTurns : null,
        category: c.kind === 'spending' ? 'SPENDING' : 'REVENUE',
        temporary: c.temporary,
        originType: 'BUDGET',
        policyEffect: c.effectDelta,
      }
    })
}

/** One ledger entry for a REFORM bill, EVENT choice, or CONCESSION — used by `gameReducer.ts` alongside its existing `scheduleImplementation`/`implementedReformPolicies` calls, never as a replacement for them. */
export function ledgerEntryFromSource(params: {
  sourceId: string
  label: string
  annualAmount: number
  startTurn: Turn
  endTurn?: Turn | null
  category: 'SPENDING' | 'REVENUE'
  originType: FiscalLedgerOriginType
  policyEffect: Partial<EconomicPolicyInput>
}): FiscalLedgerEntry {
  return {
    id: ledgerId(params.sourceId, params.startTurn, 0),
    sourceId: params.sourceId,
    label: params.label,
    annualAmount: params.annualAmount,
    startTurn: params.startTurn,
    endTurn: params.endTurn ?? null,
    category: params.category,
    temporary: params.endTurn != null,
    originType: params.originType,
    policyEffect: params.policyEffect,
  }
}

/** Ledger entries whose `endTurn` is reached exactly this turn — reversed exactly once by the caller (`gameReducer.ts`'s `advanceTurnAction`). */
export function dueLedgerExpirations(ledger: readonly FiscalLedgerEntry[], currentTurn: Turn): FiscalLedgerEntry[] {
  return ledger.filter((entry) => entry.temporary && entry.endTurn === currentTurn)
}

/** The combined policy effect to fold in once, undoing every entry expiring this turn (M6 §39: "when they expire, policy level returns automatically exactly once"). */
export function expirationPolicyEffect(expiring: readonly FiscalLedgerEntry[]): Partial<EconomicPolicyInput> {
  const merged: Partial<EconomicPolicyInput> = {}
  for (const entry of expiring) {
    const negated = negatePolicyEffect(entry.policyEffect)
    for (const key of Object.keys(negated) as (keyof EconomicPolicyInput)[]) merged[key] = (merged[key] ?? 0) + (negated[key] ?? 0)
  }
  return merged
}

/** Entries genuinely contributing to the engine right now: started, and not yet expired. */
export function activeLedgerEntries(ledger: readonly FiscalLedgerEntry[], currentTurn: Turn): FiscalLedgerEntry[] {
  return ledger.filter((entry) => entry.startTurn <= currentTurn && (entry.endTurn === null || entry.endTurn > currentTurn))
}

/** M6 §41's reconciliation check: sums every active entry's `policyEffect` field by field — this is the SAME shape as `implementedReformPolicies`, so a test can diff the two directly. */
export function sumActiveLedgerPolicyEffect(ledger: readonly FiscalLedgerEntry[], currentTurn: Turn): Partial<EconomicPolicyInput> {
  const merged: Partial<EconomicPolicyInput> = {}
  for (const entry of activeLedgerEntries(ledger, currentTurn)) {
    for (const key of Object.keys(entry.policyEffect) as (keyof EconomicPolicyInput)[]) {
      merged[key] = (merged[key] ?? 0) + (entry.policyEffect[key] ?? 0)
    }
  }
  return merged
}

/** Structural (ledger-driven) vs cyclical (growth/noise-driven) split for the revenue explanation UI (M6 §27). */
export function structuralRevenueChange(ledger: readonly FiscalLedgerEntry[], previousTurn: Turn, currentTurn: Turn): number {
  return ledger
    .filter((e) => e.category === 'REVENUE' && e.startTurn > previousTurn && e.startTurn <= currentTurn)
    .reduce((sum, e) => sum - e.annualAmount, 0) // ledger annualAmount is "positive = worse for balance", i.e. negative for a revenue RISE
}
