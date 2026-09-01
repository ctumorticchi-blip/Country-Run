import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../engine/economy/config/defaultConfig.ts'
import { applyEffect } from '../engine/effects/apply.ts'
import type { EconomicPolicyInput, ExternalShock, WorldState } from '../engine/economy/types.ts'
import type { EconomicState, GameState } from '../engine/state/gameState.ts'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER } from '../game/country-run/budget/budgetCategories.ts'
import { NEUTRAL_BUDGET_SELECTIONS, type BudgetCategoryId, type BudgetLevel } from '../game/country-run/budget/budgetTypes.ts'
import { createInitialGameState } from '../game/country-run/data/initialState.ts'
import { createInitialWorldState } from '../game/country-run/data/initialWorldState.ts'
import { BERCY_AUDIT, ENERGY_SHOCK } from '../game/country-run/prototype/decisions.ts'
import { computeElectionResult, type ElectionResult } from '../game/country-run/prototype/electionResult.ts'
import { COMPROMISE_SCALE_ON_REJECTION } from '../game/country-run/prototype/parliament.ts'
import { generateParliamentComposition, type ParliamentComposition } from '../game/country-run/prototype/parliamentComposition.ts'
import { appendPolicyHistory, type PolicyHistoryEntry } from '../game/country-run/prototype/policyHistory.ts'
import {
  applyCapitalDelta,
  canAffordCapital,
  clampPoliticalCapital,
  computeInitialPoliticalCapital,
  MAX_CAPITAL_SPEND_PER_ACTION,
  politicalCapitalDeltaFromBillOutcome,
  politicalCapitalDeltaFromYearEnd,
  spendCapital,
} from '../game/country-run/prototype/politicalCapital.ts'
import { popularityFromBudget, popularityFromParliamentOutcome, popularityFromYearEndOutcomes } from '../game/country-run/prototype/popularity.ts'
import { computeEndingTitle, computeScore, type EndingTitle, type ScoreBreakdown } from '../game/country-run/prototype/scoring.ts'
import type { DecisionConfig, PlayerChoices, ScreenId } from '../game/country-run/prototype/types.ts'
import { mergePolicyDeltas, scalePolicyInput, simulateYearOne } from '../game/country-run/prototype/yearOneFlow.ts'
import {
  applyExecutionScaling,
  applyPopularityResilience,
  deriveGovernmentEngineConfig,
  governmentMarketConfidenceNudge,
} from '../game/country-run/government/governmentEffects.ts'
import { getGovernmentProfile } from '../game/country-run/government/governmentProfiles.ts'
import type { GovernmentModifiers } from '../game/country-run/government/governmentTypes.ts'
import { getBlocDefinition } from '../game/country-run/parliament/blocDefinitions.ts'
import { adjustRelation, RELATIONSHIP_EFFECTS, type BlocRelations } from '../game/country-run/parliament/blocRelations.ts'
import { BUDGET_BILL_ID, deriveBudgetBill } from '../game/country-run/parliament/budgetBillDerivation.ts'
import { getBillDefinition } from '../game/country-run/parliament/bills.ts'
import type { ActiveBillState, BillHistoryEntry, PoliticalBillDefinition } from '../game/country-run/parliament/billTypes.ts'
import { MAX_VOTE_ATTEMPTS } from '../game/country-run/parliament/billTypes.ts'
import { addConcession, applyConcessionsToBill, type EffectiveBill } from '../game/country-run/parliament/concessions.ts'
import {
  applyExceptionalProcedure,
  blocsHostileToProcedure,
  canUseExceptionalProcedure,
  clampGovernmentTension,
} from '../game/country-run/parliament/exceptionalProcedure.ts'
import { createDeal, markDealFulfilled, type PoliticalDeal } from '../game/country-run/parliament/politicalDeal.ts'
import type { ConcessionType } from '../game/country-run/parliament/politicalTypes.ts'
import { estimateBillSupport } from '../game/country-run/parliament/supportEstimate.ts'
import { resolveVote, type VoteResult } from '../game/country-run/parliament/voteResolution.ts'
import { coherenceScore, isCompleteSelection, REQUIRED_PROMISE_COUNT } from '../game/country-run/promises/promiseSelection.ts'
import type { PromiseCategory } from '../game/country-run/promises/promiseTypes.ts'

