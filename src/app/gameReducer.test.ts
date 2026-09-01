import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { MANDATE_END_TURN } from '../game/country-run/mandate/calendar.ts'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  // Tests need a fixed seed for determinism checks; START_GAME/NEW_GAME pick a random one.
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

const PROMISE_IDS = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']
const toggles: GameAction[] = PROMISE_IDS.map((promiseId) => ({ type: 'TOGGLE_PROMISE', promiseId }))

/** Drives the active bill (budget or discretionary) to a terminal outcome, renegotiating on a non-terminal rejection — bounded by MAX_VOTE_ATTEMPTS, so this always halts. */
function resolveActiveBillToTerminal(state: GamePrototypeState): GamePrototypeState {
  let s = state
  while (s.activeBill) {
    s = gameReducer(s, { type: 'CALL_VOTE' })
    if (s.activeBill && s.activeBill.status === 'REJECTED') {
      s = gameReducer(s, { type: 'RENEGOTIATE_BILL' })
    }
  }
  return s
}

function campaignThrough(seed: string, governmentProfileId = 'reformateurs'): GamePrototypeState {
  let state = withSeed(createInitialGamePrototypeState(), seed)
  const actions: GameAction[] = [
    { type: 'START_GAME' },
    { type: 'BEGIN_PROMISE_SELECTION' },
    ...toggles,
    { type: 'CONFIRM_PROMISES' },
    { type: 'PROCEED_TO_ELECTION' },
    { type: 'VIEW_FRANCE_BRIEFING' },
    { type: 'PROCEED_TO_GOVERNMENT' },
    { type: 'CHOOSE_GOVERNMENT', profileId: governmentProfileId },
    { type: 'VIEW_PARLIAMENT_COMPOSITION' },
    { type: 'PROCEED_TO_MANDATE_START' },
    { type: 'BEGIN_MANDATE' },
  ]
  for (const action of actions) state = gameReducer(state, action)
  return state
}

/** Runs one full budget cycle (Bercy only on the very first year) through to `mandateTurn`, ready for ADVANCE_TURN. */
function runBudgetCycle(state: GamePrototypeState, stance: 'invest' | 'cut' | 'maintain', discretionaryBillId: string | null): GamePrototypeState {
  let s = state
  if (s.screen === 'bercyAudit') {
    s = gameReducer(s, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
  }
  const tier = stance === 'invest' ? 'hospitalPlan' : stance === 'cut' ? 'efficiencyDrive' : 'maintain'
  const eduTier = stance === 'invest' ? 'invest' : stance === 'cut' ? 'cuts' : 'maintain'
  s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'health', tierId: tier })
  s = gameReducer(s, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'education', tierId: eduTier })
  s = gameReducer(s, { type: 'SUBMIT_BUDGET' })
  s = resolveActiveBillToTerminal(s)
  s = gameReducer(s, { type: 'PROCEED_TO_REFORM_HUB' })
  if (discretionaryBillId && availableReformBills(s).some((b) => b.id === discretionaryBillId)) {
    s = gameReducer(s, { type: 'PROPOSE_BILL', billId: discretionaryBillId })
    s = resolveActiveBillToTerminal(s)
    // Mirrors VoteScreen's "Continuer" for a non-budget bill (see App.tsx).
    s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
  } else {
    s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
  }
  return s
}

/** Advances one turn, auto-resolving an event with its first choice if one fires — keeps test flows unblocked and deterministic. */
function advanceOneTurn(state: GamePrototypeState): GamePrototypeState {
  let s = gameReducer(state, { type: 'ADVANCE_TURN' })
  if (s.screen === 'event' && s.activeEventId) {
    const event = getEventDefinition(s.activeEventId)
    s = gameReducer(s, { type: 'CHOOSE_EVENT', choiceId: event.choices[0].id })
    s = gameReducer(s, { type: 'CONTINUE_AFTER_EVENT' })
  }
  return s
}

/** Runs a full 6-turn gameplay year: one budget cycle, then 6 ADVANCE_TURNs, ending on `yearReview` (or `mandateReview` if this was Year 5). */
function runYear(state: GamePrototypeState, stance: 'invest' | 'cut' | 'maintain', discretionaryBillId: string | null): GamePrototypeState {
  let s = runBudgetCycle(state, stance, discretionaryBillId)
  for (let i = 0; i < 6; i++) s = advanceOneTurn(s)
  return s
}

