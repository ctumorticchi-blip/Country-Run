import { describe, expect, it } from 'vitest'
import { createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  // Tests need a fixed seed for determinism checks; START_GAME/NEW_GAME pick a random one.
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

const PROMISE_IDS = ['hospital-plan', 'invest-education', 'grand-investment-plan', 'energy-transition', 'build-housing']

const toggles: GameAction[] = PROMISE_IDS.map((promiseId) => ({ type: 'TOGGLE_PROMISE', promiseId }))

const PLAY_THROUGH: GameAction[] = [
  { type: 'START_GAME' },
  { type: 'BEGIN_PROMISE_SELECTION' },
  ...toggles,
  { type: 'CONFIRM_PROMISES' },
  { type: 'PROCEED_TO_ELECTION' },
  { type: 'VIEW_FRANCE_BRIEFING' },
  { type: 'PROCEED_TO_GOVERNMENT' },
  { type: 'CHOOSE_GOVERNMENT', profileId: 'reformateurs' },
  { type: 'VIEW_PARLIAMENT_COMPOSITION' },
  { type: 'PROCEED_TO_MANDATE_START' },
  { type: 'BEGIN_MANDATE' },
  { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' },
  { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' },
  { type: 'SET_BUDGET_LEVEL', category: 'health', level: 'invest' },
  { type: 'SET_BUDGET_LEVEL', category: 'education', level: 'invest' },
  { type: 'SUBMIT_BUDGET' },
  { type: 'CHOOSE_PARLIAMENT_VOTE', choiceId: 'negotiate' },
]

function runThrough(seed: string, actions: GameAction[] = PLAY_THROUGH): GamePrototypeState {
  let state = withSeed(createInitialGamePrototypeState(), seed)
  for (const action of actions) {
    state = gameReducer(state, action)
  }
  return state
}

function budgetPlaythrough(
  bercyChoiceId: string,
  energyChoiceId: string,
  level: 'invest' | 'cut',
  parliamentChoiceId: 'negotiate' | 'maintain' | 'concede',
): GameAction[] {
  return [
    { type: 'START_GAME' },
    { type: 'BEGIN_PROMISE_SELECTION' },
    ...toggles,
    { type: 'CONFIRM_PROMISES' },
    { type: 'PROCEED_TO_ELECTION' },
    { type: 'VIEW_FRANCE_BRIEFING' },
    { type: 'PROCEED_TO_GOVERNMENT' },
    { type: 'CHOOSE_GOVERNMENT', profileId: 'experts' },
    { type: 'VIEW_PARLIAMENT_COMPOSITION' },
    { type: 'PROCEED_TO_MANDATE_START' },
    { type: 'BEGIN_MANDATE' },
    { type: 'CHOOSE_BERCY', choiceId: bercyChoiceId },
    { type: 'CHOOSE_ENERGY', choiceId: energyChoiceId },
    { type: 'SET_BUDGET_LEVEL', category: 'health', level },
    { type: 'SET_BUDGET_LEVEL', category: 'education', level },
    { type: 'SET_BUDGET_LEVEL', category: 'investment', level },
    { type: 'SET_BUDGET_LEVEL', category: 'defense', level },
    { type: 'SUBMIT_BUDGET' },
    { type: 'CHOOSE_PARLIAMENT_VOTE', choiceId: parliamentChoiceId },
  ]
}

describe('gameReducer — screen transitions', () => {
  it('starts on the landing screen', () => {
    expect(createInitialGamePrototypeState().screen).toBe('landing')
  })

  it('walks through every screen in order for a full playthrough', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'flow-check')
    const seenScreens: string[] = [state.screen]
    for (const action of PLAY_THROUGH) {
      state = gameReducer(state, action)
      seenScreens.push(state.screen)
    }
    expect(seenScreens).toEqual([
      'landing',
      'campaignIntro',
      'promiseSelection',
      'promiseSelection',
      'promiseSelection',
      'promiseSelection',
      'promiseSelection',
      'promiseSelection',
      'promiseConfirmation',
      'election',
      'franceBriefing',
      'governmentSelection',
      'legislativeElection',
      'parliamentComposition',
      'mandateStart',
      'bercyAudit',
      'energyShock',
      'budgetBuilder',
      'budgetBuilder', // SET_BUDGET_LEVEL x2 stays on the same screen
      'budgetBuilder',
      'parliamentVote',
      'yearReport',
    ])
  })

  it('SET_BUDGET_LEVEL never touches the economic simulation, only the draft selection', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'draft-check')
    for (const action of PLAY_THROUGH.slice(0, PLAY_THROUGH.length - 4)) state = gameReducer(state, action) // through CHOOSE_ENERGY
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
    expect(state.choices.selectedPromiseIds).toBe(beforeExtra) // unchanged reference — true no-op
  })

  it('unselecting a promise frees a slot for a different one', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'promise-swap-check')
    state = gameReducer(state, { type: 'START_GAME' })
    state = gameReducer(state, { type: 'BEGIN_PROMISE_SELECTION' })
    for (const action of toggles) state = gameReducer(state, action)
    state = gameReducer(state, { type: 'TOGGLE_PROMISE', promiseId: PROMISE_IDS[0] })
    state = gameReducer(state, { type: 'TOGGLE_PROMISE', promiseId: 'reduce-debt' })
    expect(state.choices.selectedPromiseIds).toHaveLength(5)
    expect(state.choices.selectedPromiseIds).not.toContain(PROMISE_IDS[0])
    expect(state.choices.selectedPromiseIds).toContain('reduce-debt')
  })

  it('CONFIRM_PROMISES is a no-op without exactly 5 selected', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'incomplete-confirm-check')
    state = gameReducer(state, { type: 'START_GAME' })
    state = gameReducer(state, { type: 'BEGIN_PROMISE_SELECTION' })
    state = gameReducer(state, { type: 'TOGGLE_PROMISE', promiseId: 'reduce-debt' })
    state = gameReducer(state, { type: 'CONFIRM_PROMISES' })
    expect(state.screen).toBe('promiseSelection')
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

