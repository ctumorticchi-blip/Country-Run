import { applyEffect } from '../engine/effects/apply.ts'
import type { EconomicPolicyInput, ExternalShock, WorldState } from '../engine/economy/types.ts'
import type { EconomicState, GameState } from '../engine/state/gameState.ts'
import { budgetSelectionsToPolicyDelta } from '../game/country-run/budget/budgetEffects.ts'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetCategoryId, type BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import { createInitialGameState } from '../game/country-run/data/initialState.ts'
import { createInitialWorldState } from '../game/country-run/data/initialWorldState.ts'
import { BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import { COMPROMISE_SCALE_ON_REJECTION, getParliamentChoice, resolveParliamentVote } from '../game/country-run/prototype/parliament.ts'
import { popularityFromBudget, popularityFromParliamentOutcome, popularityFromYearEndOutcomes } from '../game/country-run/prototype/popularity.ts'
import { createActionRng } from '../game/country-run/prototype/rng.ts'
import { computeEndingTitle, computeScore, type EndingTitle, type ScoreBreakdown } from '../game/country-run/prototype/scoring.ts'
import type { DecisionConfig, ParliamentChoiceConfig, ParliamentOutcome, PlayerChoices, ScreenId } from '../game/country-run/prototype/types.ts'
import { mergePolicyDeltas, scalePolicyInput, simulateYearOne } from '../game/country-run/prototype/yearOneFlow.ts'

/**
 * Generates a fresh seed string for a brand-new playthrough. This is the
 * ONE place a non-deterministic source (`crypto.randomUUID`, with a
 * `Math.random` fallback for older browsers) is allowed: picking WHICH
 * seed a new game starts from is inherently a one-off, player-facing
 * "new game" choice, not part of the deterministic simulation itself. From
 * this point on, every random draw inside the simulation goes through
 * `SeededRng` via `createActionRng` — never `Math.random()` — so the same
 * seed always replays identically (see rng.ts).
 */
function generateSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `seed-${String(Date.now())}-${String(Math.random()).slice(2)}`
}

export interface GamePrototypeState {
  screen: ScreenId
  seed: string
  gameState: GameState
  worldState: WorldState
  /** Captured once at game start (turn 0) — the fixed baseline the Year 1 report compares against. */
  initialEconomicSnapshot: EconomicState
  initialPopularity: number
  choices: PlayerChoices
  parliamentOutcome: ParliamentOutcome | null
  scoreBreakdown: ScoreBreakdown | null
  endingTitle: EndingTitle | null
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'ENTER_ELYSEE' }
  | { type: 'CHOOSE_BERCY'; choiceId: string }
  | { type: 'CHOOSE_ENERGY'; choiceId: string }
  | { type: 'SET_BUDGET_LEVEL'; category: BudgetCategoryId; level: BudgetLevel }
  | { type: 'SUBMIT_BUDGET' }
  | { type: 'CHOOSE_PARLIAMENT'; choiceId: ParliamentChoiceConfig['id'] }
  | { type: 'REPLAY_SAME_SEED' }
  | { type: 'NEW_GAME' }

function findDecisionChoice(decision: DecisionConfig, choiceId: string) {
  const choice = decision.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error(`Unknown decision choice: ${choiceId}`)
  return choice
}

function freshRunState(seed: string, screen: ScreenId): GamePrototypeState {
  const gameState = createInitialGameState(seed)
  return {
    screen,
    seed,
    gameState,
    worldState: createInitialWorldState(),
    initialEconomicSnapshot: gameState.economic,
    initialPopularity: gameState.political.popularity,
    choices: { bercyChoiceId: null, energyChoiceId: null, budgetSelections: { ...NEUTRAL_BUDGET_SELECTIONS }, parliamentChoiceId: null },
    parliamentOutcome: null,
    scoreBreakdown: null,
    endingTitle: null,
  }
}

export function createInitialGamePrototypeState(): GamePrototypeState {
  return freshRunState(generateSeed(), 'landing')
}

/** Adds a bounded popularity/credibility nudge to `political`, via the generic engine's own Effect system (see engine/effects). */
function nudgePolitical(state: GameState, popularityDelta: number, credibilityDelta = 0): GameState {
  let next = applyEffect(state, { type: 'add', path: 'political.popularity', value: popularityDelta, min: 0, max: 100 })
  if (credibilityDelta !== 0) {
    next = applyEffect(next, { type: 'add', path: 'political.politicalCredibility', value: credibilityDelta, min: 0, max: 100 })
  }
  return next
}

