import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { activeLedgerEntries, sumActiveLedgerPolicyEffect } from '../game/country-run/finance/fiscalLedger.ts'
import { createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

/**
 * M6 §71-73: reducer-level integration tests for mechanisms that only make
 * sense wired end-to-end through the real dispatch pipeline — temporary
 * policy expiration (§39), the budget-bill concession fix (§53), and
 * pension/tier phase-in (§8) — on top of the pure-function unit tests in
 * `finance/*.test.ts`.
 */

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

function campaignThrough(seed: string): GamePrototypeState {
  let state = withSeed(createInitialGamePrototypeState(), seed)
  const actions: GameAction[] = [
    { type: 'START_GAME' },
    { type: 'BEGIN_PROMISE_SELECTION' },
    { type: 'TOGGLE_PROMISE', promiseId: 'hospital-plan' },
    { type: 'TOGGLE_PROMISE', promiseId: 'invest-education' },
    { type: 'TOGGLE_PROMISE', promiseId: 'grand-investment-plan' },
    { type: 'TOGGLE_PROMISE', promiseId: 'energy-transition' },
    { type: 'TOGGLE_PROMISE', promiseId: 'build-housing' },
    { type: 'CONFIRM_PROMISES' },
    { type: 'PROCEED_TO_ELECTION' },
    { type: 'VIEW_FRANCE_BRIEFING' },
    { type: 'PROCEED_TO_GOVERNMENT' },
    { type: 'CHOOSE_GOVERNMENT', profileId: 'reformateurs' },
    { type: 'VIEW_PARLIAMENT_COMPOSITION' },
    { type: 'PROCEED_TO_MANDATE_START' },
    { type: 'BEGIN_MANDATE' },
    { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' },
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

/**
 * Auto-resolves any naturally-firing event with its first choice (matches
 * gameReducer.test.ts's own helper — a DIFFERENT event firing mid-loop can
 * never softlock the screen on 'event': a hardcoded choiceId that doesn't
 * exist on that event would leave `lastEventChoice` unset and
 * CONTINUE_AFTER_EVENT a permanent no-op), AND auto-continues through a
 * year boundary (a neutral, unchanged budget resubmitted) so a test can
 * freely advance turn-by-turn across a year-end without the helper
 * stalling on the `yearReview` screen.
 */
function advanceOneTurn(state: GamePrototypeState): GamePrototypeState {
  let s = gameReducer(state, { type: 'ADVANCE_TURN' })
  if (s.screen === 'event' && s.activeEventId) {
    const event = getEventDefinition(s.activeEventId)
    s = gameReducer(s, { type: 'CHOOSE_EVENT', choiceId: event.choices[0].id })
    s = gameReducer(s, { type: 'CONTINUE_AFTER_EVENT' })
  }
  if (s.screen === 'yearReview') {
    s = gameReducer(s, { type: 'CONTINUE_FROM_YEAR_REVIEW' })
    s = skipBudgetCycle(s)
  }
  return s
}

/** Skips a neutral budget through to mandateTurn — every block left at its default tier. */
function skipBudgetCycle(state: GamePrototypeState): GamePrototypeState {
  let s = gameReducer(state, { type: 'SUBMIT_BUDGET' })
  s = resolveActiveBillToTerminal(s)
  s = gameReducer(s, { type: 'PROCEED_TO_REFORM_HUB' })
  return gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
}

describe('M6 §39 temporary policy expiration — end to end through the reducer', () => {
  it('a temporary event measure reverses exactly once, on its own expiry turn, and never again', () => {
    let state = skipBudgetCycle(campaignThrough('temp-event-e2e'))
    // Play one genuine turn first so `meta.turn` is already >= 1 before we inject our own event —
    // forcing an event at turn 0 (before any real ADVANCE_TURN) hits `isYearEndTurn`'s `turn % 6 === 0`
    // edge case (true for turn 0 too), an unreachable state in real play that would send CONTINUE_AFTER_EVENT
    // straight to `yearReview` instead of back to `mandateTurn`.
    state = advanceOneTurn(state)
    expect(state.screen).toBe('mandateTurn')

    // Force the tax-shortfall event's temporary-tax choice deterministically, bypassing the RNG roll.
    state = { ...state, screen: 'event', activeEventId: 'tax-shortfall' }
    state = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'temporary-tax' })
    state = gameReducer(state, { type: 'CONTINUE_AFTER_EVENT' })
    expect(state.screen).toBe('mandateTurn')

    const ledgerEntry = state.fiscalLedger.find((e) => e.sourceId.includes('temporary-tax'))
    expect(ledgerEntry).toBeDefined()
    expect(ledgerEntry?.temporary).toBe(true)
    expect(ledgerEntry?.endTurn).not.toBeNull()

    const startTurn = ledgerEntry?.startTurn ?? 0
    const endTurn = ledgerEntry?.endTurn ?? 0

    // The turn it starts, taxChanges is part of the running policy total.
    let s = state
    while (s.gameState.meta.turn < startTurn) s = advanceOneTurn(s)
    expect(s.lastMergedPolicyInput.taxChanges).toBeGreaterThan(0)

    // The turn it expires, the reversal has landed — taxChanges is back down.
    while (s.gameState.meta.turn < endTurn) s = advanceOneTurn(s)
    expect(s.lastMergedPolicyInput.taxChanges).toBeCloseTo(0, 5)

    // One more turn: it does not re-fire (no further change).
    const mergedAtExpiry = s.lastMergedPolicyInput.taxChanges
    s = advanceOneTurn(s)
    expect(s.lastMergedPolicyInput.taxChanges).toBeCloseTo(mergedAtExpiry, 5)
  })
})

describe('M6 §53 budget-bill concession fix — a granted concession actually lands in the running policy total', () => {
  it('a concession offered on the Budget Bill schedules and folds in its fiscal effect exactly once', () => {
    let state = campaignThrough('concession-fix-e2e')
    state = gameReducer(state, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'health', tierId: 'hospitalPlan' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = gameReducer(state, { type: 'NEGOTIATE_OFFER_CONCESSION', concessionId: 'INCREASE_GREEN_INVESTMENT' })
    state = { ...state, politicalCapital: 100 } // guarantee the vote passes comfortably regardless of seed
    state = resolveActiveBillToTerminal(state)
    expect(state.billHistory[state.billHistory.length - 1]?.status).toBe('ADOPTED')

    const scheduled = state.scheduledImplementations.find((e) => e.sourceId.startsWith('budget-concession:'))
    expect(scheduled).toBeDefined()
    expect(scheduled?.policyEffect.publicInvestmentChanges).toBe(4)

    const ledgerEntry = state.fiscalLedger.find((e) => e.sourceId.startsWith('budget-concession:'))
    expect(ledgerEntry).toBeDefined()
    expect(ledgerEntry?.originType).toBe('CONCESSION')

    state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })

    let s = state
    for (let i = 0; i < 6; i++) s = advanceOneTurn(s)
    expect(s.implementedReformPolicies.publicInvestmentChanges).toBeGreaterThanOrEqual(4)
  })
})

describe('M6 §8 pension (and general tier) phase-in — a delayed tier is NOT felt on the turn it is adopted', () => {
  it('the structural pension reform tier is invisible to the merged policy until its implementationTiming has elapsed', () => {
    let state = campaignThrough('pension-phasein-e2e')
    state = gameReducer(state, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'pensions', tierId: 'structural' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = resolveActiveBillToTerminal(state)
    state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })

    const scheduled = state.scheduledImplementations.find((e) => e.sourceId.startsWith('budget:pensions:'))
    expect(scheduled).toBeDefined()
    expect(scheduled?.scheduledTurn).toBe(1 + 5) // this is the mandate's very first budget cycle (nextYearStartTurn 1) — structural tier: implementationTiming 5

    // Turns 1-5 (before the scheduled turn 6): still pending, not yet matured/folded in.
    let s = state
    for (let i = 0; i < 5; i++) {
      s = advanceOneTurn(s)
      expect(s.scheduledImplementations.some((e) => e.sourceId.startsWith('budget:pensions:'))).toBe(true)
    }

    // Turn 6: the reform matures — it leaves the pending queue exactly once.
    s = advanceOneTurn(s)
    expect(s.scheduledImplementations.some((e) => e.sourceId.startsWith('budget:pensions:'))).toBe(false)
  })
})

