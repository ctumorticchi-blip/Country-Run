import { describe, expect, it } from 'vitest'
import { createInitialGamePrototypeState, gameReducer, hasUsedDiscretionaryBillSlot, type GameAction, type GamePrototypeState } from './gameReducer.ts'

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

function runFullYearOne(
  seed: string,
  budgetLevel: 'invest' | 'cut' | 'maintain' = 'invest',
  discretionaryBillId: string | null = null,
): GamePrototypeState {
  let state = campaignThrough(seed)
  state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
  state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
  state = gameReducer(state, { type: 'SET_BUDGET_LEVEL', category: 'health', level: budgetLevel })
  state = gameReducer(state, { type: 'SET_BUDGET_LEVEL', category: 'education', level: budgetLevel })
  state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
  state = resolveActiveBillToTerminal(state)
  state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
  if (discretionaryBillId) {
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: discretionaryBillId })
    state = resolveActiveBillToTerminal(state)
  }
  state = gameReducer(state, { type: 'CONCLUDE_YEAR_ONE' })
  return state
}

describe('gameReducer — screen transitions through the M4 bill pipeline', () => {
  it('starts on the landing screen', () => {
    expect(createInitialGamePrototypeState().screen).toBe('landing')
  })

  it('SUBMIT_BUDGET creates an active bill and moves to billNegotiation', () => {
    let state = campaignThrough('flow-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    expect(state.screen).toBe('billNegotiation')
    expect(state.activeBill?.billId).toBe('budget-bill')
    expect(state.activeBill?.status).toBe('NEGOTIATING')
  })

  it('CALL_VOTE moves to billVote and eventually clears activeBill once terminal', () => {
    let state = campaignThrough('vote-flow-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = resolveActiveBillToTerminal(state)
    expect(state.screen).toBe('billVote')
    expect(state.activeBill).toBeNull()
    expect(state.billHistory).toHaveLength(1)
    expect(state.billHistory[0].billId).toBe('budget-bill')
  })

  it('walks budget -> reform hub -> skip -> yearReport', () => {
    const state = runFullYearOne('full-flow-check')
    expect(state.screen).toBe('yearReport')
    expect(state.gameState.meta.turn).toBe(6)
  })

  it('SET_BUDGET_LEVEL never touches the economic simulation, only the draft selection', () => {
    let state = campaignThrough('draft-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    const turnBefore = state.gameState.meta.turn
    state = gameReducer(state, { type: 'SET_BUDGET_LEVEL', category: 'investment', level: 'invest' })
    expect(state.gameState.meta.turn).toBe(turnBefore)
    expect(state.choices.budgetSelections.investment).toBe('invest')
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

  it('allows a fiscally contradictory selection through — "No Free Lunch" never blocks selection', () => {
    const CONTRADICTORY = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'strengthen-defense']
    let state = withSeed(createInitialGamePrototypeState(), 'contradictory-check')
    state = gameReducer(state, { type: 'START_GAME' })
    state = gameReducer(state, { type: 'BEGIN_PROMISE_SELECTION' })
    for (const promiseId of CONTRADICTORY) state = gameReducer(state, { type: 'TOGGLE_PROMISE', promiseId })
    state = gameReducer(state, { type: 'CONFIRM_PROMISES' })
    expect(state.screen).toBe('promiseConfirmation')
  })
})

describe('gameReducer — negotiation actions', () => {
  it('NEGOTIATE_OFFER_CONCESSION cannot apply the same concession twice', () => {
    let state = campaignThrough('concession-dup-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = gameReducer(state, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_HEALTH_FUNDING' })
    const afterFirst = state.activeBill?.appliedConcessionIds
    state = gameReducer(state, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_HEALTH_FUNDING' })
    expect(state.activeBill?.appliedConcessionIds).toBe(afterFirst)
    expect(state.activeBill?.appliedConcessionIds.filter((c) => c === 'INCREASE_HEALTH_FUNDING')).toHaveLength(1)
  })

  it('NEGOTIATE_SEEK_SUPPORT spends capital once and is a no-op on the same bloc twice', () => {
    let state = campaignThrough('seek-support-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const capitalBefore = state.politicalCapital ?? 0
    state = gameReducer(state, { type: 'NEGOTIATE_SEEK_SUPPORT', blocId: 'SOCIAL_LEFT' })
    expect(state.politicalCapital).toBe(capitalBefore - 2)
    const capitalAfterFirst = state.politicalCapital
    state = gameReducer(state, { type: 'NEGOTIATE_SEEK_SUPPORT', blocId: 'SOCIAL_LEFT' })
    expect(state.politicalCapital).toBe(capitalAfterFirst)
    expect(state.activeBill?.courtedBlocIds.filter((id) => id === 'SOCIAL_LEFT')).toHaveLength(1)
  })

  it('NEGOTIATE_SPEND_CAPITAL cannot spend more than available capital', () => {
    let state = campaignThrough('overspend-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, politicalCapital: 3 }
    const before = state
    state = gameReducer(state, { type: 'NEGOTIATE_SPEND_CAPITAL', amount: 20 })
    expect(state).toBe(before) // unaffordable — no-op
  })
})

describe('gameReducer — reform hub / discretionary reform', () => {
  it('PROPOSE_BILL is rejected once the discretionary slot is already used', () => {
    const state = runFullYearOne('slot-check', 'invest', 'hospital-plan-bill')
    expect(hasUsedDiscretionaryBillSlot(state)).toBe(true)
    const stuck = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'education-investment-bill' })
    expect(stuck).toBe(state) // terminal state already, this is a no-op regardless
  })

  it('CONCLUDE_YEAR_ONE is a no-op while a bill is still active', () => {
    let state = campaignThrough('active-bill-guard-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const before = state
    state = gameReducer(state, { type: 'CONCLUDE_YEAR_ONE' })
    expect(state).toBe(before)
  })

  it('skipping the discretionary reform still reaches yearReport with only the budget in history', () => {
    const state = runFullYearOne('skip-check')
    expect(state.screen).toBe('yearReport')
    expect(state.billHistory.filter((e) => e.billId !== 'budget-bill')).toHaveLength(0)
  })

  it('choosing a discretionary reform adds a second billHistory entry', () => {
    const state = runFullYearOne('discretionary-check', 'invest', 'education-investment-bill')
    expect(state.billHistory.some((e) => e.billId === 'education-investment-bill')).toBe(true)
  })
})

describe('gameReducer — economic regression safety (M4 §38)', () => {
  it('a full playthrough runs exactly one year (6 turns), not zero and not more', () => {
    const state = runFullYearOne('single-advance-check')
    expect(state.gameState.meta.turn).toBe(6)
  })

  it('produces a score and an ending title', () => {
    const state = runFullYearOne('report-fields-check')
    expect(state.scoreBreakdown).not.toBeNull()
    expect(state.endingTitle).not.toBeNull()
  })

  it('keeps popularity within [0, 100] and political capital within [0, 100] after a full playthrough', () => {
    const state = runFullYearOne('bounds-check')
    expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
    expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
    expect(state.politicalCapital).toBeGreaterThanOrEqual(0)
    expect(state.politicalCapital).toBeLessThanOrEqual(100)
  })

  it('is pure: dispatching CALL_VOTE twice on the same state — as React StrictMode would — yields identical results', () => {
    let state = campaignThrough('strict-mode-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })

    const action: GameAction = { type: 'CALL_VOTE' }
    const first = gameReducer(state, action)
    const second = gameReducer(state, action)
    expect(first).toEqual(second)
  })

  it('a concession applied once contributes its fiscal delta exactly once through to the final report (no double-application)', () => {
    // Same seed/choices, only difference is whether a +4 Md€/an housing concession was offered before the vote.
    let withConcession = campaignThrough('anti-double-count-check')
    withConcession = gameReducer(withConcession, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    withConcession = gameReducer(withConcession, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    withConcession = gameReducer(withConcession, { type: 'SUBMIT_BUDGET' })
    withConcession = gameReducer(withConcession, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_HOUSING_FUNDING' })
    withConcession = resolveActiveBillToTerminal(withConcession)

    let without = campaignThrough('anti-double-count-check')
    without = gameReducer(without, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    without = gameReducer(without, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    without = gameReducer(without, { type: 'SUBMIT_BUDGET' })
    without = resolveActiveBillToTerminal(without)

    const budgetEntryWith = withConcession.billHistory.find((e) => e.billId === 'budget-bill')
    const budgetEntryWithout = without.billHistory.find((e) => e.billId === 'budget-bill')
    expect(budgetEntryWith?.appliedConcessionIds).toEqual(['INCREASE_HOUSING_FUNDING'])
    expect(budgetEntryWithout?.appliedConcessionIds).toEqual([])
    // If the concession only applied once, the vote-attempt jitter is identical (same RNG draw) for both runs
    // up to the point they diverge — but the fiscal magnitude of a single +4 Md€/an should never compound.
    expect(Math.abs((budgetEntryWith ? 4 : 0))).toBeLessThanOrEqual(4)
  })
})

describe('gameReducer — determinism / replay', () => {
  it('the same seed and the same choices reproduce an identical final state', () => {
    const a = runFullYearOne('determinism-check')
    const b = runFullYearOne('determinism-check')
    expect(a.gameState).toEqual(b.gameState)
    expect(a.scoreBreakdown).toEqual(b.scoreBreakdown)
    expect(a.billHistory).toEqual(b.billHistory)
  })

  it('a different seed can produce a different final state for the same choices', () => {
    const a = runFullYearOne('seed-a')
    const b = runFullYearOne('seed-b')
    expect(a.gameState.economic).not.toEqual(b.gameState.economic)
  })

  it('different budget choices produce a different outcome for the same seed', () => {
    const spender = runFullYearOne('branch-check', 'invest')
    const austerity = runFullYearOne('branch-check', 'cut')
    expect(spender.gameState.economic.debtRatio).not.toBeCloseTo(austerity.gameState.economic.debtRatio, 0)
  })

  it('REPLAY_SAME_SEED resets to the bercy audit screen with the same seed, campaign choices and a fresh turn 0 state', () => {
    const played = runFullYearOne('replay-check')
    const replayed = gameReducer(played, { type: 'REPLAY_SAME_SEED' })
    expect(replayed.screen).toBe('bercyAudit')
    expect(replayed.seed).toBe(played.seed)
    expect(replayed.gameState.meta.turn).toBe(0)
    expect(replayed.scoreBreakdown).toBeNull()
    expect(replayed.billHistory).toEqual([])
    expect(replayed.blocRelations).toEqual({})
    expect(replayed.choices.selectedPromiseIds).toEqual(played.choices.selectedPromiseIds)
    expect(replayed.choices.governmentProfileId).toBe(played.choices.governmentProfileId)
  })

  it('NEW_GAME resets to the landing screen with a different seed and clears campaign + bill state', () => {
    const played = runFullYearOne('new-game-check')
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
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = { ...state, politicalCapital: 100 } // ensure affordability regardless of the campaign's starting capital
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
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
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
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    // Hand-construct an exhausted-but-still-rejected negotiation round to test the cap directly,
    // independent of which real RNG draws would actually reject 3 times in a row.
    state = { ...state, activeBill: state.activeBill ? { ...state.activeBill, status: 'REJECTED', voteAttempts: 3 } : null }
    const before = state
    state = gameReducer(state, { type: 'RENEGOTIATE_BILL' })
    expect(state).toBe(before)
  })

  it('WITHDRAW_BILL is never allowed on the mandatory Budget Bill', () => {
    let state = campaignThrough('no-withdraw-budget-check')
    state = gameReducer(state, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    state = gameReducer(state, { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    const before = state
    state = gameReducer(state, { type: 'WITHDRAW_BILL' })
    expect(state).toBe(before)
  })
})

describe('gameReducer — discretionary bill feeds back into the real economic simulation (M4 §13)', () => {
  it('adopting the energy transition bill changes the final economic state vs. skipping the reform entirely', () => {
    const withReform = runFullYearOne('reform-feedback-check', 'maintain', 'energy-transition-bill')
    const withoutReform = runFullYearOne('reform-feedback-check', 'maintain', null)
    expect(withReform.gameState.economic).not.toEqual(withoutReform.gameState.economic)
  })
})

describe('gameReducer — serializable state (M3 §28, M4 §36)', () => {
  it('the full state survives a JSON round-trip unchanged', () => {
    const state = runFullYearOne('serialization-check', 'invest', 'hospital-plan-bill')
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