/** Bumped whenever the serialized shape of `GamePrototypeState` changes; no migration logic exists yet. */
export const GAME_VERSION = '0.4.0'

/** Flat capital cost of a single SEEK_SUPPORT outreach action (M4 §12) — cheap relative to a full concession, so courting stays a real but minor lever. */
export const SEEK_SUPPORT_CAPITAL_COST = 2

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
  /** Computed once when the campaign reaches the election screen (M3 §4). */
  electionResult: ElectionResult | null
  /** Computed once when a government profile is chosen (M3 §6-7). */
  parliamentComposition: ParliamentComposition | null
  /** M3 §21 computed a starting value once; M4 §8-10 makes it a live, spendable/recoverable value for the rest of the run. */
  politicalCapital: number | null
  /** M4 §14 — one signed score per bloc, nudged by concrete negotiation/vote outcomes. */
  blocRelations: BlocRelations
  /** M4 §20 — architecture only this milestone (no government-collapse mechanic yet); tracked for a future confidence-vote system. */
  governmentTension: number
  /** The bill currently being negotiated or just voted on, if any (M4 §5, §28 pipeline) — the ONLY bill-related runtime state; everything else about it is re-derived from its `billId` + this state (see `parliament/billTypes.ts`'s 3-layer split). */
  activeBill: ActiveBillState | null
  /**
   * The most recent `CALL_VOTE`'s resolved breakdown, for the vote screen
   * to display — the one deliberate exception to "never store derived
   * data" (M4 §36): a vote result is a genuine one-time EVENT (like M2's
   * `scoreBreakdown`), and re-deriving it on demand isn't safe here since
   * popularity (a support-formula input) is nudged immediately after the
   * vote resolves, which would make a later recomputation diverge from
   * what the vote actually used. Cleared whenever a new bill negotiation
   * starts; `null` when the exceptional procedure bypassed voting entirely.
   */
  lastVoteResult: VoteResult | null
  /** Finalized bill outcomes (M4 §16, §36) — decisions/events, not economic snapshots. */
  billHistory: BillHistoryEntry[]
  /** Struck negotiation agreements (M4 §15), visible in history. */
  politicalDeals: PoliticalDeal[]
  /** Append-only log of meaningful policy decisions (M3 §24), read by promise evaluators — never itself mutated in place. */
  policyHistory: PolicyHistoryEntry[]
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
  | { type: 'NEGOTIATE_SEEK_SUPPORT'; blocId: string }
  | { type: 'NEGOTIATE_OFFER_CONCESSION'; concessionId: ConcessionType }
  | { type: 'NEGOTIATE_SPEND_CAPITAL'; amount: number }
  | { type: 'NEGOTIATE_REFUSE_COMPROMISE' }
  | { type: 'CALL_VOTE' }
  | { type: 'USE_EXCEPTIONAL_PROCEDURE' }
  | { type: 'RENEGOTIATE_BILL' }
  | { type: 'WITHDRAW_BILL' }
  | { type: 'PROCEED_TO_REFORM_HUB' }
  | { type: 'PROPOSE_BILL'; billId: string }
  | { type: 'CONCLUDE_YEAR_ONE' }
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

/** Resolves a bill id to its definition — the Budget Bill is derived live from the current Budget Builder draft; every other id is a static `BILL_CATALOG` entry (M4 §21, §30). Exported so the UI layer can resolve the same definition for display without duplicating this branch. */
export function resolveBillDefinition(state: GamePrototypeState, billId: string): PoliticalBillDefinition {
  return billId === BUDGET_BILL_ID ? deriveBudgetBill(state.choices.budgetSelections) : getBillDefinition(billId)
}