describe('French locale formatting sanity (M6 §60)', () => {
  it('the game state itself never depends on locale — a JSON round trip stays identical regardless', () => {
    const state = skipBudgetCycle(campaignThrough('locale-sanity'))
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})

describe('M6 §41 fiscal ledger reconciliation — the ledger explains, byte for byte, the same policy the engine actually received', () => {
  it('after a full budget cycle, active ledger entries sum to exactly what matured into implementedReformPolicies', () => {
    let state = campaignThrough('ledger-reconcile-e2e')
    state = gameReducer(state, { type: 'SET_FINANCE_TIER', kind: 'spending', blockId: 'health', tierId: 'controlSpending' })
    state = gameReducer(state, { type: 'SET_FINANCE_TIER', kind: 'revenue', blockId: 'businessTax', tierId: 'targetedCut' })
    state = gameReducer(state, { type: 'SUBMIT_BUDGET' })
    state = resolveActiveBillToTerminal(state)
    state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })

    let s = state
    for (let i = 0; i < 6; i++) s = advanceOneTurn(s)

    const activeEntries = activeLedgerEntries(s.fiscalLedger, s.gameState.meta.turn)
    expect(activeEntries.length).toBeGreaterThan(0)
    const ledgerSum = sumActiveLedgerPolicyEffect(s.fiscalLedger, s.gameState.meta.turn)
    expect(ledgerSum.currentSpendingChanges).toBe(s.implementedReformPolicies.currentSpendingChanges)
    expect(ledgerSum.taxChanges).toBe(s.implementedReformPolicies.taxChanges)
    expect(ledgerSum.businessTaxImpulse).toBe(s.implementedReformPolicies.businessTaxImpulse)
  })
})
