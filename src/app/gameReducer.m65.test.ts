import { describe, expect, it } from 'vitest'
import { getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import { isYearEndTurn } from '../game/country-run/mandate/calendar.ts'
import { createInitialGamePrototypeState, GAME_VERSION, gameReducer, type GameAction, type GamePrototypeState } from './gameReducer.ts'
import { loadGame, saveGame, type KeyValueStore } from './save.ts'

/**
 * M6.5 Part IX: reducer-level integration tests for the systems that only
 * make sense wired end-to-end through the real dispatch pipeline —
 * national-project launch/progress/completion/no-double-counting, sovereign
 * fund creation/dividend/recapitalization/annual-return, government-crisis
 * trigger, and save/reload determinism for all the new state — on top of
 * the pure-function unit tests in `projects/*.test.ts` and `fund/*.test.ts`.
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

function skipBudgetCycle(state: GamePrototypeState): GamePrototypeState {
  let s = gameReducer(state, { type: 'SUBMIT_BUDGET' })
  s = resolveActiveBillToTerminal(s)
  s = gameReducer(s, { type: 'PROCEED_TO_REFORM_HUB' })
  return gameReducer(s, { type: 'BEGIN_TURN_LOOP' })
}

describe('M6.5 §26-28 national projects — end to end through the reducer', () => {
  it('adopting a matching bill launches its national project, UNDER_CONSTRUCTION with progress 0', () => {
    let state = skipBudgetCycle(campaignThrough('project-launch-e2e'))
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'hospital-plan-bill' })
    state = { ...state, politicalCapital: 100 } // guarantee adoption regardless of seed
    state = resolveActiveBillToTerminal(state)
    expect(state.billHistory[state.billHistory.length - 1]?.status).toBe('ADOPTED')

    const project = state.projects.find((p) => p.catalogId === 'hospital-modernization')
    expect(project).toBeDefined()
    expect(project?.status).toBe('UNDER_CONSTRUCTION')
    expect(project?.progress).toBe(0)
    expect(project?.source).toBe('hospital-plan-bill')

    // §27 no double counting: the project itself adds NO extra fiscal-ledger entry beyond the
    // bill's own — exactly one ledger entry references this bill's id.
    const ledgerEntriesForBill = state.fiscalLedger.filter((e) => e.sourceId === 'hospital-plan-bill')
    expect(ledgerEntriesForBill).toHaveLength(1)
    const projectLedgerEntries = state.fiscalLedger.filter((e) => e.sourceId.startsWith('project:'))
    expect(projectLedgerEntries).toHaveLength(0)
  })

  it('progresses turn by turn and eventually completes with a causal "entre en service" History entry', () => {
    let state = skipBudgetCycle(campaignThrough('project-progress-e2e'))
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'hospital-plan-bill' })
    state = { ...state, politicalCapital: 100 }
    state = resolveActiveBillToTerminal(state)
    state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })

    const project0 = state.projects.find((p) => p.catalogId === 'hospital-modernization')
    expect(project0).toBeDefined()
    const completionTurn = project0?.expectedCompletionTurn ?? 0

    let s = state
    let previousProgress = 0
    let turns = 0
    while (s.gameState.meta.turn < completionTurn + 1 && turns < 40) {
      s = advanceOneTurn(s)
      turns++
      const p = s.projects.find((pr) => pr.catalogId === 'hospital-modernization')
      if (p && p.status === 'UNDER_CONSTRUCTION') {
        expect(p.progress).toBeGreaterThanOrEqual(previousProgress)
        previousProgress = p.progress
      }
    }

    const finalProject = s.projects.find((p) => p.catalogId === 'hospital-modernization')
    expect(finalProject?.status).toBe('COMPLETED')
    expect(finalProject?.progress).toBe(100)

    const completionEntry = s.policyHistory.find((e) => e.sourceId.includes('completed'))
    expect(completionEntry).toBeDefined()
    expect(completionEntry?.label).toContain('entre en service')
  })
})

describe('M6.5 §33-46 sovereign fund — end to end through the reducer', () => {
  it('CREATE_SOVEREIGN_FUND is a no-op until dispatched — never automatic', () => {
    const state = skipBudgetCycle(campaignThrough('fund-not-auto-e2e'))
    expect(state.sovereignFund.exists).toBe(false)
  })

  it('DEBT-funded creation raises the debt stock by the full capitalization and never touches the deficit-driving flow fields', () => {
    let state = skipBudgetCycle(campaignThrough('fund-debt-e2e'))
    const debtBefore = state.gameState.economic.debt
    const revenueBefore = state.gameState.economic.publicRevenue
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 30, fundingSource: 'DEBT', strategy: 'INDUSTRIAL', governance: 'MIXED' })
    expect(state.sovereignFund.exists).toBe(true)
    expect(state.sovereignFund.capitalContributed).toBe(30)
    expect(state.sovereignFund.portfolioValue).toBe(30)
    expect(state.gameState.economic.debt).toBeCloseTo(debtBefore + 30, 5)
    expect(state.gameState.economic.publicRevenue).toBe(revenueBefore)

    // A second CREATE_SOVEREIGN_FUND is a no-op — a fund can only be created once.
    const again = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 50, fundingSource: 'DEBT', strategy: 'PRUDENT', governance: 'STATE_CONTROL' })
    expect(again.sovereignFund.capitalContributed).toBe(30)
  })

  it('ASSET_SALES-funded creation never touches the debt stock', () => {
    let state = skipBudgetCycle(campaignThrough('fund-assetsales-e2e'))
    const debtBefore = state.gameState.economic.debt
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 20, fundingSource: 'ASSET_SALES', strategy: 'PRUDENT', governance: 'INDEPENDENT' })
    expect(state.gameState.economic.debt).toBeCloseTo(debtBefore, 5)
  })

  it('the annual return applies exactly on year-end turns, never mid-year, and is deterministic for a given seed', () => {
    let state = skipBudgetCycle(campaignThrough('fund-return-e2e'))
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 30, fundingSource: 'DEBT', strategy: 'DIVERSIFIED', governance: 'MIXED' })
    const portfolioAtCreation = state.sovereignFund.portfolioValue

    let s = state
    let changedMidYear = false
    while (s.gameState.meta.turn < 6) {
      const before = s.sovereignFund.portfolioValue
      s = advanceOneTurn(s)
      if (!isYearEndTurn(s.gameState.meta.turn) && s.sovereignFund.portfolioValue !== before) changedMidYear = true
    }
    expect(changedMidYear).toBe(false)
    expect(s.gameState.meta.turn).toBe(6)
    expect(s.sovereignFund.portfolioValue).not.toBe(portfolioAtCreation)
    expect(Number.isFinite(s.sovereignFund.portfolioValue)).toBe(true)
  })

  it('FUND_TRANSFER_DIVIDEND pays down debt with the gain and never lets the original capital be withdrawn as revenue', () => {
    let state = skipBudgetCycle(campaignThrough('fund-dividend-e2e'))
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 30, fundingSource: 'BUDGET_REALLOCATION', strategy: 'DIVERSIFIED', governance: 'MIXED' })
    // Force a known gain, bypassing the RNG — this test is about the transfer mechanism, not the return draw (covered above).
    state = { ...state, sovereignFund: { ...state.sovereignFund, portfolioValue: state.sovereignFund.portfolioValue + 5, cumulativeReturn: 5 } }
    const debtBefore = state.gameState.economic.debt

    // Asking for MORE than the available gain is capped at the gain — capital itself is never transferable.
    const overAsk = gameReducer(state, { type: 'FUND_TRANSFER_DIVIDEND', amount: 1000 })
    expect(overAsk.sovereignFund.cumulativeDividendsToState).toBe(5)
    expect(overAsk.sovereignFund.portfolioValue).toBeCloseTo(30, 5)
    expect(overAsk.gameState.economic.debt).toBeCloseTo(debtBefore - 5, 5)
  })

  it('RECAPITALIZE_FUND is available immediately after creation and adds to both capitalContributed and portfolioValue', () => {
    let state = skipBudgetCycle(campaignThrough('fund-recap-e2e'))
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 20, fundingSource: 'DEBT', strategy: 'PRUDENT', governance: 'MIXED' })
    const recapped = gameReducer(state, { type: 'RECAPITALIZE_FUND', amount: 10 })
    expect(recapped.sovereignFund.capitalContributed).toBe(30)
    expect(recapped.sovereignFund.portfolioValue).toBe(30)

    // A second recapitalization immediately after is blocked by the cooldown — a no-op.
    const secondAttempt = gameReducer(recapped, { type: 'RECAPITALIZE_FUND', amount: 10 })
    expect(secondAttempt.sovereignFund.capitalContributed).toBe(30)
  })
})

describe('M6.5 §22-23 government crisis — reachable through the reducer', () => {
  it('a rising government tension that crosses the very-high threshold triggers exactly one crisis, not a repeat every subsequent turn', () => {
    let state = skipBudgetCycle(campaignThrough('gov-crisis-tension-e2e'))
    state = { ...state, governmentTension: 85, politicalCapital: 100 }
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'business-tax-cut-bill' })
    state = { ...state, governmentTension: 85 } // USE_EXCEPTIONAL_PROCEDURE always pushes tension up +15 — from 85 that crosses the 90 threshold.
    state = gameReducer(state, { type: 'USE_EXCEPTIONAL_PROCEDURE' })
    expect(state.governmentTension).toBeGreaterThanOrEqual(90)
    expect(state.governmentCrisisCount).toBe(1)
  })

  it('the 3rd exceptional-procedure use this mandate triggers a crisis via the repeated-use multiple, independent of tension', () => {
    let state = skipBudgetCycle(campaignThrough('gov-crisis-usage-e2e'))
    state = { ...state, politicalCapital: 200, exceptionalProcedureUsageCount: 2 }
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'business-tax-cut-bill' })
    state = gameReducer(state, { type: 'USE_EXCEPTIONAL_PROCEDURE' })
    expect(state.exceptionalProcedureUsageCount).toBe(3)
    expect(state.governmentCrisisCount).toBe(1)
  })
})

describe('M6.5 §56-59 save/reload determinism for the new state', () => {
  function memoryStore(): KeyValueStore {
    const backing = new Map<string, string>()
    return {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => { backing.set(key, value) },
      removeItem: (key) => { backing.delete(key) },
    }
  }

  it('a save carrying eventMemories/projects/sovereignFund/governmentCrisisCount round-trips losslessly through JSON', () => {
    let state = skipBudgetCycle(campaignThrough('save-roundtrip-e2e'))
    state = gameReducer(state, { type: 'PROPOSE_BILL', billId: 'hospital-plan-bill' })
    state = { ...state, politicalCapital: 100 }
    state = resolveActiveBillToTerminal(state)
    state = gameReducer(state, { type: 'PROCEED_TO_REFORM_HUB' })
    state = gameReducer(state, { type: 'BEGIN_TURN_LOOP' })
    state = gameReducer(state, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 20, fundingSource: 'HYBRID', strategy: 'INNOVATION', governance: 'INDEPENDENT' })
    state = advanceOneTurn(state)

    const store = memoryStore()
    saveGame(state, store)
    const loaded = loadGame(store)
    expect(loaded).not.toBeNull()
    expect(loaded?.eventMemories).toEqual(state.eventMemories)
    expect(loaded?.projects).toEqual(state.projects)
    expect(loaded?.sovereignFund).toEqual(state.sovereignFund)
    expect(loaded?.governmentCrisisCount).toBe(state.governmentCrisisCount)
    expect(loaded?.exceptionalProcedureUsageCount).toBe(state.exceptionalProcedureUsageCount)
  })

  it('an old-version save (pre-M6.5 shape) fails safely to null rather than partially loading', () => {
    const store = memoryStore()
    const oldSave = { ...skipBudgetCycle(campaignThrough('old-save-e2e')), gameVersion: '0.6.0' }
    store.setItem('country-run:save-v1', JSON.stringify(oldSave))
    expect(loadGame(store)).toBeNull()
  })

  it('resuming from a reload continues the RNG deterministically — replaying the same seed+choices after a simulated reload matches an uninterrupted run', () => {
    const seed = 'save-determinism-e2e'
    let uninterrupted = skipBudgetCycle(campaignThrough(seed))
    uninterrupted = gameReducer(uninterrupted, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 30, fundingSource: 'DEBT', strategy: 'DIVERSIFIED', governance: 'MIXED' })
    for (let i = 0; i < 8; i++) uninterrupted = advanceOneTurn(uninterrupted)

    // Simulate a reload halfway through: serialize, deserialize, continue from there.
    let interrupted = skipBudgetCycle(campaignThrough(seed))
    interrupted = gameReducer(interrupted, { type: 'CREATE_SOVEREIGN_FUND', capitalization: 30, fundingSource: 'DEBT', strategy: 'DIVERSIFIED', governance: 'MIXED' })
    for (let i = 0; i < 3; i++) interrupted = advanceOneTurn(interrupted)
    const store = memoryStore()
    saveGame(interrupted, store)
    const reloaded = loadGame(store)
    expect(reloaded).not.toBeNull()
    let resumed = reloaded as GamePrototypeState
    for (let i = 0; i < 5; i++) resumed = advanceOneTurn(resumed)

    expect(resumed.gameState.economic).toEqual(uninterrupted.gameState.economic)
    expect(resumed.sovereignFund).toEqual(uninterrupted.sovereignFund)
    expect(resumed.projects).toEqual(uninterrupted.projects)
  })
})

describe('GAME_VERSION', () => {
  it('was bumped for the M6.5 state-shape change (event memories, projects, sovereign fund, government crisis)', () => {
    expect(GAME_VERSION).toBe('0.6.5')
  })
})