/** True once the player has brought forward (even if later rejected/withdrawn) their one discretionary Year 1 reform (M4 §31). */
export function hasUsedDiscretionaryBillSlot(state: Pick<GamePrototypeState, 'billHistory' | 'activeBill'>): boolean {
  const inHistory = state.billHistory.some((e) => e.billId !== BUDGET_BILL_ID)
  const inProgress = state.activeBill !== null && state.activeBill.billId !== BUDGET_BILL_ID
  return inHistory || inProgress
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
    },
    electionResult: null,
    parliamentComposition: null,
    politicalCapital: null,
    blocRelations: {},
    governmentTension: 0,
    activeBill: null,
    lastVoteResult: null,
    billHistory: [],
    politicalDeals: [],
    policyHistory: [],
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
 * `CALL_VOTE`/`USE_EXCEPTIONAL_PROCEDURE`/`CONCLUDE_YEAR_ONE` are the only
 * actions that advance the economic simulation or resolve a vote, and each
 * does so exactly once per dispatch.
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
      const activeBill: ActiveBillState = {
        billId: BUDGET_BILL_ID,
        status: 'NEGOTIATING',
        appliedConcessionIds: [],
        courtedBlocIds: [],
        capitalSpent: 0,
        turnProposed: state.gameState.meta.turn,
        voteAttempts: 0,
      }
      return {
        ...state,
        screen: 'billNegotiation',
        activeBill,
        lastVoteResult: null,
        policyHistory: entries.reduce(appendPolicyHistory, state.policyHistory),
      }
    }

    case 'NEGOTIATE_SEEK_SUPPORT': {
      if (!state.activeBill || state.activeBill.status !== 'NEGOTIATING') return state
      if (state.activeBill.courtedBlocIds.includes(action.blocId)) return state
      const capital = state.politicalCapital ?? 0
      if (!canAffordCapital(capital, SEEK_SUPPORT_CAPITAL_COST)) return state
      return {
        ...state,
        politicalCapital: spendCapital(capital, SEEK_SUPPORT_CAPITAL_COST),
        activeBill: {
          ...state.activeBill,
          courtedBlocIds: [...state.activeBill.courtedBlocIds, action.blocId],
          capitalSpent: state.activeBill.capitalSpent + SEEK_SUPPORT_CAPITAL_COST,
        },
      }
    }

    case 'NEGOTIATE_OFFER_CONCESSION': {
      if (!state.activeBill || state.activeBill.status !== 'NEGOTIATING') return state
      const billDef = resolveBillDefinition(state, state.activeBill.billId)
      if (!billDef.concessionsAvailable.includes(action.concessionId)) return state
      const nextConcessions = addConcession(state.activeBill.appliedConcessionIds, action.concessionId)
      if (nextConcessions === state.activeBill.appliedConcessionIds) return state
      return { ...state, activeBill: { ...state.activeBill, appliedConcessionIds: nextConcessions } }
    }

    case 'NEGOTIATE_SPEND_CAPITAL': {
      if (!state.activeBill || state.activeBill.status !== 'NEGOTIATING') return state
      const amount = Math.min(MAX_CAPITAL_SPEND_PER_ACTION, Math.max(0, action.amount))
      const capital = state.politicalCapital ?? 0
      if (amount === 0 || !canAffordCapital(capital, amount)) return state
      return {
        ...state,
        politicalCapital: spendCapital(capital, amount),
        activeBill: { ...state.activeBill, capitalSpent: state.activeBill.capitalSpent + amount },
      }
    }

    case 'NEGOTIATE_REFUSE_COMPROMISE': {
      if (!state.activeBill || state.activeBill.status !== 'NEGOTIATING') return state
      return { ...state, activeBill: { ...state.activeBill, status: 'READY_FOR_VOTE' } }
    }

    case 'CALL_VOTE':
      return resolveBillVote(state)

    case 'USE_EXCEPTIONAL_PROCEDURE':
      return resolveExceptionalProcedure(state)

    case 'RENEGOTIATE_BILL': {
      if (!state.activeBill || state.activeBill.status !== 'REJECTED' || state.activeBill.voteAttempts >= MAX_VOTE_ATTEMPTS) return state
      return { ...state, activeBill: { ...state.activeBill, status: 'NEGOTIATING' }, screen: 'billNegotiation' }
    }

    case 'WITHDRAW_BILL': {
      if (!state.activeBill || state.activeBill.billId === BUDGET_BILL_ID) return state
      const definition = resolveBillDefinition(state, state.activeBill.billId)
      const entry: BillHistoryEntry = {
        turn: state.gameState.meta.turn,
        billId: definition.id,
        billTitle: definition.title,
        status: 'WITHDRAWN',
        votesFor: 0,
        votesAgainst: 0,
        abstentions: 0,
        appliedConcessionIds: [...state.activeBill.appliedConcessionIds],
        usedExceptionalProcedure: false,
        politicalCapitalDelta: 0,
        popularityDelta: 0,
      }
      return { ...state, billHistory: [...state.billHistory, entry], activeBill: null }
    }

    case 'PROCEED_TO_REFORM_HUB':
      if (state.activeBill) return state
      return { ...state, screen: 'reformHub' }

    case 'PROPOSE_BILL': {
      if (state.activeBill || hasUsedDiscretionaryBillSlot(state) || action.billId === BUDGET_BILL_ID) return state
      const definition = getBillDefinition(action.billId)
      const capital = state.politicalCapital ?? 0
      if (!canAffordCapital(capital, definition.requiredPoliticalCapital)) return state
      const activeBill: ActiveBillState = {
        billId: definition.id,
        status: 'NEGOTIATING',
        appliedConcessionIds: [],
        courtedBlocIds: [],
        capitalSpent: 0,
        turnProposed: state.gameState.meta.turn,
        voteAttempts: 0,
      }
      return {
        ...state,
        politicalCapital: spendCapital(capital, definition.requiredPoliticalCapital),
        activeBill,
        lastVoteResult: null,
        screen: 'billNegotiation',
      }
    }

    case 'CONCLUDE_YEAR_ONE':
      if (state.activeBill) return state
      return finalizeYearOne(state)

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