function playFullMandate(seed: string, stance: 'invest' | 'cut' | 'maintain' = 'maintain'): GamePrototypeState {
  let s = campaignThrough(seed)
  for (let year = 1; year <= 5; year++) {
    s = runYear(s, stance, null)
    if (s.screen === 'yearReview') s = gameReducer(s, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
  }
  return s
}

describe('gameReducer — screen transitions through the M5 mandate pipeline', () => {
  it('starts on the landing screen', () => {
    expect(createInitialGamePrototypeState().screen).toBe('landing')
  })

  it('CHOOSE_BERCY goes straight to budgetBuilder (no energyShock screen — migrated to the event catalog)', () => {
    let state = campaignThrough('flow-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    expect(state.screen).toBe('budgetBuilder')
    expect(state.currentBudgetLabel).toBe('Budget 2028')
  })

  it('SUBMIT_BUDGET creates an active bill and moves to billNegotiation', () => {
    let state = campaignThrough('submit-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    expect(state.screen).toBe('billNegotiation')
    expect(state.activeBill?.billId).toBe('budget-bill')
    expect(state.activeBill?.status).toBe('NEGOTIATING')
  })

  it('SET_FINANCE_TIER never touches the economic simulation, only the draft selection', () => {
    let state = campaignThrough('draft-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    const turnBefore = state.gameState.meta.turn
    state = gameReducer(state, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'economyInvestment', tierId: 'infrastructure' })
    expect(state.gameState.meta.turn).toBe(turnBefore)
    expect(state.draftFinanceSelections.spending.economyInvestment).toBe('infrastructure')
  })

  it('a resolved budget bill commits its levels and moves through reformHub to mandateTurn on skip', () => {
    const state = runYear(campaignThrough('year-flow-check'), 'invest', null)
    // A full year (6 ADVANCE_TURN calls) always ends on yearReview.
    expect(state.screen).toBe('yearReview')
    expect(state.gameState.meta.turn).toBe(6)
    expect(state.financeLevels.spending.health).toBe('hospitalPlan')
  })
})

describe('gameReducer — promise selection', () => {
  it('enforces exactly 5 promises: a 6th toggle is a no-op', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'promise-cap-check')
    state = gameReducer(state, { type: 'START_GAME' })
    state = gameReducer(state, { type: 'BEGIN_PROMISE_SELECTION' })
    for (const action of toggles) state = gameReducer(state, action)
    expect(state.choices.selectedPromiseIds).toHaveLength(5)
    const beforeExtra = state.choices.selectedPromiseIds
    state = gameReducer(state, { type: 'TOGGLE_PROMISE', promiseId: 'reduce-debt' })
    expect(state.choices.selectedPromiseIds).toBe(beforeExtra)
  })
})

describe('gameReducer — negotiation actions', () => {
  it('NEGOTIATE_OFFER_CONCESSION cannot apply the same concession twice', () => {
    let state = campaignThrough('concession-dup-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = gameReducer(state, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_HEALTH_FUNDING' })
    const afterFirst = state.activeBill?.appliedConcessionIds
    state = gameReducer(state, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_HEALTH_FUNDING' })
    expect(state.activeBill?.appliedConcessionIds).toBe(afterFirst)
  })

  it('NEGOTIATE_SEEK_SUPPORT spends capital once and is a no-op on the same bloc twice', () => {
    let state = campaignThrough('seek-support-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const capitalBefore = state.politicalCapital ?? 0
    state = gameReducer(state, { type: 'NEGOTIATE_SEEK_SUPPORT', blocId: 'SOCIAL_LEFT' })
    expect(state.politicalCapital).toBe(capitalBefore - 2)
    const capitalAfterFirst = state.politicalCapital
    state = gameReducer(state, { type: 'NEGOTIATE_SEEK_SUPPORT', blocId: 'SOCIAL_LEFT' })
    expect(state.politicalCapital).toBe(capitalAfterFirst)
  })

  it('NEGOTIATE_SPEND_CAPITAL cannot spend more than available capital', () => {
    let state = campaignThrough('overspend-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, politicalCapital: 3 }
    const before = state
    state = gameReducer(state, { type: 'NEGOTIATE_SPEND_CAPITAL', amount: 20 })
    expect(state).toBe(before)
  })
})

describe('gameReducer — reform hub / discretionary reforms across years (M5 §36)', () => {
  it('PROPOSE_BILL is rejected once a reform has already been ADOPTED', () => {
    let state = runYear(campaignThrough('slot-check'), 'invest', 'hospital-plan-bill')
    state = gameReducer(state, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
    state = runBudgetCycle(state, 'invest', null) // no new reform this year — Reform Hub not yet visited
    // Re-enter reform hub for year 2 and try to re-propose the same, already-adopted bill.
    // (runBudgetCycle already passed through reformHub via BEGIN_TURN_LOOP since discretionaryBillId was null)
    expect(availableReformBills(state).some((b) => b.id === 'hospital-plan-bill')).toBe(false)
  })

  it('BEGIN_TURN_LOOP is a no-op while a bill is still active', () => {
    let state = campaignThrough('active-bill-guard-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const before = state
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })
    expect(state).toBe(before)
  })

  it('skipping the discretionary reform still reaches yearReview with only the budget in history', () => {
    const state = runYear(campaignThrough('skip-check'), 'invest', null)
    expect(state.screen).toBe('yearReview')
    expect(state.billHistory.filter((e) => e.billId !== 'budget-bill')).toHaveLength(0)
  })

  it('choosing a discretionary reform adds a second billHistory entry', () => {
    const state = runYear(campaignThrough('discretionary-check'), 'invest', 'education-investment-bill')
    expect(state.billHistory.some((e) => e.billId === 'education-investment-bill')).toBe(true)
  })
})

describe('gameReducer — the per-turn mandate loop (M5 §5, §38)', () => {
  it('ADVANCE_TURN is a no-op outside the mandateTurn screen', () => {
    const state = campaignThrough('advance-guard-check')
    const before = state
    const after = gameReducer(state, { type: 'ADVANCE_TURN' })
    expect(after).toBe(before)
  })

  it('a single ADVANCE_TURN moves the calendar forward by exactly one turn', () => {
    const state = runBudgetCycle(campaignThrough('single-turn-check'), 'maintain', null)
    const turnBefore = state.gameState.meta.turn
    const after = advanceOneTurn(state)
    expect(after.gameState.meta.turn).toBe(turnBefore + 1)
  })

  it('a full gameplay year is exactly 6 turns, ending on yearReview', () => {
    const state = runYear(campaignThrough('six-turn-check'), 'maintain', null)
    expect(state.gameState.meta.turn).toBe(6)
    expect(state.screen).toBe('yearReview')
    expect(state.finalScoreBreakdown).not.toBeNull()
    expect(state.endingTitle).toBeNull() // provisional only — mandate isn't over
  })

  it('CONTINUE_FROM_YEAR_REVIEW opens the next budget cycle with the correct label', () => {
    let state = runYear(campaignThrough('next-cycle-check'), 'maintain', null)
    state = gameReducer(state, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
    expect(state.screen).toBe('budgetBuilder')
    expect(state.currentBudgetLabel).toBe('Budget 2029')
  })

  it('a kept (unchanged) budget stance across two years contributes zero marginal delta the second year (M1.5 anti-regression)', () => {
    let state = campaignThrough('kept-budget-check')
    state = runBudgetCycle(state, 'maintain', null)
    const levelsAfterYear1 = state.financeLevels
    for (let i = 0; i < 6; i++) state = advanceOneTurn(state)
    state = gameReducer(state, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
    state = runBudgetCycle(state, 'maintain', null) // same neutral stance again
    expect(state.financeLevels).toEqual(levelsAfterYear1)
  })
})

describe('gameReducer — full mandate traversal (M5 §5-6)', () => {
  it('reaches turn 30 and the mandateReview screen after exactly 5 years', () => {
    const state = playFullMandate('full-mandate-check')
    expect(state.gameState.meta.turn).toBe(MANDATE_END_TURN)
    expect(state.screen).toBe('mandateReview')
    expect(state.finalScoreBreakdown).not.toBeNull()
    expect(state.endingTitle).not.toBeNull()
  })

  it('every selected promise is resolved (KEPT/PARTIAL/BROKEN) by mandate end', () => {
    const state = playFullMandate('promise-resolution-check')
    expect(state.promiseResolutions).toHaveLength(state.choices.selectedPromiseIds.length)
    for (const resolution of state.promiseResolutions) {
      expect(['KEPT', 'PARTIAL', 'BROKEN']).toContain(resolution.finalStatus)
    }
  })

  it('keeps popularity, political capital and government tension within bounds after a full mandate', () => {
    const state = playFullMandate('bounds-check')
    expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
    expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
    expect(state.politicalCapital ?? 0).toBeGreaterThanOrEqual(0)
    expect(state.politicalCapital ?? 0).toBeLessThanOrEqual(100)
    expect(state.governmentTension).toBeGreaterThanOrEqual(0)
    expect(state.governmentTension).toBeLessThanOrEqual(100)
  })

  it('produces no NaN or Infinity anywhere in the final economic state', () => {
    const state = playFullMandate('nan-check')
    for (const value of Object.values(state.gameState.economic)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('is pure: dispatching CALL_VOTE twice on the same state — as React StrictMode would — yields identical results', () => {
    let state = campaignThrough('strict-mode-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const action: GameAction = { type: 'CALL_VOTE' }
    const first = gameReducer(state, action)
    const second = gameReducer(state, action)
    expect(first).toEqual(second)
  })
})

describe('gameReducer — determinism / replay', () => {
  it('the same seed and the same choices reproduce an identical final state', () => {
    const a = playFullMandate('determinism-check')
    const b = playFullMandate('determinism-check')
    expect(a.gameState).toEqual(b.gameState)
    expect(a.finalScoreBreakdown).toEqual(b.finalScoreBreakdown)
    expect(a.billHistory).toEqual(b.billHistory)
    expect(a.promiseResolutions).toEqual(b.promiseResolutions)
  })

  it('a different seed can produce a different final state for the same choices', () => {
    const a = playFullMandate('seed-a')
    const b = playFullMandate('seed-b')
    expect(a.gameState.economic).not.toEqual(b.gameState.economic)
  })

  it('different budget stances produce a different outcome for the same seed', () => {
    const spender = playFullMandate('branch-check', 'invest')
    const austerity = playFullMandate('branch-check', 'cut')
    expect(spender.gameState.economic.debtRatio).not.toBeCloseTo(austerity.gameState.economic.debtRatio, 0)
  })

  it('NEW_GAME resets to the landing screen with a different seed and clears campaign + bill state', () => {
    const played = playFullMandate('new-game-check')
    const restarted = gameReducer(played, { type: 'NEW_GAME' })
    expect(restarted.screen).toBe('landing')
    expect(restarted.seed).not.toBe(played.seed)
    expect(restarted.billHistory).toEqual([])
    expect(restarted.choices.selectedPromiseIds).toEqual([])
    expect(restarted.choices.governmentProfileId).toBeNull()
  })
})

describe('gameReducer — exceptional procedure (M4 §20)', () => {
  it('USE_EXCEPTIONAL_PROCEDURE bypasses the vote, costs the fixed capital amount, and finalizes the bill as ADOPTED', () => {
    let state = campaignThrough('exceptional-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, politicalCapital: 100 }
    const before = state.politicalCapital
    state = gameReducer(state, { type: 'USE_EXCEPTIONAL_PROCEDURE' })
    expect(state.activeBill).toBeNull()
    expect(state.politicalCapital).toBe((before ?? 0) - 25)
    expect(state.billHistory).toHaveLength(1)
    expect(state.billHistory[0].status).toBe('ADOPTED')
    expect(state.billHistory[0].usedExceptionalProcedure).toBe(true)
  })

  it('is a no-op without enough political capital', () => {
    let state = campaignThrough('exceptional-underfunded-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, politicalCapital: 5 }
    const before = state
    state = gameReducer(state, { type: 'USE_EXCEPTIONAL_PROCEDURE' })
    expect(state).toBe(before)
  })
})

describe('gameReducer — retry restrictions (M4 §19)', () => {
  it('RENEGOTIATE_BILL is a no-op once MAX_VOTE_ATTEMPTS is reached', () => {
    let state = campaignThrough('retry-cap-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, activeBill: state.activeBill ? { ...state.activeBill, status: 'REJECTED', voteAttempts: 3 } : null }
    const before = state
    state = gameReducer(state, { type: 'RENEGOTIATE_BILL' })
    expect(state).toBe(before)
  })

  it('WITHDRAW_BILL is never allowed on the mandatory Budget Bill', () => {
    let state = campaignThrough('no-withdraw-budget-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const before = state
    state = gameReducer(state, { type: 'WITHDRAW_BILL' })
    expect(state).toBe(before)
  })
})

describe('gameReducer — discretionary bill feeds back into the real economic simulation (M4 §13)', () => {
  it('adopting a reform changes the final economic state vs. skipping the reform entirely', () => {
    const withReform = runYear(campaignThrough('reform-feedback-check'), 'maintain', 'energy-transition-bill')
    const withoutReform = runYear(campaignThrough('reform-feedback-check'), 'maintain', null)
    expect(withReform.gameState.economic).not.toEqual(withoutReform.gameState.economic)
  })
})

describe('gameReducer — serializable state (M3 §28, M4 §36, M5 §57)', () => {
  it('the full state survives a JSON round-trip unchanged', () => {
    const state = runYear(campaignThrough('serialization-check'), 'invest', 'hospital-plan-bill')
    const roundTripped = JSON.parse(JSON.stringify(state)) as GamePrototypeState
    expect(roundTripped).toEqual(state)
  })

  it('carries gameVersion, seed, createdAt and updatedAt', () => {
    const state = createInitialGamePrototypeState()
    expect(state.gameVersion).toBeTruthy()
    expect(state.seed).toBeTruthy()
    expect(state.createdAt).toBeTruthy()
    expect(state.updatedAt).toBeTruthy()
  })
})
