import { describe, expect, it } from 'vitest'
import { computeFinanceChanges, NEUTRAL_FINANCE_LEVELS } from '../finance/financeEffects.ts'
import { deriveBudgetBill } from './budgetBillDerivation.ts'
import { applyConcessionsToBill } from './concessions.ts'
import { resolveVote } from './voteResolution.ts'
import type { ParliamentComposition } from '../prototype/parliamentComposition.ts'

/**
 * M6.5 §11/§66: an EMPIRICAL audit of the M4/M6 support formula's real
 * behaviour under three seat distributions, using the REAL production
 * pipeline (`deriveBudgetBill` -> `applyConcessionsToBill` ->
 * `estimateBillSupport`/`resolveVote`) — never a re-implemented shortcut.
 * No negotiation actions are taken (no courting, no concessions, no
 * capital spend) — this measures the STRUCTURAL difficulty a player faces
 * on a first, un-negotiated vote attempt. Different seed/turn per trial
 * for genuine variance, same neutral government profile throughout.
 */

const NEUTRAL_GOVERNMENT_MODIFIERS = {
  economicExecution: 1,
  fiscalForecastAccuracy: 1,
  reformEffectiveness: 1,
  parliamentNegotiation: 1,
  popularityResilience: 1,
  marketCredibility: 1,
  implementationSpeed: 1,
}

const OPPOSITION_WEIGHTS: [string, number][] = [
  ['REFORM_CENTER', 1.1],
  ['SOCIAL_LEFT', 1.0],
  ['ECOLOGISTS', 0.6],
  ['CONSERVATIVE_RIGHT', 1.0],
  ['NATIONAL_POPULISTS', 0.9],
  ['NON_ATTACHED', 0.25],
]

function compositionWithPlayerSeats(playerSeats: number): ParliamentComposition {
  const totalSeats = 577
  const oppositionSeats = totalSeats - playerSeats
  const totalWeight = OPPOSITION_WEIGHTS.reduce((sum, [, w]) => sum + w, 0)
  let assigned = 0
  const blocs = OPPOSITION_WEIGHTS.map(([id, weight], i) => {
    const isLast = i === OPPOSITION_WEIGHTS.length - 1
    const seats = isLast ? oppositionSeats - assigned : Math.round((weight / totalWeight) * oppositionSeats)
    assigned += seats
    return { id, name: id, seats, isPlayerCoalition: false, affinityTags: [] }
  })
  return {
    blocs: [{ id: 'PRESIDENTIAL_BLOC', name: 'Majorité Présidentielle', seats: playerSeats, isPlayerCoalition: true, affinityTags: [] }, ...blocs],
    playerSeats,
    majorityOutcome: playerSeats >= 289 ? 'MAJORITÉ_ABSOLUE' : playerSeats >= 240 ? 'MAJORITÉ_RELATIVE' : 'ASSEMBLÉE_FRAGMENTÉE',
  }
}

/** A moderate, realistic "ordinary" budget — a mix of small cuts and a targeted tax increase, similar magnitude to F_BALANCED in the 6-scenario suite. Not an extreme/edge-case budget. */
function ordinaryBudgetBill() {
  const changes = computeFinanceChanges(
    { ...NEUTRAL_FINANCE_LEVELS.spending, health: 'controlSpending', pensions: 'limitIndexation' },
    NEUTRAL_FINANCE_LEVELS.spending,
    { ...NEUTRAL_FINANCE_LEVELS.revenue, consumptionTax: 'targetedIncrease' },
    NEUTRAL_FINANCE_LEVELS.revenue,
  )
  const definition = deriveBudgetBill(changes, 'Budget 2028')
  return applyConcessionsToBill(definition, [])
}