describe('gameReducer — campaign outcomes', () => {
  it('produces a bounded election score, computed at PROCEED_TO_ELECTION', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'election-check')
    for (const action of PLAY_THROUGH.slice(0, 9)) state = gameReducer(state, action) // through PROCEED_TO_ELECTION
    expect(state.electionResult).not.toBeNull()
    expect(state.electionResult?.scorePct).toBeGreaterThanOrEqual(50.5)
    expect(state.electionResult?.scorePct).toBeLessThanOrEqual(54)
  })

  it('CHOOSE_GOVERNMENT computes a Parliament totaling exactly 577 seats and a bounded political capital', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'government-check')
    for (const action of PLAY_THROUGH.slice(0, 12)) state = gameReducer(state, action) // through CHOOSE_GOVERNMENT
    expect(state.parliamentComposition).not.toBeNull()
    const total = state.parliamentComposition?.blocs.reduce((sum, bloc) => sum + bloc.seats, 0)
    expect(total).toBe(577)
    expect(state.politicalCapital).toBeGreaterThanOrEqual(0)
    expect(state.politicalCapital).toBeLessThanOrEqual(100)
  })

  it('different campaign choices (government profile) produce a different Parliament for the same seed', () => {
    let base = withSeed(createInitialGamePrototypeState(), 'gov-branch-check')
    for (const action of PLAY_THROUGH.slice(0, 11)) base = gameReducer(base, action) // through PROCEED_TO_GOVERNMENT
    const a = gameReducer(base, { type: 'CHOOSE_GOVERNMENT', profileId: 'experts' })
    const b = gameReducer(base, { type: 'CHOOSE_GOVERNMENT', profileId: 'politiques' })
    expect(a.parliamentComposition?.playerSeats).not.toBe(b.parliamentComposition?.playerSeats)
  })
})

