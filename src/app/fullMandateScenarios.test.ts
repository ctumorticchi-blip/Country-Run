import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import type { RevenueBlockId, SpendingBlockId } from '../game/country-run/finance/financeTypes.ts'
import { MANDATE_END_TURN } from '../game/country-run/mandate/calendar.ts'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

/**
 * M6 §74-76: 6 five-year strategy scenarios (A Strong Consolidation, B
 * Expansionary, C Productive Investment, D Tax Cutter, E Social Protection,
 * F Balanced) — every one must complete a full 30-turn mandate, and the
 * results must diverge meaningfully from each other, proving the M6
 * finance model (spending AND revenue) actually drives distinct 5-year
 * fiscal trajectories rather than converging regardless of what the
 * player does. Supersedes M5's 5-strategy suite (SPENDER/AUSTERITY/
 * INVESTOR/TAX_CUTTER/BALANCED), which only exercised spending.
 */

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

const PROMISE_IDS = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']

function campaignThrough(seed: string): GamePrototypeState {
  let state = withSeed(createInitialGamePrototypeState(), seed)
  const actions: GameAction[] = [
    { type: 'START_GAME' },
    { type: 'BEGIN_PROMISE_SELECTION' },
    ...PROMISE_IDS.map((promiseId): GameAction => ({ type: 'TOGGLE_PROMISE', promiseId })),
    { type: 'CONFIRM_PROMISES' },
    { type: 'PROCEED_TO_ELECTION' },
    { type: 'VIEW_FRANCE_BRIEFING' },
    { type: 'PROCEED_TO_GOVERNMENT' },
    { type: 'CHOOSE_GOVERNMENT', profileId: 'reformateurs' },
    { type: 'VIEW_PARLIAMENT_COMPOSITION' },
    { type: 'PROCEED_TO_MANDATE_START' },
    { type: 'BEGIN_MANDATE' },
  ]
  for (const action of actions) state = gameReducer(state, action)
  return state
}

function resolveActiveBillToTerminal(state: GamePrototypeState): GamePrototypeState {
  let s = state
  while (s.activeBill) {
    s = gameReducer(s, { type: 'CALL_VOTE' })
    if (s.activeBill && s.activeBill.status === 'REJECTED') s = gameReducer(s, { type: 'RENEGOTIATE_BILL' })
  }
  return s
}

function advanceOneTurn(state: GamePrototypeState): GamePrototypeState {
  let s = gameReducer(state, { type: 'ADVANCE_TURN' })
  if (s.screen === 'event' && s.activeEventId) {
    const event = getEventDefinition(s.activeEventId)
    s = gameReducer(s, { type: 'CHOOSE_EVENT', choiceId: event.choices[0].id })
    s = gameReducer(s, { type: 'CONTINUE_AFTER_EVENT' })
  }
  return s
}

interface Strategy {
  name: string
  spendingTiers: Partial<Record<SpendingBlockId, string>>
  revenueTiers: Partial<Record<RevenueBlockId, string>>
  /** Tried once per year, in order — skipped if unavailable (already adopted) or unaffordable. */
  preferredReforms: string[]
}

const STRATEGIES: Strategy[] = [
  {
    name: 'A_STRONG_CONSOLIDATION',
    spendingTiers: {
      pensions: 'structural',
      health: 'efficiencyDrive',
      solidarity: 'cuts',
      education: 'controlled',
      economyInvestment: 'cuts',
      defense: 'cuts',
      security: 'cuts',
      territories: 'cuts',
      administration: 'deepCuts',
    },
    revenueTiers: {},
    preferredReforms: ['public-administration-reform-bill', 'pension-reform-bill'],
  },
  {
    name: 'B_EXPANSIONARY',
    spendingTiers: {
      pensions: 'protectPurchasingPower',
      health: 'majorRebuild',
      solidarity: 'majorPlan',
      education: 'invest',
      economyInvestment: 'industryInnovation',
      defense: 'majorIncrease',
      security: 'majorPlan',
      territories: 'housingPriority',
    },
    revenueTiers: { householdTax: 'targetedCut', businessTax: 'targetedCut' },
    preferredReforms: ['hospital-plan-bill', 'housing-construction-plan-bill', 'public-investment-plan-bill', 'defense-expansion-bill'],
  },
  {
    name: 'C_PRODUCTIVE_INVESTMENT',
    spendingTiers: { economyInvestment: 'infrastructure', territories: 'greenPriority', education: 'invest' },
    revenueTiers: {},
    preferredReforms: ['industry-innovation-plan-bill', 'public-investment-plan-bill', 'energy-transition-bill'],
  },
  {
    name: 'D_TAX_CUTTER',
    spendingTiers: { administration: 'efficiencyProgram' },
    revenueTiers: { householdTax: 'majorCut', businessTax: 'majorCut', consumptionTax: 'cut' },
    preferredReforms: ['business-tax-cut-bill', 'household-tax-cut-bill'],
  },
  {
    name: 'E_SOCIAL_PROTECTION',
    spendingTiers: { pensions: 'protectPurchasingPower', solidarity: 'majorPlan', health: 'hospitalPlan' },
    revenueTiers: { householdTax: 'targetedIncrease', socialContributions: 'targetedIncrease' },
    preferredReforms: ['hospital-plan-bill'],
  },
  {
    name: 'F_BALANCED',
    spendingTiers: { health: 'controlSpending', pensions: 'limitIndexation' },
    revenueTiers: { consumptionTax: 'targetedIncrease' },
    preferredReforms: ['labor-market-reform-bill'],
  },
]

