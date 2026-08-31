import { describe, expect, it } from 'vitest'
import { createInitialGamePrototypeState, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'

function withSeed(state: GamePrototypeState, seed: string): GamePrototypeState {
  // Tests need a fixed seed for determinism checks; START_GAME/NEW_GAME pick a random one.
  return { ...state, seed, gameState: { ...state.gameState, meta: { ...state.gameState.meta, seed } } }
}

const PLAY_THROUGH: GameAction[] = [
  { type: 'START_GAME' },
  { type: 'ENTER_ELYSEE' },
  { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' },
  { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' },
  { type: 'SET_BUDGET_LEVEL', category: 'health', level: 'invest' },
  { type: 'SET_BUDGET_LEVEL', category: 'education', level: 'invest' },
  { type: 'SUBMIT_BUDGET' },
  { type: 'CHOOSE_PARLIAMENT', choiceId: 'negotiate' },
]

function runThrough(seed: string, actions: GameAction[] = PLAY_THROUGH): GamePrototypeState {
  let state = withSeed(createInitialGamePrototypeState(), seed)
  for (const action of actions) {
    state = gameReducer(state, action)
  }
  return state
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
      'election',
      'bercyAudit',
      'energyShock',
      'budgetBuilder',
      'budgetBuilder', // SET_BUDGET_LEVEL x2 stays on the same screen
      'budgetBuilder',
      'parliament',
      'yearReport',
    ])
  })

  it('SET_BUDGET_LEVEL never touches the economic simulation, only the draft selection', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'draft-check')
    for (const action of PLAY_THROUGH.slice(0, 4)) state = gameReducer(state, action) // through CHOOSE_ENERGY
    const turnBefore = state.gameState.meta.turn
    state = gameReducer(state, { type: 'SET_BUDGET_LEVEL', category: 'investment', level: 'invest' })
    expect(state.gameState.meta.turn).toBe(turnBefore)
    expect(state.choices.budgetSelections.investment).toBe('invest')
  })
})

describe('gameReducer — CHOOSE_PARLIAMENT advances the simulation exactly once', () => {
  it('runs exactly one year (6 turns) worth of simulation, not zero and not more', () => {
    const state = runThrough('single-advance-check')
    expect(state.gameState.meta.turn).toBe(6)
  })

  it('is pure: dispatching the same (state, action) pair twice — as React StrictMode would — yields identical results', () => {
    let state = withSeed(createInitialGamePrototypeState(), 'strict-mode-reducer-check')
    for (const action of PLAY_THROUGH.slice(0, 7)) state = gameReducer(state, action) // up to and including SUBMIT_BUDGET

    const action: GameAction = { type: 'CHOOSE_PARLIAMENT', choiceId: 'negotiate' }
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
})

describe('gameReducer — determinism / replay', () => {
  it('the same seed and the same choices reproduce an identical final state', () => {
    const a = runThrough('determinism-check')
    const b = runThrough('determinism-check')
    expect(a.gameState).toEqual(b.gameState)
    expect(a.scoreBreakdown).toEqual(b.scoreBreakdown)
  })

  it('a different seed can produce a different final state for the same choices', () => {
    const a = runThrough('seed-a')
    const b = runThrough('seed-b')
    expect(a.gameState.economic).not.toEqual(b.gameState.economic)
  })

  it('different budget choices produce a different outcome for the same seed', () => {
    const spender = runThrough('branch-check', [
      { type: 'START_GAME' },
      { type: 'ENTER_ELYSEE' },
      { type: 'CHOOSE_BERCY', choiceId: 'assume-deficit' },
      { type: 'CHOOSE_ENERGY', choiceId: 'energy-shield' },
      { type: 'SET_BUDGET_LEVEL', category: 'health', level: 'invest' },
      { type: 'SET_BUDGET_LEVEL', category: 'education', level: 'invest' },
      { type: 'SET_BUDGET_LEVEL', category: 'investment', level: 'invest' },
      { type: 'SET_BUDGET_LEVEL', category: 'defense', level: 'invest' },
      { type: 'SUBMIT_BUDGET' },
      { type: 'CHOOSE_PARLIAMENT', choiceId: 'concede' },
    ])
    const austerity = runThrough('branch-check', [
      { type: 'START_GAME' },
      { type: 'ENTER_ELYSEE' },
      { type: 'CHOOSE_BERCY', choiceId: 'find-savings' },
      { type: 'CHOOSE_ENERGY', choiceId: 'let-prices-adjust' },
      { type: 'SET_BUDGET_LEVEL', category: 'health', level: 'cut' },
      { type: 'SET_BUDGET_LEVEL', category: 'education', level: 'cut' },
      { type: 'SET_BUDGET_LEVEL', category: 'investment', level: 'cut' },
      { type: 'SET_BUDGET_LEVEL', category: 'defense', level: 'cut' },
      { type: 'SUBMIT_BUDGET' },
      { type: 'CHOOSE_PARLIAMENT', choiceId: 'maintain' },
    ])
    expect(spender.gameState.economic.debtRatio).not.toBeCloseTo(austerity.gameState.economic.debtRatio, 0)
  })

  it('REPLAY_SAME_SEED resets to the bercy audit screen with the same seed and a fresh turn 0 state', () => {
    const played = runThrough('replay-check')
    const replayed = gameReducer(played, { type: 'REPLAY_SAME_SEED' })
    expect(replayed.screen).toBe('bercyAudit')
    expect(replayed.seed).toBe(played.seed)
    expect(replayed.gameState.meta.turn).toBe(0)
    expect(replayed.scoreBreakdown).toBeNull()
  })

  it('NEW_GAME resets to the landing screen with a different seed', () => {
    const played = runThrough('new-game-check')
    const restarted = gameReducer(played, { type: 'NEW_GAME' })
    expect(restarted.screen).toBe('landing')
    expect(restarted.seed).not.toBe(played.seed)
    expect(restarted.gameState.meta.turn).toBe(0)
  })
})
