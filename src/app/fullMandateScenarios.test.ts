import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { MANDATE_END_TURN } from '../game/country-run/mandate/calendar.ts'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

/**
 * M5 §69: 5 strategy scenario tests (SPENDER / AUSTERITY / INVESTOR / TAX
 * CUTTER / BALANCED) — every one must complete a full 30-turn mandate, and
 * the results must meaningfully differ from each other, proving budget and
 * reform choices actually drive divergent 5-year outcomes rather than
 * converging on the same trajectory regardless of what the player does.
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

type BudgetTierId = 'cuts' | 'controlled' | 'maintain' | 'invest' | 'grandPlan' | 'accelerate' | 'reinforce' | 'hospitalPlan' | 'drastic' | 'targeted'

interface Strategy {
  name: string
  categoryTiers: Partial<Record<'health' | 'education' | 'publicInvestment' | 'defense' | 'housingTerritories' | 'greenTransition' | 'administrationEfficiency', BudgetTierId>>
  /** Tried once per year, in order — skipped if unavailable (already adopted) or unaffordable. */
  preferredReforms: string[]
}

const STRATEGIES: Strategy[] = [
  {
    name: 'SPENDER',
    categoryTiers: { health: 'hospitalPlan', education: 'invest', publicInvestment: 'grandPlan', housingTerritories: 'invest', greenTransition: 'accelerate' },
    preferredReforms: ['hospital-plan-bill', 'housing-construction-plan-bill', 'public-investment-plan-bill', 'defense-expansion-bill'],
  },
  {
    name: 'AUSTERITY',
    categoryTiers: { health: 'cuts', education: 'cuts', publicInvestment: 'cuts', housingTerritories: 'cuts', greenTransition: 'cuts', administrationEfficiency: 'drastic' },
    preferredReforms: ['public-administration-reform-bill', 'pension-reform-bill'],
  },
  {
    name: 'INVESTOR',
    categoryTiers: { publicInvestment: 'grandPlan', greenTransition: 'accelerate' },
    preferredReforms: ['industry-innovation-plan-bill', 'public-investment-plan-bill', 'energy-transition-bill'],
  },
  {
    name: 'TAX_CUTTER',
    categoryTiers: { administrationEfficiency: 'targeted' },
    preferredReforms: ['business-tax-cut-bill', 'household-tax-cut-bill'],
  },
  {
    name: 'BALANCED',
    categoryTiers: {},
    preferredReforms: ['labor-market-reform-bill'],
  },
]

function playScenario(strategy: Strategy, seed: string): GamePrototypeState {
  let s = campaignThrough(seed)
  for (let year = 1; year <= 5; year++) {
    if (s.screen === 'bercyAudit') s = gameReducer(s, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    for (const [category, tierId] of Object.entries(strategy.categoryTiers)) {
      s = gameReducer(s, { type: 'SET_BUDGET_TIER', category: category as never, tierId })
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

describe('5 strategy scenario tests (M5 §69)', () => {
  const results = STRATEGIES.map((strategy) => ({ strategy, state: playScenario(strategy, `scenario-${strategy.name}`) }))

  it('every strategy completes the full 30-turn mandate and reaches mandateReview', () => {
    for (const { strategy, state } of results) {
      expect(state.gameState.meta.turn, `${strategy.name} should reach turn 30`).toBe(MANDATE_END_TURN)
      expect(state.screen, `${strategy.name} should reach mandateReview`).toBe('mandateReview')
      expect(state.finalScoreBreakdown, `${strategy.name} should have a final score`).not.toBeNull()
      expect(state.endingTitle, `${strategy.name} should have an ending title`).not.toBeNull()
    }
  })

  it('every strategy produces a finite, in-bounds final economic state — no NaN/Infinity, no absurd values', () => {
    for (const { strategy, state } of results) {
      for (const [key, value] of Object.entries(state.gameState.economic)) {
        expect(Number.isFinite(value), `${strategy.name}.${key} should be finite`).toBe(true)
      }
      expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
      expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
      expect(state.gameState.economic.debtRatio).toBeGreaterThan(0)
      expect(state.gameState.economic.debtRatio).toBeLessThan(400) // generous plausibility ceiling, not a precise forecast
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

  it('SPENDER and AUSTERITY produce meaningfully different debt trajectories', () => {
    const spender = results.find((r) => r.strategy.name === 'SPENDER')?.state
    const austerity = results.find((r) => r.strategy.name === 'AUSTERITY')?.state
    expect(spender).toBeDefined()
    expect(austerity).toBeDefined()
    if (!spender || !austerity) return
    expect(spender.gameState.economic.debtRatio).not.toBeCloseTo(austerity.gameState.economic.debtRatio, 0)
  })

  it('the 5 strategies do not all converge on the exact same final score or ending title', () => {
    const scores = results.map((r) => r.state.finalScoreBreakdown?.total)
    const titles = results.map((r) => r.state.endingTitle)
    expect(new Set(scores).size).toBeGreaterThan(1)
    expect(new Set(titles).size).toBeGreaterThan(1)
  })

  it('SPENDER enacts a higher total public-investment-relevant budget stance than AUSTERITY by mandate end', () => {
    const spender = results.find((r) => r.strategy.name === 'SPENDER')?.state
    const austerity = results.find((r) => r.strategy.name === 'AUSTERITY')?.state
    expect(spender).toBeDefined()
    expect(austerity).toBeDefined()
    if (!spender || !austerity) return
    expect(spender.budgetLevels.publicInvestment).toBeGreaterThan(austerity.budgetLevels.publicInvestment)
  })
})