/**
 * Updates bloc relationships and records any struck deal from a resolved
 * vote (M4 §14-15). Only called at TERMINAL resolution (a passed vote or
 * an attempt-exhausted rejection) — intermediate failed attempts within
 * the same negotiation don't yet touch relationships.
 */
function updateRelationsAndDeals(
  activeBill: ActiveBillState,
  effectiveBill: EffectiveBill,
  voteResult: VoteResult,
  status: 'ADOPTED' | 'REJECTED',
  turn: number,
  blocRelations: BlocRelations,
  politicalDeals: readonly PoliticalDeal[],
): { blocRelations: BlocRelations; politicalDeals: PoliticalDeal[] } {
  let nextRelations = blocRelations
  const nextDeals = [...politicalDeals]

  for (const blocResult of voteResult.blocBreakdown) {
    if (blocResult.blocId === 'PRESIDENTIAL_BLOC') continue
    const blocDef = getBlocDefinition(blocResult.blocId)
    const favored = blocResult.votesFor > blocResult.votesAgainst
    const wasCourted = activeBill.courtedBlocIds.includes(blocResult.blocId)
    const grantedConcession = blocDef.preferredConcessions.find((c) => activeBill.appliedConcessionIds.includes(c))

    if (favored) {
      const delta = grantedConcession
        ? RELATIONSHIP_EFFECTS.SUCCESSFUL_AGREEMENT
        : wasCourted
          ? RELATIONSHIP_EFFECTS.COURTED_AND_DELIVERED
          : RELATIONSHIP_EFFECTS.PASSIVE_GOODWILL
      nextRelations = adjustRelation(nextRelations, blocResult.blocId, delta)
    } else if (wasCourted || grantedConcession) {
      nextRelations = adjustRelation(nextRelations, blocResult.blocId, RELATIONSHIP_EFFECTS.BROKEN_AGREEMENT)
    }

    if (wasCourted || grantedConcession) {
      const deal = createDeal({
        blocId: blocResult.blocId,
        billId: effectiveBill.definition.id,
        turn,
        concessions: [...activeBill.appliedConcessionIds],
        expectedVotes: blocResult.seats,
        relationshipEffect: favored ? RELATIONSHIP_EFFECTS.SUCCESSFUL_AGREEMENT : RELATIONSHIP_EFFECTS.BROKEN_AGREEMENT,
        fiscalImpact: effectiveBill.fiscalCost,
        policyImpact: effectiveBill.policyTags,
      })
      nextDeals.push(markDealFulfilled(deal, favored && status === 'ADOPTED'))
    }
  }

  return { blocRelations: nextRelations, politicalDeals: nextDeals }
}