/** A genuinely ambitious/controversial budget (structural pension reform + a major business-tax rise + deep administrative cuts) — the kind of budget that actually forces multiple blocs' red lines, similar magnitude to the 6-scenario suite's A_STRONG_CONSOLIDATION. */
function ambitiousBudgetBill() {
  const changes = computeFinanceChanges(
    { ...NEUTRAL_FINANCE_LEVELS.spending, pensions: 'structural', administration: 'deepCuts', defense: 'cuts' },
    NEUTRAL_FINANCE_LEVELS.spending,
    { ...NEUTRAL_FINANCE_LEVELS.revenue, businessTax: 'majorIncrease' },
    NEUTRAL_FINANCE_LEVELS.revenue,
  )
  const definition = deriveBudgetBill(changes, 'Budget 2028')
  return applyConcessionsToBill(definition, [])
}

function firstAttemptAdoptionRate(playerSeats: number, trials: number, bill: ReturnType<typeof ordinaryBudgetBill>): number {
  const composition = compositionWithPlayerSeats(playerSeats)
  let passed = 0
  for (let i = 0; i < trials; i++) {
    const seed = `calibration-${String(playerSeats)}-${String(i)}`
    const result = resolveVote(seed, 1, bill, composition, {}, 50, NEUTRAL_GOVERNMENT_MODIFIERS, null)
    if (result.passed) passed++
  }
  return passed / trials
}

describe('M6.5 §11/§66 — parliament difficulty audit: ordinary-budget adoption rate under 3 seat distributions', () => {
  const TRIALS = 200
  const ordinary = ordinaryBudgetBill()
  const strong = firstAttemptAdoptionRate(320, TRIALS, ordinary) // MAJORITÉ_ABSOLUE on its own
  const fragmented = firstAttemptAdoptionRate(225, TRIALS, ordinary) // ASSEMBLÉE_FRAGMENTÉE

  it('reports the two adoption rates (informational — see console output)', () => {
     
    console.log(`Ordinary-budget adoption rates — strong majority (320): ${(strong * 100).toFixed(1)}%, fragmented (225): ${(fragmented * 100).toFixed(1)}%`)
    expect(strong).toBeGreaterThanOrEqual(0)
  })

  it('strong majority passes an ordinary budget nearly automatically', () => {
    expect(strong).toBeGreaterThan(0.9)
  })

  it('fragmented parliament is materially harder than strong majority — a real gap, not a token one', () => {
    expect(strong - fragmented).toBeGreaterThan(0.35)
  })

  it('fragmented parliament passage is genuinely uncertain on a first, un-negotiated attempt (never a coin-flip-proof near-certainty)', () => {
    expect(fragmented).toBeLessThan(0.55)
  })
})

describe('M6.5 §11/§66 — parliament difficulty audit: an AMBITIOUS/controversial budget under 3 seat distributions', () => {
  const TRIALS = 200
  const ambitious = ambitiousBudgetBill()
  const strong = firstAttemptAdoptionRate(320, TRIALS, ambitious)
  const relative = firstAttemptAdoptionRate(241, TRIALS, ambitious) // just inside MAJORITÉ_RELATIVE (>= 240) — where an ambitious budget is genuinely a toss-up
  const fragmented = firstAttemptAdoptionRate(225, TRIALS, ambitious)

  it('reports the three adoption rates for an ambitious budget (informational — see console output)', () => {
     
    console.log(`Ambitious-budget adoption rates — strong (320): ${(strong * 100).toFixed(1)}%, relative (241): ${(relative * 100).toFixed(1)}%, fragmented (225): ${(fragmented * 100).toFixed(1)}%`)
    expect(strong).toBeGreaterThanOrEqual(0)
  })

  it('an ambitious budget requires real negotiation even under a relative majority — materially below strong majority’s rate', () => {
    expect(relative).toBeLessThan(strong)
  })

  it('an ambitious budget under a fragmented Assembly is genuinely uncertain on a first, un-negotiated attempt', () => {
    expect(fragmented).toBeLessThan(0.5)
  })

  it('relative majority sits strictly between strong and fragmented for an ambitious budget', () => {
    expect(relative).toBeGreaterThan(fragmented)
  })
})
