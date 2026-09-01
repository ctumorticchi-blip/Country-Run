import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { availableReformBills, createInitialGamePrototypeState, gameReducer, GAME_VERSION, type GameAction, type GamePrototypeState } from './gameReducer.ts'
import { clearSave, loadGame, saveGame, type KeyValueStore } from './save.ts'

/** `createdAt`/`updatedAt` are real wall-clock timestamps (`nowIso()`), not RNG-derived — two independently-started sessions legitimately differ by a millisecond or two even with identical seeds/actions. Strips them so the RNG-preservation comparisons below check everything that actually MUST match. */
function withoutTimestamps(state: GamePrototypeState): Omit<GamePrototypeState, 'createdAt' | 'updatedAt'> {
  const clone: Partial<GamePrototypeState> = { ...state }
  delete clone.createdAt
  delete clone.updatedAt
  return clone as Omit<GamePrototypeState, 'createdAt' | 'updatedAt'>
}

/** A Map-backed `Storage`-compatible fake — no DOM/jsdom needed for these tests. */
function fakeStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: (key) => { map.delete(key) },
  }
}

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

const PROMISE_IDS = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']

function resolveActiveBillToTerminal(state: GamePrototypeState): GamePrototypeState {
  let s = state
  while (s.activeBill) {
    s = gameReducer(s, { type: 'CALL_VOTE' })
    if (s.activeBill && s.activeBill.status === 'REJECTED') s = gameReducer(s, { type: 'RENEGOTIATE_BILL' })
  }
  return s
}

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

function runBudgetCycleAndOneTurn(state: GamePrototypeState): GamePrototypeState {
  let s = state
  if (s.screen === 'bercyAudit') s = gameReducer(s, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
  s = gameReducer(s, { type: 'SET_BUDGET_TIER', category: 'health', tierId: 'hospitalPlan' })
  s = gameReducer(s, { type: 'SUBMIT_BUDGET' })
  s = resolveActiveBillToTerminal(s)
  s = gameReducer(s, { type: 'PROCEED_TO_REFORM_HUB' })
  s = gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
  s = gameReducer(s, { type: 'ADVANCE_TURN' })
  if (s.screen === 'event' && s.activeEventId) {
    const event = getEventDefinition(s.activeEventId)
    s = gameReducer(s, { type: 'CHOOSE_EVENT', choiceId: event.choices[0].id })
    s = gameReducer(s, { type: 'CONTINUE_AFTER_EVENT' })
  }
  return s
}

describe('saveGame / loadGame (M5 §56)', () => {
  it('round-trips a state exactly via a Map-backed store', () => {
    const store = fakeStore()
    const state = runBudgetCycleAndOneTurn(campaignThrough('save-roundtrip'))
    saveGame(state, store)
    expect(loadGame(store)).toEqual(state)
  })

  it('returns null when there is nothing saved yet', () => {
    expect(loadGame(fakeStore())).toBeNull()
  })

  it('fails safely to null on a version-incompatible save — no migration attempted', () => {
    const store = fakeStore()
    const state = runBudgetCycleAndOneTurn(campaignThrough('version-check'))
    store.setItem('country-run:save-v1', JSON.stringify({ ...state, gameVersion: '0.0.1-not-real' }))
    expect(loadGame(store)).toBeNull()
  })

  it('fails safely to null on corrupt JSON', () => {
    const store = fakeStore()
    store.setItem('country-run:save-v1', '{not valid json')
    expect(loadGame(store)).toBeNull()
  })

  it('a freshly saved game always carries the current GAME_VERSION', () => {
    const store = fakeStore()
    saveGame(createInitialGamePrototypeState(), store)
    const loaded = loadGame(store)
    expect(loaded?.gameVersion).toBe(GAME_VERSION)
  })

  it('clearSave removes a previously saved game', () => {
    const store = fakeStore()
    saveGame(createInitialGamePrototypeState(), store)
    expect(loadGame(store)).not.toBeNull()
    clearSave(store)
    expect(loadGame(store)).toBeNull()
  })

  it('never throws when no store is available (e.g. localStorage absent) — save/load/clear all silently no-op', () => {
    expect(() => { saveGame(createInitialGamePrototypeState()) }).not.toThrow()
    // In this test environment `localStorage` is undefined, so this exercises the "no store" branch.
    expect(loadGame()).toBeNull()
    expect(() => { clearSave() }).not.toThrow()
  })
})

describe('save/reload never alters the RNG sequence (M5 §57 — explicit required test)', () => {
  it('a continuous run and a save/reload-midway run with identical subsequent actions produce byte-identical final states', () => {
    const seed = 'rng-preservation-check'

    // Continuous: play through the campaign, one full budget cycle + turn, then 3 more ADVANCE_TURN calls uninterrupted.
    let continuous = runBudgetCycleAndOneTurn(campaignThrough(seed))
    for (let i = 0; i < 3; i++) continuous = gameReducer(continuous, { type: 'ADVANCE_TURN' })

    // Same up to the same midpoint, then "reload" via a JSON round-trip through a fake store (exactly
    // what happens on an actual page reload), then apply the SAME remaining 3 ADVANCE_TURN actions.
    const midpoint = runBudgetCycleAndOneTurn(campaignThrough(seed))
    const store = fakeStore()
    saveGame(midpoint, store)
    let resumed = loadGame(store)
    if (!resumed) throw new Error('expected a loaded save')
    for (let i = 0; i < 3; i++) resumed = gameReducer(resumed, { type: 'ADVANCE_TURN' })

    expect(withoutTimestamps(resumed)).toEqual(withoutTimestamps(continuous))
  })

  it('holds even across a reform-hub choice made only in the resumed session (same RNG-relevant state either way)', () => {
    const seed = 'rng-preservation-reform-check'

    let continuous = campaignThrough(seed)
    continuous = gameReducer(continuous, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    continuous = gameReducer(continuous, { type: 'SUBMIT_BUDGET' })
    continuous = resolveActiveBillToTerminal(continuous)
    continuous = gameReducer(continuous, { type: 'PROCEED_TO_REFORM_HUB' })
    if (availableReformBills(continuous).some((b) => b.id === 'education-investment-bill')) {
      continuous = gameReducer(continuous, { type: 'PROPOSE_BILL', billId: 'education-investment-bill' })
      continuous = resolveActiveBillToTerminal(continuous)
    } else {
      continuous = gameReducer(continuous, { type: 'BEGIN_TURN_LOOP' })
    }

    // "Reload" right after the budget bill resolves, then make the SAME reform choice in the resumed session.
    let midpoint = campaignThrough(seed)
    midpoint = gameReducer(midpoint, { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' })
    midpoint = gameReducer(midpoint, { type: 'SUBMIT_BUDGET' })
    midpoint = resolveActiveBillToTerminal(midpoint)
    midpoint = gameReducer(midpoint, { type: 'PROCEED_TO_REFORM_HUB' })
    const store = fakeStore()
    saveGame(midpoint, store)
    let resumed = loadGame(store)
    if (!resumed) throw new Error('expected a loaded save')
    if (availableReformBills(resumed).some((b) => b.id === 'education-investment-bill')) {
      resumed = gameReducer(resumed, { type: 'PROPOSE_BILL', billId: 'education-investment-bill' })
      resumed = resolveActiveBillToTerminal(resumed)
    } else {
      resumed = gameReducer(resumed, { type: 'BEGIN_TURN_LOOP' })
    }

    expect(withoutTimestamps(resumed)).toEqual(withoutTimestamps(continuous))
  })
})