function resolveBillVote(state: GamePrototypeState): GamePrototypeState {
  if (!state.activeBill || !state.parliamentComposition || !state.choices.governmentProfileId) return state
  const modifiers: GovernmentModifiers = getGovernmentProfile(state.choices.governmentProfileId).modifiers
  const definition = resolveBillDefinition(state, state.activeBill.billId)
  const effectiveBill = applyConcessionsToBill(definition, state.activeBill.appliedConcessionIds)
  const attemptNumber = state.activeBill.voteAttempts + 1

  const voteResult = resolveVote(
    state.seed,
    attemptNumber,
    effectiveBill,
    state.parliamentComposition,
    state.blocRelations,
    state.gameState.political.popularity,
    modifiers,
    { courtedBlocIds: state.activeBill.courtedBlocIds, capitalSpent: state.activeBill.capitalSpent },
  )

  const capitalDelta = politicalCapitalDeltaFromBillOutcome(effectiveBill, voteResult.passed)
  const politicalCapital = applyCapitalDelta(state.politicalCapital ?? 0, capitalDelta)
  const popularityDelta = voteResult.passed ? 1.5 : -2.5
  const gameState = nudgePoliticalWithGovernment(state.gameState, popularityDelta, state.choices.governmentProfileId)

  const attemptsExhausted = attemptNumber >= MAX_VOTE_ATTEMPTS
  const isTerminal = voteResult.passed || attemptsExhausted

  if (!isTerminal) {
    return {
      ...state,
      gameState,
      politicalCapital,
      lastVoteResult: voteResult,
      activeBill: { ...state.activeBill, status: 'REJECTED', voteAttempts: attemptNumber },
      screen: 'billVote',
    }
  }

  const status: 'ADOPTED' | 'REJECTED' = voteResult.passed ? 'ADOPTED' : 'REJECTED'
  const { blocRelations, politicalDeals } = updateRelationsAndDeals(
    state.activeBill,
    effectiveBill,
    voteResult,
    status,
    state.gameState.meta.turn,
    state.blocRelations,
    state.politicalDeals,
  )

  const historyEntry: BillHistoryEntry = {
    turn: state.gameState.meta.turn,
    billId: effectiveBill.definition.id,
    billTitle: effectiveBill.definition.title,
    status,
    votesFor: voteResult.votesFor,
    votesAgainst: voteResult.votesAgainst,
    abstentions: voteResult.abstentions,
    appliedConcessionIds: [...state.activeBill.appliedConcessionIds],
    usedExceptionalProcedure: false,
    politicalCapitalDelta: capitalDelta,
    popularityDelta,
  }

  return {
    ...state,
    gameState,
    politicalCapital,
    blocRelations,
    politicalDeals,
    lastVoteResult: voteResult,
    billHistory: [...state.billHistory, historyEntry],
    activeBill: null,
    screen: 'billVote',
  }
}

function resolveExceptionalProcedure(state: GamePrototypeState): GamePrototypeState {
  if (!state.activeBill || !state.parliamentComposition || !state.choices.governmentProfileId) return state
  const capital = state.politicalCapital ?? 0
  if (!canUseExceptionalProcedure(capital)) return state
  const modifiers = getGovernmentProfile(state.choices.governmentProfileId).modifiers
  const definition = resolveBillDefinition(state, state.activeBill.billId)
  const effectiveBill = applyConcessionsToBill(definition, state.activeBill.appliedConcessionIds)

  const support = estimateBillSupport(effectiveBill, state.parliamentComposition, state.blocRelations, state.gameState.political.popularity, modifiers, {
    courtedBlocIds: state.activeBill.courtedBlocIds,
    capitalSpent: state.activeBill.capitalSpent,
  })
  const hostileBlocIds = blocsHostileToProcedure(support.blocBreakdown)

  const procedureResult = applyExceptionalProcedure(capital, state.governmentTension)
  let blocRelations = state.blocRelations
  for (const blocId of hostileBlocIds) {
    blocRelations = adjustRelation(blocRelations, blocId, RELATIONSHIP_EFFECTS.PROCEDURAL_FORCING)
  }

  const gameState = nudgePoliticalWithGovernment(state.gameState, procedureResult.popularityDelta, state.choices.governmentProfileId)

  const historyEntry: BillHistoryEntry = {
    turn: state.gameState.meta.turn,
    billId: effectiveBill.definition.id,
    billTitle: effectiveBill.definition.title,
    status: 'ADOPTED',
    votesFor: 0,
    votesAgainst: 0,
    abstentions: 0,
    appliedConcessionIds: [...state.activeBill.appliedConcessionIds],
    usedExceptionalProcedure: true,
    politicalCapitalDelta: procedureResult.politicalCapitalAfter - capital,
    popularityDelta: procedureResult.popularityDelta,
  }

  return {
    ...state,
    gameState,
    politicalCapital: procedureResult.politicalCapitalAfter,
    governmentTension: clampGovernmentTension(procedureResult.governmentTensionAfter),
    blocRelations,
    lastVoteResult: null,
    billHistory: [...state.billHistory, historyEntry],
    activeBill: null,
    screen: 'billVote',
  }
}

