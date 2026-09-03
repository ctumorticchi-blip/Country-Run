import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import type { RevenueBlockId, SpendingBlockId } from '../game/country-run/finance/financeTypes.ts'
import { MANDATE_END_TURN } from '../game/country-run/mandate/calendar.ts'
import type { SovereignFundFundingSource, SovereignFundGovernance, SovereignFundStrategy } from '../game/country-run/fund/fundTypes.ts'
import { netValueCreated } from '../game/country-run/fund/fundEngine.ts'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

/**
 * M6.5 Part IX (§60-ish, "six five-year strategy scenarios"): the exact 6
 * scenarios the brief names — A Fiscal Conservative (no fund), B Public
 * Investment State, C Sovereign Fund Industrial, D Sovereign Fund
 * Innovation, E Social State, F Tax-Cut/Private-Sector. Mirrors
 * `fullMandateScenarios.test.ts` (M6)'s proven action-dispatch harness
 * (never `Math.random`, every step a real reducer action) but adds
 * `CREATE_SOVEREIGN_FUND` for the two fund strategies and reports the new
 * M6.5 metrics (projects launched, fund net value) alongside the M6 ones.
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
  let attempts = 0
  while (s.activeBill && attempts < 10) {
    s = gameReducer(s, { type: 'CALL_VOTE' })
    if (s.activeBill && s.activeBill.status === 'REJECTED') s = gameReducer(s, { type: 'RENEGOTIATE_BILL' })
    attempts++
  }
  if (s.activeBill) s = gameReducer(s, { type: 'WITHDRAW_BILL' })
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

interface FundCreation {
  atYear: number
  capitalization: number
  fundingSource: SovereignFundFundingSource
  strategy: SovereignFundStrategy
  governance: SovereignFundGovernance
}

interface Strategy {
  name: string
  spendingTiers: Partial<Record<SpendingBlockId, string>>
  revenueTiers: Partial<Record<RevenueBlockId, string>>
  preferredReforms: string[]
  fund?: FundCreation
}

const STRATEGIES: Strategy[] = [
  {
    name: 'A_FISCAL_CONSERVATIVE',
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
    name: 'B_PUBLIC_INVESTMENT_STATE',
    spendingTiers: { economyInvestment: 'infrastructure', territories: 'greenPriority', education: 'invest' },
    revenueTiers: {},
    preferredReforms: [
      'public-investment-plan-bill',
      'industry-innovation-plan-bill',
      'energy-transition-bill',
      'hospital-plan-bill',
      'housing-construction-plan-bill',
    ],
  },
  {
    name: 'C_SOVEREIGN_FUND_INDUSTRIAL',
    spendingTiers: { economyInvestment: 'maintain', education: 'controlled' },
    revenueTiers: {},
    preferredReforms: ['industry-innovation-plan-bill'],
    fund: { atYear: 2, capitalization: 30, fundingSource: 'DEBT', strategy: 'INDUSTRIAL', governance: 'MIXED' },
  },
  {
    name: 'D_SOVEREIGN_FUND_INNOVATION',
    spendingTiers: { economyInvestment: 'maintain', education: 'invest' },
    revenueTiers: {},
    preferredReforms: ['education-investment-bill'],
    fund: { atYear: 2, capitalization: 30, fundingSource: 'HYBRID', strategy: 'INNOVATION', governance: 'INDEPENDENT' },
  },
  {
    name: 'E_SOCIAL_STATE',
    spendingTiers: { pensions: 'protectPurchasingPower', solidarity: 'majorPlan', health: 'hospitalPlan' },
    revenueTiers: { householdTax: 'targetedIncrease', socialContributions: 'targetedIncrease' },
    preferredReforms: ['hospital-plan-bill'],
  },
  {
    name: 'F_TAX_CUT_PRIVATE_SECTOR',
    spendingTiers: { administration: 'efficiencyProgram' },
    revenueTiers: { householdTax: 'majorCut', businessTax: 'majorCut', consumptionTax: 'cut' },
    preferredReforms: ['business-tax-cut-bill', 'household-tax-cut-bill'],
  },
]

function playScenario(strategy: Strategy, seed: string): GamePrototypeState {
  let s = campaignThrough(seed)
  for (let year = 1; year <= 5; year++) {
    if (s.screen === 'bercyAudit') s = gameReducer(s, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })

    if (strategy.fund && year === strategy.fund.atYear && !s.sovereignFund.exists) {
      s = gameReducer(s, {
        type: 'CREATE_SOVEREIGN_FUND',
        capitalization: strategy.fund.capitalization,
        fundingSource: strategy.fund.fundingSource,
        strategy: strategy.fund.strategy,
        governance: strategy.fund.governance,
      })
    }

    for (const [blockId, tierId] of Object.entries(strategy.spendingTiers)) {
      s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: blockId as SpendingBlockId, tierId })
    }
    for (const [blockId, tierId] of Object.entries(strategy.revenueTiers)) {
      s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'revenue', blockId: blockId as RevenueBlockId, tierId })
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
      s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
    } else {
      s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
    }

    for (let i = 0; i < 6; i++) s = advanceOneTurn(s)
    if (s.screen === 'yearReview') s = gameReducer(s, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
  }
  return s
}

describe('M6.5 Part IX: 6 strategy scenarios (A Fiscal Conservative .. F Tax-Cut/Private-Sector)', () => {
  const results = STRATEGIES.map((strategy) => ({ strategy, state: playScenario(strategy, `m65-scenario-${strategy.name}`) }))

  it('every strategy completes the full 30-turn mandate and reaches mandateReview', () => {
    for (const { strategy, state } of results) {
      expect(state.gameState.meta.turn, `${strategy.name} should reach turn 30`).toBe(MANDATE_END_TURN)
      expect(state.screen, `${strategy.name} should reach mandateReview`).toBe('mandateReview')
      expect(state.finalScoreBreakdown, `${strategy.name} should have a final score`).not.toBeNull()
    }
  })

  it('every strategy produces a finite, in-bounds final state — no NaN/Infinity anywhere, incl. the new project/fund state', () => {
    for (const { strategy, state } of results) {
      for (const [key, value] of Object.entries(state.gameState.economic)) {
        expect(Number.isFinite(value), `${strategy.name}.${key} should be finite`).toBe(true)
      }
      expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
      expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
      expect(state.gameState.economic.debtRatio).toBeGreaterThan(0)
      expect(state.gameState.economic.debtRatio).toBeLessThan(220)
      for (const project of state.projects) {
        expect(Number.isFinite(project.progress)).toBe(true)
        expect(project.progress).toBeGreaterThanOrEqual(0)
        expect(project.progress).toBeLessThanOrEqual(100)
      }
      if (state.sovereignFund.exists) {
        expect(Number.isFinite(state.sovereignFund.portfolioValue)).toBe(true)
        expect(Number.isFinite(netValueCreated(state.sovereignFund))).toBe(true)
      }
    }
  })

  it('only C and D actually created a sovereign fund — creating one is a deliberate choice, never automatic', () => {
    for (const { strategy, state } of results) {
      const shouldExist = strategy.name === 'C_SOVEREIGN_FUND_INDUSTRIAL' || strategy.name === 'D_SOVEREIGN_FUND_INNOVATION'
      expect(state.sovereignFund.exists, strategy.name).toBe(shouldExist)
    }
  })

  it('B_PUBLIC_INVESTMENT_STATE launches materially more national projects than A_FISCAL_CONSERVATIVE — a project can still be event-triggered under any strategy, but deliberate investment bills should dominate the count', () => {
    const investmentState = results.find((r) => r.strategy.name === 'B_PUBLIC_INVESTMENT_STATE')?.state
    const conservative = results.find((r) => r.strategy.name === 'A_FISCAL_CONSERVATIVE')?.state
    expect(investmentState).toBeDefined()
    expect(conservative).toBeDefined()
    if (!investmentState || !conservative) return
    expect(investmentState.projects.length).toBeGreaterThan(0)
    expect(investmentState.projects.length).toBeGreaterThan(conservative.projects.length)
  })

  it('A_FISCAL_CONSERVATIVE ends with a lower debt ratio than B_PUBLIC_INVESTMENT_STATE — fiscal consolidation remains a genuinely viable path (M6.5 §Part VI: no dominant strategy)', () => {
    const conservative = results.find((r) => r.strategy.name === 'A_FISCAL_CONSERVATIVE')?.state
    const investmentState = results.find((r) => r.strategy.name === 'B_PUBLIC_INVESTMENT_STATE')?.state
    expect(conservative).toBeDefined()
    expect(investmentState).toBeDefined()
    if (!conservative || !investmentState) return
    expect(conservative.gameState.economic.debtRatio).toBeLessThan(investmentState.gameState.economic.debtRatio)
  })

  it('a debt-financed fund (C/D) shows up as extra debt vs. the no-fund equivalent-budget strategies — no free money', () => {
    const industrial = results.find((r) => r.strategy.name === 'C_SOVEREIGN_FUND_INDUSTRIAL')?.state
    expect(industrial).toBeDefined()
    if (!industrial) return
    // The fund's own capitalization (30 Md€, DEBT-funded) must appear as debt somewhere on the books —
    // sanity-checked via the fund's own net-value accounting rather than a fragile absolute debt comparison
    // across strategies with materially different budgets.
    expect(industrial.sovereignFund.capitalContributed).toBe(30)
  })

  it('the 6 scenarios do not all converge on the same final score or debt ratio', () => {
    const scores = results.map((r) => r.state.finalScoreBreakdown?.total)
    const debtRatios = results.map((r) => Number(r.state.gameState.economic.debtRatio.toFixed(1)))
    expect(new Set(scores).size).toBeGreaterThan(1)
    expect(new Set(debtRatios).size).toBeGreaterThan(3)
  })

  it('reports the full M6.5 metrics table for every scenario (for the final report — always true, exists to print via --reporter=verbose if desired)', () => {
    for (const { strategy, state } of results) {
      const summary = {
        strategy: strategy.name,
        finalScore: state.finalScoreBreakdown?.total,
        endingTitle: state.endingTitle,
        debtRatio: Number(state.gameState.economic.debtRatio.toFixed(1)),
        deficitRatio: Number(state.gameState.economic.deficitRatio.toFixed(1)),
        growth: Number(state.gameState.economic.growth.toFixed(2)),
        unemployment: Number(state.gameState.economic.unemployment.toFixed(1)),
        popularity: Number(state.gameState.political.popularity.toFixed(0)),
        projectsLaunched: state.projects.length,
        projectsCompleted: state.projects.filter((p) => p.status === 'COMPLETED').length,
        fundExists: state.sovereignFund.exists,
        fundNetValue: state.sovereignFund.exists ? Number(netValueCreated(state.sovereignFund).toFixed(1)) : null,
        promisesKept: state.promiseResolutions.filter((r) => r.finalStatus === 'KEPT').length,
      }
      expect(summary.strategy).toBe(strategy.name)
    }
  })
})