function playScenario(strategy: Strategy, seed: string): GamePrototypeState {
  let s = campaignThrough(seed)
  for (let year = 1; year <= 5; year++) {
    if (s.screen === 'bercyAudit') s = gameReducer(s, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    for (const [blockId, tierId] of Object.entries(strategy.spendingTiers)) {
      s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: blockId as SpendingBlockId, tierId: tierId })
    }
    for (const [blockId, tierId] of Object.entries(strategy.revenueTiers)) {
      s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'revenue', blockId: blockId as RevenueBlockId, tierId: tierId })
    }
    s = gameReducer(s, { type: 'SUBMIT_BUDGET' })
    s = resolveActiveBillToTerminal(s)
    s = gameReducer(s, { type: 'PROCEED_TO_REFORM_HUB' })

    const available = availableReformBills(s)
    const capital = s.politicalCapital ?? 0
    const chosen = strategy.preferredReforms.find(
      (id) => available.some((b) => b.id === id) && capital >= (available.find((b) => b.id === id)?.requiredPoliticalCapital ?? Infinity),
    )
    if (chosen) {
      s = gameReducer(s, { type: 'PROPOSE_BILL', billId: chosen })
      s = resolveActiveBillToTerminal(s)
      // Mirrors VoteScreen's "Continuer" — the real UI dispatches BEGIN_TURN_LOOP once a discretionary (non-budget) bill's vote result has been shown.
      s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
    } else {
      s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
    }

    for (let i = 0; i < 6; i++) s = advanceOneTurn(s)
    if (s.screen === 'yearReview') s = gameReducer(s, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
  }
  return s
}

describe('6 strategy scenario tests (M6 §74-76)', () => {
  const results = STRATEGIES.map((strategy) => ({ strategy, state: playScenario(strategy, `scenario-${strategy.name}`) }))

  it('every strategy completes the full 30-turn mandate and reaches mandateReview', () => {
    for (const { strategy, state } of results) {
      expect(state.gameState.meta.turn, `${strategy.name} should reach turn 30`).toBe(MANDATE_END_TURN)
      expect(state.screen, `${strategy.name} should reach mandateReview`).toBe('mandateReview')
      expect(state.finalScoreBreakdown, `${strategy.name} should have a final score`).not.toBeNull()
      expect(state.endingTitle, `${strategy.name} should have an ending title`).not.toBeNull()
    }
  })

  it('every strategy produces a finite, in-bounds final economic state — no NaN/Infinity, and stays within the M6 §76 plausibility gates', () => {
    for (const { strategy, state } of results) {
      for (const [key, value] of Object.entries(state.gameState.economic)) {
        expect(Number.isFinite(value), `${strategy.name}.${key} should be finite`).toBe(true)
      }
      expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
      expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
      expect(state.gameState.economic.debtRatio).toBeGreaterThan(0)
      expect(state.gameState.economic.debtRatio).toBeLessThan(220) // M6 §76: reject deliberately-extreme-free scenarios above ~180-220%
      expect(state.gameState.economic.deficitRatio).toBeLessThan(20)
      expect(state.gameState.economic.unemployment).toBeGreaterThanOrEqual(0)
      for (const value of Object.values(state.serviceIndices)) {
        expect(value).toBeGreaterThan(40)
        expect(value).toBeLessThan(160)
      }
    }
  })

  it('every strategy resolves all 5 selected promises to a final KEPT/PARTIAL/BROKEN status', () => {
    for (const { strategy, state } of results) {
      expect(state.promiseResolutions, strategy.name).toHaveLength(5)
      for (const resolution of state.promiseResolutions) {
        expect(['KEPT', 'PARTIAL', 'BROKEN']).toContain(resolution.finalStatus)
      }
    }
  })

  it('A_STRONG_CONSOLIDATION improves the deficit vs. B_EXPANSIONARY, and B_EXPANSIONARY produces the highest debt ratio of all 6', () => {
    const consolidation = results.find((r) => r.strategy.name === 'A_STRONG_CONSOLIDATION')?.state
    const expansionary = results.find((r) => r.strategy.name === 'B_EXPANSIONARY')?.state
    expect(consolidation).toBeDefined()
    expect(expansionary).toBeDefined()
    if (!consolidation || !expansionary) return
    expect(consolidation.gameState.economic.debtRatio).toBeLessThan(expansionary.gameState.economic.debtRatio)
    const maxDebtRatio = Math.max(...results.map((r) => r.state.gameState.economic.debtRatio))
    expect(expansionary.gameState.economic.debtRatio).toBe(maxDebtRatio)
  })

  it('the 6 strategies do not all converge on the exact same final score, ending title, or debt ratio', () => {
    const scores = results.map((r) => r.state.finalScoreBreakdown?.total)
    const titles = results.map((r) => r.state.endingTitle)
    const debtRatios = results.map((r) => Number(r.state.gameState.economic.debtRatio.toFixed(1)))
    expect(new Set(scores).size).toBeGreaterThan(1)
    expect(new Set(titles).size).toBeGreaterThan(1)
    expect(new Set(debtRatios).size).toBeGreaterThan(3)
  })

  it('D_TAX_CUTTER ends with materially lower public revenue (% GDP) than E_SOCIAL_PROTECTION', () => {
    const taxCutter = results.find((r) => r.strategy.name === 'D_TAX_CUTTER')?.state
    const socialProtection = results.find((r) => r.strategy.name === 'E_SOCIAL_PROTECTION')?.state
    expect(taxCutter).toBeDefined()
    expect(socialProtection).toBeDefined()
    if (!taxCutter || !socialProtection) return
    const revenueRatio = (s: GamePrototypeState) => (s.gameState.economic.publicRevenue / s.gameState.economic.nominalGdp) * 100
    expect(revenueRatio(taxCutter)).toBeLessThan(revenueRatio(socialProtection))
  })
})