/**
 * Runs the ONE real economic simulation for Year 1 (M4 §40), after both
 * the mandatory Budget Bill and the optional discretionary reform have
 * been resolved (or the reform slot skipped). Bercy/energy policies are
 * fixed presidential decisions from earlier in the flow; the Budget Bill's
 * effective policy is scaled down (M2's `COMPROMISE_SCALE_ON_REJECTION`)
 * ONLY if it never passed, so a bill that failed still lets the country
 * have SOME budget; a rejected discretionary bill simply contributes
 * nothing (it was optional).
 */
function finalizeYearOne(state: GamePrototypeState): GamePrototypeState {
  const governmentProfileId = state.choices.governmentProfileId
  if (!governmentProfileId) return state
  const modifiers = getGovernmentProfile(governmentProfileId).modifiers

  const bercyChoice = state.choices.bercyChoiceId ? findDecisionChoice(BERCY_AUDIT, state.choices.bercyChoiceId) : null
  const energyChoice = state.choices.energyChoiceId ? findDecisionChoice(ENERGY_SHOCK, state.choices.energyChoiceId) : null

  const budgetEntry = state.billHistory.find((e) => e.billId === BUDGET_BILL_ID) ?? null
  const budgetDefinition = deriveBudgetBill(state.choices.budgetSelections)
  const budgetEffective = applyConcessionsToBill(budgetDefinition, budgetEntry?.appliedConcessionIds ?? [])
  const budgetPolicyFull = mergePolicyDeltas(budgetEffective.economicPolicyEffect)
  const budgetPolicy = budgetEntry?.status === 'ADOPTED' ? budgetPolicyFull : scalePolicyInput(budgetPolicyFull, COMPROMISE_SCALE_ON_REJECTION)

  const discretionaryEntry = state.billHistory.find((e) => e.billId !== BUDGET_BILL_ID) ?? null
  let discretionaryPolicy: Partial<EconomicPolicyInput> = {}
  if (discretionaryEntry?.status === 'ADOPTED') {
    const discretionaryDefinition = getBillDefinition(discretionaryEntry.billId)
    const discretionaryEffective = applyConcessionsToBill(discretionaryDefinition, discretionaryEntry.appliedConcessionIds)
    discretionaryPolicy = discretionaryEffective.economicPolicyEffect
  }

  let policy: EconomicPolicyInput = mergePolicyDeltas(bercyChoice?.policyDelta ?? {}, energyChoice?.policyDelta ?? {}, budgetPolicy, discretionaryPolicy)
  policy = applyExecutionScaling(policy, modifiers)

  const shocks: ExternalShock[] = state.choices.energyChoiceId && ENERGY_SHOCK.shock ? [ENERGY_SHOCK.shock] : []
  const engineConfig = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, modifiers)
  const simulatedGameState = simulateYearOne(state.gameState, policy, state.worldState, state.seed, shocks, engineConfig)

  const purchasingPowerDelta = simulatedGameState.economic.purchasingPower - state.initialEconomicSnapshot.purchasingPower
  const unemploymentDelta = simulatedGameState.economic.unemployment - state.initialEconomicSnapshot.unemployment
  const growthDelta = simulatedGameState.economic.growth - state.initialEconomicSnapshot.growth

  const rawPopularityDelta = popularityFromParliamentOutcome(budgetEntry?.status === 'ADOPTED' ? 'adopted' : 'rejected') +
    popularityFromBudget(state.choices.budgetSelections) +
    popularityFromYearEndOutcomes(purchasingPowerDelta, unemploymentDelta)
  const totalPopularityDelta = applyPopularityResilience(rawPopularityDelta, modifiers)
  const finalGameState = nudgePolitical(simulatedGameState, totalPopularityDelta)

  const yearEndCapitalDelta = politicalCapitalDeltaFromYearEnd(state.initialPopularity, finalGameState.political.popularity, growthDelta)
  const politicalCapital = clampPoliticalCapital(applyCapitalDelta(state.politicalCapital ?? 0, yearEndCapitalDelta))

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
    politicalCapital,
    scoreBreakdown,
    endingTitle,
  }
}