/**
 * The single reducer driving the whole Year 1 vertical slice. Pure: given
 * the same state and action, always returns the same next state — this is
 * what makes it safe under React's `<StrictMode>` double-invoke (see
 * rng.ts for the full RNG-safety rationale). The heavy lift —
 * `CHOOSE_PARLIAMENT` — is the only action that actually advances the
 * economic simulation, and it does so exactly once per dispatch.
 */
export function gameReducer(state: GamePrototypeState, action: GameAction): GamePrototypeState {
  switch (action.type) {
    case 'START_GAME':
      return { ...state, screen: 'election' }

    case 'ENTER_ELYSEE':
      return { ...state, screen: 'bercyAudit' }

    case 'CHOOSE_BERCY': {
      const choice = findDecisionChoice(BERCY_AUDIT, action.choiceId)
      return {
        ...state,
        screen: 'energyShock',
        gameState: nudgePolitical(state.gameState, choice.popularityDelta, choice.credibilityDelta ?? 0),
        choices: { ...state.choices, bercyChoiceId: choice.id },
      }
    }

    case 'CHOOSE_ENERGY': {
      const choice = findDecisionChoice(ENERGY_SHOCK, action.choiceId)
      return {
        ...state,
        screen: 'budgetBuilder',
        gameState: nudgePolitical(state.gameState, choice.popularityDelta),
        choices: { ...state.choices, energyChoiceId: choice.id },
      }
    }

    case 'SET_BUDGET_LEVEL':
      return {
        ...state,
        choices: { ...state.choices, budgetSelections: { ...state.choices.budgetSelections, [action.category]: action.level } },
      }

    case 'SUBMIT_BUDGET':
      return { ...state, screen: 'parliament' }

    case 'CHOOSE_PARLIAMENT':
      return resolveParliamentAndSimulate(state, action.choiceId)

    case 'REPLAY_SAME_SEED':
      return freshRunState(state.seed, 'bercyAudit')

    case 'NEW_GAME':
      return freshRunState(generateSeed(), 'landing')
  }
}

function resolveParliamentAndSimulate(state: GamePrototypeState, choiceId: ParliamentChoiceConfig['id']): GamePrototypeState {
  const parliamentChoice = getParliamentChoice(choiceId)
  const bercyChoice = state.choices.bercyChoiceId ? findDecisionChoice(BERCY_AUDIT, state.choices.bercyChoiceId) : null
  const energyChoice = state.choices.energyChoiceId ? findDecisionChoice(ENERGY_SHOCK, state.choices.energyChoiceId) : null

  const budgetDelta = budgetSelectionsToPolicyDelta(state.choices.budgetSelections)
  let policy: EconomicPolicyInput = mergePolicyDeltas(
    bercyChoice?.policyDelta ?? {},
    energyChoice?.policyDelta ?? {},
    budgetDelta,
    parliamentChoice.concession,
  )

  const outcome: ParliamentOutcome = resolveParliamentVote(parliamentChoice, createActionRng(state.seed, 'parliament-vote'))
  if (outcome === 'rejected') {
    policy = scalePolicyInput(policy, COMPROMISE_SCALE_ON_REJECTION)
  }

  const shocks: ExternalShock[] = state.choices.energyChoiceId && ENERGY_SHOCK.shock ? [ENERGY_SHOCK.shock] : []

  const simulatedGameState = simulateYearOne(state.gameState, policy, state.worldState, state.seed, shocks)

  const purchasingPowerDelta = simulatedGameState.economic.purchasingPower - state.initialEconomicSnapshot.purchasingPower
  const unemploymentDelta = simulatedGameState.economic.unemployment - state.initialEconomicSnapshot.unemployment

  const totalPopularityDelta =
    parliamentChoice.popularityDelta +
    popularityFromParliamentOutcome(outcome) +
    popularityFromBudget(state.choices.budgetSelections) +
    popularityFromYearEndOutcomes(purchasingPowerDelta, unemploymentDelta)

  const finalGameState = nudgePolitical(simulatedGameState, totalPopularityDelta)

  const scoreBreakdown = computeScore(
    state.initialEconomicSnapshot,
    finalGameState.economic,
    finalGameState.political.popularity,
    state.choices.budgetSelections,
  )
  const endingTitle = computeEndingTitle(
    state.initialEconomicSnapshot,
    finalGameState.economic,
    finalGameState.political.popularity,
    state.choices.budgetSelections,
  )

  return {
    ...state,
    screen: 'yearReport',
    gameState: finalGameState,
    parliamentOutcome: outcome,
    scoreBreakdown,
    endingTitle,
    choices: { ...state.choices, parliamentChoiceId: choiceId },
  }
}