describe('gameReducer — CHOOSE_PARLIAMENT_VOTE advances the simulation exactly once', () => {
  it('runs exactly one year (6 turns) worth of simulation, not zero and not more', () => {
    const state = runThrough('single-advance-check')
    expect(state.gameState.meta.turn).toBe(6)
  })

  it('is pure: dispatching the same (state, action) pair twice — as React StrictMode would — yields identical results', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'strict-mode-reducer-check')
    for (const action of PLAY_THROUGH.slice(0, PLAY_THROUGH.length - 1)) state = gameReducer(state, action) // up to and including SUBMIT_BUDGET

    const action: GameAction = { type: 'CHOOSE_PARLIAMENT_VOTE', choiceId: 'negotiate' }
    const first = gameReducer(state, action)
    const second = gameReducer(state, action) // simulates StrictMode calling the reducer twice with the same input

    expect(first).toEqual(second)
  })

  it('produces a score, an ending title, and a parliament outcome', () => {
    const state = runThrough('report-fields-check')
    expect(state.scoreBreakdown).not.toBeNull()
    expect(state.endingTitle).not.toBeNull()
    expect(state.parliamentOutcome === 'adopted' || state.parliamentOutcome === 'rejected').toBe(true)
  })

  it('keeps popularity within [0, 100] after a full playthrough', () => {
    const state = runThrough('popularity-bounds-check')
    expect(state.gameState.political.popularity).toBeGreaterThanOrEqual(0)
    expect(state.gameState.political.popularity).toBeLessThanOrEqual(100)
  })

  it('keeps the score within [0, 10000]', () => {
    const state = runThrough('score-bounds-check')
    expect(state.scoreBreakdown?.total).toBeGreaterThanOrEqual(0)
    expect(state.scoreBreakdown?.total).toBeLessThanOrEqual(10000)
  })

  it('logs a policyHistory entry for the Bercy, energy, each budget category, and the Parliament vote', () => {
    const state = runThrough('history-check')
    const sourceIds = state.policyHistory.map((e) => e.sourceId)
    expect(sourceIds.some((id) => id.startsWith('bercy:'))).toBe(true)
    expect(sourceIds.some((id) => id.startsWith('energy:'))).toBe(true)
    expect(sourceIds.filter((id) => id.startsWith('budget:'))).toHaveLength(4)
    expect(sourceIds.some((id) => id.startsWith('parliament-vote:'))).toBe(true)
  })
})

describe('gameReducer — determinism / replay', () => {
  it('the same seed and the same choices reproduce an identical final state', () => {
    const a = runThrough('determinism-check')
    const b = runThrough('determinism-check')
    expect(a.gameState).toEqual(b.gameState)
    expect(a.scoreBreakdown).toEqual(b.scoreBreakdown)
    expect(a.parliamentComposition).toEqual(b.parliamentComposition)
    expect(a.electionResult).toEqual(b.electionResult)
  })

  it('a different seed can produce a different final state for the same choices', () => {
    const a = runThrough('seed-a')
    const b = runThrough('seed-b')
    expect(a.gameState.economic).not.toEqual(b.gameState.economic)
  })

  it('different budget choices produce a different outcome for the same seed', () => {
    const spender = runThrough('branch-check', budgetPlaythrough('assume-deficit', 'energy-shield', 'invest', 'concede'))
    const austerity = runThrough('branch-check', budgetPlaythrough('find-savings', 'let-prices-adjust', 'cut', 'maintain'))
    expect(spender.gameState.economic.debtRatio).not.toBeCloseTo(austerity.gameState.economic.debtRatio, 0)
  })

  it('REPLAY_SAME_SEED resets to the bercy audit screen with the same seed, campaign choices and a fresh turn 0 state', () => {
    const played = runThrough('replay-check')
    const replayed = gameReducer(played, { type: 'REPLAY_SAME_SEED' })
    expect(replayed.screen).toBe('bercyAudit')
    expect(replayed.seed).toBe(played.seed)
    expect(replayed.gameState.meta.turn).toBe(0)
    expect(replayed.scoreBreakdown).toBeNull()
    expect(replayed.choices.selectedPromiseIds).toEqual(played.choices.selectedPromiseIds)
    expect(replayed.choices.governmentProfileId).toBe(played.choices.governmentProfileId)
    expect(replayed.parliamentComposition).toEqual(played.parliamentComposition)
  })

  it('replaying twice from the same played state reproduces an identical outcome', () => {
    const played = runThrough('replay-determinism-check')
    const replayedA = gameReducer(played, { type: 'REPLAY_SAME_SEED' })
    const replayedB = gameReducer(played, { type: 'REPLAY_SAME_SEED' })
    expect(replayedA).toEqual(replayedB)
  })

  it('NEW_GAME resets to the landing screen with a different seed and clears campaign choices', () => {
    const played = runThrough('new-game-check')
    const restarted = gameReducer(played, { type: 'NEW_GAME' })
    expect(restarted.screen).toBe('landing')
    expect(restarted.seed).not.toBe(played.seed)
    expect(restarted.gameState.meta.turn).toBe(0)
    expect(restarted.choices.selectedPromiseIds).toEqual([])
    expect(restarted.choices.governmentProfileId).toBeNull()
  })
})

describe('gameReducer — serializable state (M3 §28)', () => {
  it('the full state survives a JSON round-trip unchanged', () => {
    const state = runThrough('serialization-check')
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
