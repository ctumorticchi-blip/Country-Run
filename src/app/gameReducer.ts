import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../engine/economy/config/defaultConfig.ts'
import { applyEffect } from '../engine/effects/apply.ts'
import type { EconomicPolicyInput, ExternalShock, WorldState } from '../engine/economy/types.ts'
import type { EconomicState, GameState } from '../engine/state/gameState.ts'
import { budgetSelectionsToPolicyDelta } from '../game/country-run/budget/budgetEffects.ts'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER } from '../game/country-run/budget/budgetCategories.ts'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetCategoryId, type BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import { createInitialGameState } from '../game/country-run/data/initialState.ts'
import { createInitialWorldState } from '../game/country-run/data/initialWorldState.ts'
import { computeElectionResult, type ElectionResult } from '../game/country-run/prototype/electionResult.ts'
import { BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import { COMPROMISE_SCALE_ON_REJECTION, getParliamentChoice, resolveParliamentVote } from '../game/country-run/prototype/parliament.ts'
import { generateParliamentComposition, type ParliamentComposition } from '../game/country-run/prototype/parliamentComposition.ts'
import { appendPolicyHistory, type PolicyHistoryEntry } from '../game/country-run/prototype/policyHistory.ts'
import { computeInitialPoliticalCapital } from '../game/country-run/prototype/politicalCapital.ts'
import { popularityFromBudget, popularityFromParliamentOutcome, popularityFromYearEndOutcomes } from '../game/country-run/prototype/popularity.ts'
import { createActionRng } from '../game/country-run/prototype/rng.ts'
import { computeEndingTitle, computeScore, type EndingTitle, type ScoreBreakdown } from '../game/country-run/prototype/scoring.ts'
import type { DecisionConfig, ParliamentChoiceConfig, ParliamentOutcome, PlayerChoices, ScreenId } from '../game/country-run/prototype/types.ts'
import { mergePolicyDeltas, scalePolicyInput, simulateYearOne } from '../game/country-run/prototype/yearOneFlow.ts'
import {
  applyExecutionScaling,
  applyPopularityResilience,
  deriveGovernmentEngineConfig,
  governmentMarketConfidenceNudge,
  scaleParliamentPassProbability,
} from '../game/country-run/government/governmentEffects.ts'
import { getGovernmentProfile } from '../game/country-run/government/governmentProfiles.ts'
import type { GovernmentModifiers } from '../game/country-run/government/governmentTypes.ts'
import { coherenceScore, isCompleteSelection, REQUIRED_PROMISE_COUNT } from '../game/country-run/promises/promiseSelection.ts'
import type { PromiseCategory } from '../game/country-run/promises/promiseTypes.ts'

/** M3 §28 — bumped whenever the serialized shape of `GamePrototypeState` changes; no migration logic exists yet. */
export const GAME_VERSION = '0.3.0'

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

/** Same one-off-timestamp rationale as `generateSeed` — only called from the non-deterministic state-construction helpers below, never from inside a mid-run action handler. */
function nowIso(): string {
  return new Date().toISOString()
}

export interface GamePrototypeState {
  screen: ScreenId
  seed: string
  gameVersion: string
  createdAt: string
  /** Reflects the last full state (re)construction (new game / replay) — see nowIso()'s doc comment; not touched on every action, to keep the reducer pure. */
  updatedAt: string
  gameState: GameState
  worldState: WorldState
  /** Captured once at game start (turn 0) — the fixed baseline the Year 1 report compares against. */
  initialEconomicSnapshot: EconomicState
  initialPopularity: number
  choices: PlayerChoices
  /** Computed once when the campaign reaches the election screen (M3 §4) — a genuine outcome, not a per-render derived value, so it's stored like `scoreBreakdown` already was in M2. */
  electionResult: ElectionResult | null
  /** Computed once when a government profile is chosen (M3 §6-7). */
  parliamentComposition: ParliamentComposition | null
  /** Computed once at mandate start (M3 §21) — architecture only, nothing spends/replenishes it yet. */
  politicalCapital: number | null
  /** Append-only log of meaningful policy decisions (M3 §24), read by promise evaluators — never itself mutated in place. */
  policyHistory: PolicyHistoryEntry[]
  parliamentOutcome: ParliamentOutcome | null
  scoreBreakdown: ScoreBreakdown | null
  endingTitle: EndingTitle | null
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'BEGIN_PROMISE_SELECTION' }
  | { type: 'TOGGLE_PROMISE'; promiseId: string }
  | { type: 'CONFIRM_PROMISES' }
  | { type: 'PROCEED_TO_ELECTION' }
  | { type: 'VIEW_FRANCE_BRIEFING' }
  | { type: 'PROCEED_TO_GOVERNMENT' }
  | { type: 'CHOOSE_GOVERNMENT'; profileId: string }
  | { type: 'VIEW_PARLIAMENT_COMPOSITION' }
  | { type: 'PROCEED_TO_MANDATE_START' }
  | { type: 'BEGIN_MANDATE' }
  | { type: 'CHOOSE_BERCY'; choiceId: string }
  | { type: 'CHOOSE_ENERGY'; choiceId: string }
  | { type: 'SET_BUDGET_LEVEL'; category: BudgetCategoryId; level: BudgetLevel }
  | { type: 'SUBMIT_BUDGET' }
  | { type: 'CHOOSE_PARLIAMENT_VOTE'; choiceId: ParliamentChoiceConfig['id'] }
  | { type: 'REPLAY_SAME_SEED' }
  | { type: 'NEW_GAME' }

function findDecisionChoice(decision: DecisionConfig, choiceId: string) {
  const choice = decision.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error(`Unknown decision choice: ${choiceId}`)
  return choice
}

/** Maps each M2 budget category to the promise category its spending counts toward (M3 §24) — defense is the security lever. */
const BUDGET_CATEGORY_TO_PROMISE_CATEGORY: Record<BudgetCategoryId, PromiseCategory> = {
  health: 'health',
  education: 'education',
  investment: 'investment',
  defense: 'security',
}

function freshRunState(
  seed: string,
  screen: ScreenId,
  preservedChoices?: Pick<PlayerChoices, 'selectedPromiseIds' | 'governmentProfileId'>,
): GamePrototypeState {
  const gameState = createInitialGameState(seed)
  const timestamp = nowIso()
  return {
    screen,
    seed,
    gameVersion: GAME_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    gameState,
    worldState: createInitialWorldState(),
    initialEconomicSnapshot: gameState.economic,
    initialPopularity: gameState.political.popularity,
    choices: {
      selectedPromiseIds: preservedChoices?.selectedPromiseIds ?? [],
      governmentProfileId: preservedChoices?.governmentProfileId ?? null,
      bercyChoiceId: null,
      energyChoiceId: null,
      budgetSelections: { ...NEUTRAL_BUDGET_SELECTIONS },
      parliamentChoiceId: null,
    },
    electionResult: null,
    parliamentComposition: null,
    politicalCapital: null,
    policyHistory: [],
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

/** Same as `nudgePolitical`, but runs the raw delta through the chosen government's `popularityResilience` first (governmentEffects.ts integration point 4). */
function nudgePoliticalWithGovernment(state: GameState, rawPopularityDelta: number, governmentProfileId: string | null, credibilityDelta = 0): GameState {
  const modifiers = governmentProfileId ? getGovernmentProfile(governmentProfileId).modifiers : null
  const popularityDelta = modifiers ? applyPopularityResilience(rawPopularityDelta, modifiers) : rawPopularityDelta
  return nudgePolitical(state, popularityDelta, credibilityDelta)
}

/** The 3 campaign outcomes that are pure functions of (seed, selectedPromiseIds, governmentProfileId) — shared by CHOOSE_GOVERNMENT and REPLAY_SAME_SEED so both compute them identically. */
function computeCampaignOutcomes(
  seed: string,
  selectedPromiseIds: readonly string[],
  governmentProfileId: string,
): { electionResult: ElectionResult; parliamentComposition: ParliamentComposition; politicalCapital: number } {
  const electionResult = computeElectionResult(seed, selectedPromiseIds)
  const modifiers = getGovernmentProfile(governmentProfileId).modifiers
  const parliamentComposition = generateParliamentComposition(seed, electionResult.scorePct, selectedPromiseIds, modifiers)
  const politicalCapital = computeInitialPoliticalCapital(electionResult.scorePct, parliamentComposition.majorityOutcome, coherenceScore(selectedPromiseIds))
  return { electionResult, parliamentComposition, politicalCapital }
}

/**
 * The single reducer driving the whole campaign + Year 1 vertical slice.
 * Pure: given the same state and action, always returns the same next
 * state — this is what makes it safe under React's `<StrictMode>`
 * double-invoke (see rng.ts for the full RNG-safety rationale).
 * `CHOOSE_PARLIAMENT_VOTE` is the only action that advances the economic
 * simulation, and it does so exactly once per dispatch.
 */
export function gameReducer(state: GamePrototypeState, action: GameAction): GamePrototypeState {
  switch (action.type) {
    case 'START_GAME':
      return { ...state, screen: 'campaignIntro' }

    case 'BEGIN_PROMISE_SELECTION':
      return { ...state, screen: 'promiseSelection' }

    case 'TOGGLE_PROMISE': {
      const alreadySelected = state.choices.selectedPromiseIds.includes(action.promiseId)
      if (!alreadySelected && state.choices.selectedPromiseIds.length >= REQUIRED_PROMISE_COUNT) return state
      const selectedPromiseIds = alreadySelected
        ? state.choices.selectedPromiseIds.filter((id) => id !== action.promiseId)
        : [...state.choices.selectedPromiseIds, action.promiseId]
      return { ...state, choices: { ...state.choices, selectedPromiseIds } }
    }

    case 'CONFIRM_PROMISES':
      if (!isCompleteSelection(state.choices.selectedPromiseIds)) return state
      return { ...state, screen: 'promiseConfirmation' }

    case 'PROCEED_TO_ELECTION':
      return { ...state, screen: 'election', electionResult: computeElectionResult(state.seed, state.choices.selectedPromiseIds) }

    case 'VIEW_FRANCE_BRIEFING':
      return { ...state, screen: 'franceBriefing' }

    case 'PROCEED_TO_GOVERNMENT':
      return { ...state, screen: 'governmentSelection' }

    case 'CHOOSE_GOVERNMENT': {
      const profile = getGovernmentProfile(action.profileId)
      const electionResult = state.electionResult ?? computeElectionResult(state.seed, state.choices.selectedPromiseIds)
      const parliamentComposition = generateParliamentComposition(state.seed, electionResult.scorePct, state.choices.selectedPromiseIds, profile.modifiers)
      const politicalCapital = computeInitialPoliticalCapital(
        electionResult.scorePct,
        parliamentComposition.majorityOutcome,
        coherenceScore(state.choices.selectedPromiseIds),
      )
      const marketNudge = governmentMarketConfidenceNudge(profile.modifiers)
      const gameState = applyEffect(state.gameState, { type: 'add', path: 'economic.marketConfidence', value: marketNudge, min: 0, max: 100 })

      return {
        ...state,
        screen: 'legislativeElection',
        gameState,
        choices: { ...state.choices, governmentProfileId: profile.id },
        electionResult,
        parliamentComposition,
        politicalCapital,
      }
    }

    case 'VIEW_PARLIAMENT_COMPOSITION':
      return { ...state, screen: 'parliamentComposition' }

    case 'PROCEED_TO_MANDATE_START':
      return { ...state, screen: 'mandateStart' }

    case 'BEGIN_MANDATE':
      return { ...state, screen: 'bercyAudit' }

    case 'CHOOSE_BERCY': {
      const choice = findDecisionChoice(BERCY_AUDIT, action.choiceId)
      const entry: PolicyHistoryEntry = {
        turn: state.gameState.meta.turn,
        sourceId: `bercy:${choice.id}`,
        label: choice.title,
        amount: choice.policyDelta?.currentSpendingChanges,
      }
      return {
        ...state,
        screen: 'energyShock',
        gameState: nudgePoliticalWithGovernment(state.gameState, choice.popularityDelta, state.choices.governmentProfileId, choice.credibilityDelta ?? 0),
        choices: { ...state.choices, bercyChoiceId: choice.id },
        policyHistory: appendPolicyHistory(state.policyHistory, entry),
      }
    }

    case 'CHOOSE_ENERGY': {
      const choice = findDecisionChoice(ENERGY_SHOCK, action.choiceId)
      const entry: PolicyHistoryEntry = {
        turn: state.gameState.meta.turn,
        sourceId: `energy:${choice.id}`,
        label: choice.title,
        category: 'purchasingPower',
        amount: choice.policyDelta?.transfersChanges,
      }
      return {
        ...state,
        screen: 'budgetBuilder',
        gameState: nudgePoliticalWithGovernment(state.gameState, choice.popularityDelta, state.choices.governmentProfileId),
        choices: { ...state.choices, energyChoiceId: choice.id },
        policyHistory: appendPolicyHistory(state.policyHistory, entry),
      }
    }

    case 'SET_BUDGET_LEVEL':
      return {
        ...state,
        choices: { ...state.choices, budgetSelections: { ...state.choices.budgetSelections, [action.category]: action.level } },
      }

    case 'SUBMIT_BUDGET': {
      const entries = BUDGET_CATEGORY_ORDER.map((categoryId): PolicyHistoryEntry => {
        const category = BUDGET_CATEGORIES[categoryId]
        const level = state.choices.budgetSelections[categoryId]
        return {
          turn: state.gameState.meta.turn,
          sourceId: `budget:${categoryId}`,
          label: `${category.label} — ${level}`,
          category: BUDGET_CATEGORY_TO_PROMISE_CATEGORY[categoryId],
          amount: category.levels[level],
        }
      })
      return { ...state, screen: 'parliamentVote', policyHistory: entries.reduce(appendPolicyHistory, state.policyHistory) }
    }

    case 'CHOOSE_PARLIAMENT_VOTE':
      return resolveParliamentAndSimulate(state, action.choiceId)

    case 'REPLAY_SAME_SEED': {
      const { selectedPromiseIds, governmentProfileId } = state.choices
      const next = freshRunState(state.seed, 'bercyAudit', { selectedPromiseIds, governmentProfileId })
      if (!governmentProfileId) return next
      const outcomes = computeCampaignOutcomes(state.seed, selectedPromiseIds, governmentProfileId)
      const profile = getGovernmentProfile(governmentProfileId)
      const marketNudge = governmentMarketConfidenceNudge(profile.modifiers)
      const gameState = applyEffect(next.gameState, { type: 'add', path: 'economic.marketConfidence', value: marketNudge, min: 0, max: 100 })
      return {
        ...next,
        gameState,
        electionResult: outcomes.electionResult,
        parliamentComposition: outcomes.parliamentComposition,
        politicalCapital: outcomes.politicalCapital,
      }
    }

    case 'NEW_GAME':
      return freshRunState(generateSeed(), 'landing')
  }
}

function resolveParliamentAndSimulate(state: GamePrototypeState, choiceId: ParliamentChoiceConfig['id']): GamePrototypeState {
  const governmentProfileId = state.choices.governmentProfileId
  if (!governmentProfileId) throw new Error('CHOOSE_PARLIAMENT_VOTE dispatched before a government profile was chosen')
  const modifiers: GovernmentModifiers = getGovernmentProfile(governmentProfileId).modifiers

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
  policy = applyExecutionScaling(policy, modifiers)

  const scaledPassProbability = scaleParliamentPassProbability(parliamentChoice.passProbability, modifiers)
  const outcome: ParliamentOutcome = resolveParliamentVote(
    { ...parliamentChoice, passProbability: scaledPassProbability },
    createActionRng(state.seed, 'parliament-vote'),
  )
  if (outcome === 'rejected') {
    policy = scalePolicyInput(policy, COMPROMISE_SCALE_ON_REJECTION)
  }

  const shocks: ExternalShock[] = state.choices.energyChoiceId && ENERGY_SHOCK.shock ? [ENERGY_SHOCK.shock] : []
  const engineConfig = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, modifiers)

  const simulatedGameState = simulateYearOne(state.gameState, policy, state.worldState, state.seed, shocks, engineConfig)

  const purchasingPowerDelta = simulatedGameState.economic.purchasingPower - state.initialEconomicSnapshot.purchasingPower
  const unemploymentDelta = simulatedGameState.economic.unemployment - state.initialEconomicSnapshot.unemployment

  const rawPopularityDelta =
    parliamentChoice.popularityDelta +
    popularityFromParliamentOutcome(outcome) +
    popularityFromBudget(state.choices.budgetSelections) +
    popularityFromYearEndOutcomes(purchasingPowerDelta, unemploymentDelta)
  const totalPopularityDelta = applyPopularityResilience(rawPopularityDelta, modifiers)

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

  const historyEntry: PolicyHistoryEntry = {
    turn: finalGameState.meta.turn,
    sourceId: `parliament-vote:${outcome}`,
    label: `Vote du budget — ${outcome === 'adopted' ? 'adopté' : 'rejeté'}`,
  }

  return {
    ...state,
    screen: 'yearReport',
    gameState: finalGameState,
    parliamentOutcome: outcome,
    scoreBreakdown,
    endingTitle,
    choices: { ...state.choices, parliamentChoiceId: choiceId },
    policyHistory: appendPolicyHistory(state.policyHistory, historyEntry),
  }
}
