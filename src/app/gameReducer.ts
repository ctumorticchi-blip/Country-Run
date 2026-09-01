import { DEFAULT_ECONOMIC_ENGINE_CONFIG } from '../engine/economy/config/defaultConfig.ts'
import { applyEffect } from '../engine/effects/apply.ts'
import { NEUTRAL_POLICY_INPUT, type EconomicPolicyInput, type WorldState } from '../engine/economy/types.ts'
import type { EconomicState, GameState } from '../engine/state/gameState.ts'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_ORDER, getTier, NEUTRAL_BUDGET_LEVELS, NEUTRAL_BUDGET_SELECTIONS, selectionsFromLevels } from '../game/country-run/budget/budgetCategories.ts'
import { budgetLevelsToPolicyInput, selectionsToLevels } from '../game/country-run/budget/budgetEffects.ts'
import type { BudgetCategoryId, BudgetLevels, BudgetSelections } from '../game/country-run/budget/budgetTypes.ts'
import { createInitialGameState } from '../game/country-run/data/initialState.ts'
import { createInitialWorldState } from '../game/country-run/data/initialWorldState.ts'
import { budgetLabelForYearStartTurn } from '../game/country-run/mandate/calendar.ts'
import { computeEconomicSentimentDelta } from '../game/country-run/mandate/economicSentiment.ts'
import { recordSnapshot, snapshotFrom, type EconomicSnapshot } from '../game/country-run/mandate/economicSnapshots.ts'
import { computeEndingTitle, computeFinalScore, type EndingTitle, type FinalScoreBreakdown } from '../game/country-run/mandate/finalScoring.ts'
import {
  applyTensionDelta,
  tensionDeltaFromBrokenDeals,
  tensionDeltaFromCompromise,
  tensionDeltaFromVoteOutcome,
} from '../game/country-run/mandate/governmentTensionV2.ts'
import { computePopularityTurnDelta, popularityDeltaFromBillOutcome } from '../game/country-run/mandate/popularityV2.ts'
import {
  applyEventChoice,
  applyEventWorldEffect,
  applyYearEndDrift,
  beginMandateTurn,
  popularityDeltaFromNewPromiseResolutions,
  turnTransitionFlags,
  type MandatePolicyComponents,
} from '../game/country-run/mandate/turnController.ts'
import { BERCY_AUDIT } from '../game/country-run/prototype/decisions.ts'
import { computeElectionResult, type ElectionResult } from '../game/country-run/prototype/electionResult.ts'
import { generateParliamentComposition, type ParliamentComposition } from '../game/country-run/prototype/parliamentComposition.ts'
import { appendPolicyHistory, type PolicyHistoryEntry } from '../game/country-run/prototype/policyHistory.ts'
import {
  applyCapitalDelta,
  canAffordCapital,
  clampPoliticalCapital,
  computeInitialPoliticalCapital,
  MAX_CAPITAL_SPEND_PER_ACTION,
  spendCapital,
} from '../game/country-run/prototype/politicalCapital.ts'
import type { DecisionConfig, PlayerChoices, ScreenId } from '../game/country-run/prototype/types.ts'
import {
  applyPopularityResilience,
  deriveGovernmentEngineConfig,
  governmentMarketConfidenceNudge,
} from '../game/country-run/government/governmentEffects.ts'
import { getGovernmentProfile } from '../game/country-run/government/governmentProfiles.ts'
import type { GovernmentModifiers } from '../game/country-run/government/governmentTypes.ts'
import { EVENT_CATALOG, getEventDefinition } from '../game/country-run/events/eventCatalog.ts'
import type { EventChoice, EventDefinition } from '../game/country-run/events/eventTypes.ts'
import { getBlocDefinition } from '../game/country-run/parliament/blocDefinitions.ts'
import { adjustRelation, RELATIONSHIP_EFFECTS, type BlocRelations } from '../game/country-run/parliament/blocRelations.ts'
import { BUDGET_BILL_ID, deriveBudgetBill } from '../game/country-run/parliament/budgetBillDerivation.ts'
import { BILL_CATALOG, getBillDefinition } from '../game/country-run/parliament/bills.ts'
import type { ActiveBillState, BillHistoryEntry, PoliticalBillDefinition } from '../game/country-run/parliament/billTypes.ts'
import { MAX_VOTE_ATTEMPTS } from '../game/country-run/parliament/billTypes.ts'
import { addConcession, applyConcessionsToBill, type EffectiveBill } from '../game/country-run/parliament/concessions.ts'
import { applyExceptionalProcedure, blocsHostileToProcedure, canUseExceptionalProcedure } from '../game/country-run/parliament/exceptionalProcedure.ts'
import { scheduleImplementation, type ScheduledImplementation } from '../game/country-run/parliament/implementationSchedule.ts'
import { createDeal, markDealFulfilled, type PoliticalDeal } from '../game/country-run/parliament/politicalDeal.ts'
import type { ConcessionType } from '../game/country-run/parliament/politicalTypes.ts'
import { estimateBillSupport } from '../game/country-run/parliament/supportEstimate.ts'
import { resolveVote, type VoteResult } from '../game/country-run/parliament/voteResolution.ts'
import { PROMISE_CATALOG } from '../game/country-run/promises/promiseCatalog.ts'
import { resolveDuePromises, type PromiseResolution } from '../game/country-run/promises/promiseResolution.ts'
import { coherenceScore, isCompleteSelection, REQUIRED_PROMISE_COUNT } from '../game/country-run/promises/promiseSelection.ts'
import type { PromiseCategory, PromiseEvaluationContext } from '../game/country-run/promises/promiseTypes.ts'

/** Bumped whenever the serialized shape of `GamePrototypeState` changes; no migration logic exists yet — an incompatible save fails safely to a new game (see save.ts). */
export const GAME_VERSION = '0.5.0'

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
export function generateSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `seed-${String(Date.now())}-${String(Math.random()).slice(2)}`
}

/** Same one-off-timestamp rationale as `generateSeed` — only called from the non-deterministic state-construction helpers below, never from inside a mid-run action handler. */
function nowIso(): string {
  return new Date().toISOString()
}

/**
 * The one-time-EVENT display data for the screen right after a year ends
 * (M5 §51-52) — the same "derived data that genuinely can't be safely
 * re-derived later" exception `lastVoteResult` already documents: a year's
 * "NOTE DE MANDAT PROVISOIRE" must reflect political-capital/tension
 * exactly as they stood at THAT year-end, not whatever they've drifted to
 * by the time the player revisits the screen.
 */
export interface GamePrototypeState {
  screen: ScreenId
  seed: string
  gameVersion: string
  createdAt: string
  updatedAt: string
  gameState: GameState
  worldState: WorldState
  /** Captured once at mandate start (turn 0) — the fixed baseline every report compares against. */
  initialEconomicSnapshot: EconomicState
  initialPopularity: number
  choices: PlayerChoices
  electionResult: ElectionResult | null
  parliamentComposition: ParliamentComposition | null
  politicalCapital: number | null
  blocRelations: BlocRelations
  governmentTension: number
  activeBill: ActiveBillState | null
  lastVoteResult: VoteResult | null
  billHistory: BillHistoryEntry[]
  politicalDeals: PoliticalDeal[]
  policyHistory: PolicyHistoryEntry[]

  /** Set once from the Bercy audit choice (M5 §11 keeps this the one fixed pre-mandate decision) — never changes again. */
  bercyPolicyEffect: Partial<EconomicPolicyInput>
  /** Accumulates permanently as scheduled bill/event implementations mature (M5 §38) — the ONLY mandate policy component stored as a running total; see turnController.ts's header for why that's safe. */
  implementedReformPolicies: Partial<EconomicPolicyInput>
  scheduledImplementations: ScheduledImplementation[]
  /**
   * The FULL merged policy actually fed to the engine on the last-played
   * turn — MUST be threaded, never re-derived (see
   * `turnController.ts`'s `BeginMandateTurnInput.previousMergedPolicy` doc
   * comment): re-deriving it fresh from the current `budgetLevels` etc.
   * would make a just-adopted budget invisible to the engine's own
   * `computePolicyDelta`, the exact M1.5 bug class this field exists to
   * avoid. `NEUTRAL_POLICY_INPUT` before the mandate's first turn.
   */
  lastMergedPolicyInput: EconomicPolicyInput
  /** The PERSISTENT absolute budget stance (M5 §29) — re-derived to a policy input fresh every turn, never stored as one. */
  budgetLevels: BudgetLevels
  /** The in-progress Budget Builder draft (tier ids) — resets each budget cycle from `selectionsFromLevels(budgetLevels)`. */
  draftBudgetSelections: BudgetSelections
  /** Set when a budget cycle opens (e.g. "Budget 2028") — `null` only before the mandate's first cycle. */
  currentBudgetLabel: string | null
  /** ids of events already resolved this run — event eligibility never repeats a one-shot event (M5 §24). */
  firedEventIds: string[]
  /** The event currently awaiting the player's choice, if any (3-layer split: this is only a pointer into `EVENT_CATALOG`). */
  activeEventId: string | null
  lastEventChoice: { eventId: string; eventTitle: string; choiceId: string; immediateFeedback: string } | null
  /** Frozen deadline outcomes (M5 §15-16) — see promiseResolution.ts; every selected promise is guaranteed one by mandate end. */
  promiseResolutions: PromiseResolution[]
  /** Compact, 30-max per-turn indicators (M5 §65) — never a full GameState duplicate. */
  economicSnapshots: EconomicSnapshot[]
  /** Popularity as of the start of the CURRENT gameplay year — the year-end drift's own baseline (M5 §20). */
  popularityAtYearStart: number
  /** The mandate's standing score — a genuine "NOTE DE MANDAT PROVISOIRE" at any `yearReview`, the true final score at `mandateReview` (same computation either way, M5 §61-63). */
  finalScoreBreakdown: FinalScoreBreakdown | null
  /** Only ever set at `mandateReview` — `null` at every `yearReview`, since the mandate's shape isn't final until turn 30. */
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
  | { type: 'SET_BUDGET_TIER'; category: BudgetCategoryId; tierId: string }
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
  | { type: 'BEGIN_TURN_LOOP' }
  | { type: 'ADVANCE_TURN' }
  | { type: 'CHOOSE_EVENT'; choiceId: string }
  | { type: 'CONTINUE_AFTER_EVENT' }
  | { type: 'CONTINUE_FROM_YEAR_REVIEW' }
  | { type: 'NEW_GAME' }
  | { type: 'RESUME_SAVED_GAME'; savedState: GamePrototypeState }

function findDecisionChoice(decision: DecisionConfig, choiceId: string) {
  const choice = decision.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error(`Unknown decision choice: ${choiceId}`)
  return choice
}

/** Maps each of the 7 M5 budget categories to the promise category its spending counts toward (M3 §24, extended M5 §30). */
const BUDGET_CATEGORY_TO_PROMISE_CATEGORY: Record<BudgetCategoryId, PromiseCategory> = {
  health: 'health',
  education: 'education',
  publicInvestment: 'investment',
  defense: 'security',
  housingTerritories: 'housing',
  greenTransition: 'environment',
  administrationEfficiency: 'publicServices',
}

/** Resolves a bill id to its definition — the Budget Bill is derived live from the current Budget Builder draft; every other id is a static `BILL_CATALOG` entry (M4 §21, §30). */
export function resolveBillDefinition(state: GamePrototypeState, billId: string): PoliticalBillDefinition {
  if (billId === BUDGET_BILL_ID) {
    return deriveBudgetBill(selectionsToLevels(state.draftBudgetSelections), state.budgetLevels, state.currentBudgetLabel ?? 'Budget')
  }
  return getBillDefinition(billId)
}

/** Reforms already ADOPTED once can't be re-adopted (M5 §36) — Reform Hub only offers the remaining catalog. */
export function availableReformBills(state: Pick<GamePrototypeState, 'billHistory'>): PoliticalBillDefinition[] {
  const adoptedIds = new Set(state.billHistory.filter((e) => e.billId !== BUDGET_BILL_ID && e.status === 'ADOPTED').map((e) => e.billId))
  return BILL_CATALOG.filter((b) => !adoptedIds.has(b.id))
}

/** Scales one policy fragment by a government's execution/reform-effectiveness modifiers (M3 §16 integration points 1-2), field by field — a Partial-safe counterpart to `governmentEffects.ts`'s `applyExecutionScaling`, which requires a FULL `EconomicPolicyInput`. */
function scalePartialPolicy(partial: Partial<EconomicPolicyInput>, modifiers: GovernmentModifiers): Partial<EconomicPolicyInput> {
  const scaled: Partial<EconomicPolicyInput> = {}
  for (const key of Object.keys(partial) as (keyof EconomicPolicyInput)[]) {
    const isReformField = key === 'laborMarketReform' || key === 'publicSectorReform'
    scaled[key] = (partial[key] ?? 0) * (isReformField ? modifiers.reformEffectiveness : modifiers.economicExecution)
  }
  return scaled
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
    bercyPolicyEffect: {},
    implementedReformPolicies: {},
    scheduledImplementations: [],
    lastMergedPolicyInput: { ...NEUTRAL_POLICY_INPUT },
    budgetLevels: { ...NEUTRAL_BUDGET_LEVELS },
    draftBudgetSelections: { ...NEUTRAL_BUDGET_SELECTIONS },
    currentBudgetLabel: null,
    firedEventIds: [],
    activeEventId: null,
    lastEventChoice: null,
    promiseResolutions: [],
    economicSnapshots: [],
    popularityAtYearStart: gameState.political.popularity,
    finalScoreBreakdown: null,
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

/**
 * The single reducer driving the whole campaign + 5-year, 30-turn mandate
 * (M5 §5: the calendar only ever advances via the explicit `ADVANCE_TURN`
 * action, never during render). Pure: given the same state and action,
 * always returns the same next state — this is what makes it safe under
 * React's `<StrictMode>` double-invoke (see prototype/rng.ts).
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
      const gameState = nudgePoliticalWithGovernment(state.gameState, choice.popularityDelta, state.choices.governmentProfileId, choice.credibilityDelta ?? 0)
      return {
        ...state,
        screen: 'budgetBuilder',
        gameState,
        choices: { ...state.choices, bercyChoiceId: choice.id },
        bercyPolicyEffect: choice.policyDelta ?? {},
        policyHistory: appendPolicyHistory(state.policyHistory, entry),
        currentBudgetLabel: budgetLabelForYearStartTurn(state.gameState.meta.turn + 1),
        draftBudgetSelections: selectionsFromLevels(state.budgetLevels),
        popularityAtYearStart: gameState.political.popularity,
      }
    }

    case 'SET_BUDGET_TIER':
      if (state.screen !== 'budgetBuilder') return state
      return { ...state, draftBudgetSelections: { ...state.draftBudgetSelections, [action.category]: action.tierId } }

    case 'SUBMIT_BUDGET': {
      if (state.screen !== 'budgetBuilder') return state
      const newLevels = selectionsToLevels(state.draftBudgetSelections)
      const entries: PolicyHistoryEntry[] = BUDGET_CATEGORY_ORDER.filter((id) => newLevels[id] !== state.budgetLevels[id]).map((categoryId) => {
        const tier = getTier(categoryId, state.draftBudgetSelections[categoryId])
        return {
          turn: state.gameState.meta.turn + 1,
          sourceId: `budget:${categoryId}:${state.currentBudgetLabel ?? ''}`,
          label: `${state.currentBudgetLabel ?? 'Budget'} — ${BUDGET_CATEGORIES[categoryId].label} — ${tier.label}`,
          category: BUDGET_CATEGORY_TO_PROMISE_CATEGORY[categoryId],
          amount: newLevels[categoryId],
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
      if (state.activeBill || action.billId === BUDGET_BILL_ID) return state
      const alreadyAdopted = state.billHistory.some((e) => e.billId === action.billId && e.status === 'ADOPTED')
      if (alreadyAdopted) return state
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

    case 'BEGIN_TURN_LOOP':
      if (state.activeBill) return state
      return { ...state, screen: 'mandateTurn' }

    case 'ADVANCE_TURN':
      return advanceTurnAction(state)

    case 'CHOOSE_EVENT':
      return resolveEventChoice(state, action.choiceId)

    case 'CONTINUE_AFTER_EVENT': {
      if (state.screen !== 'event' || !state.lastEventChoice) return state
      return advanceScreenAfterTurn({ ...state, activeEventId: null, lastEventChoice: null })
    }

    case 'CONTINUE_FROM_YEAR_REVIEW': {
      if (state.screen !== 'yearReview') return state
      const nextYearStartTurn = state.gameState.meta.turn + 1
      return {
        ...state,
        screen: 'budgetBuilder',
        currentBudgetLabel: budgetLabelForYearStartTurn(nextYearStartTurn),
        draftBudgetSelections: selectionsFromLevels(state.budgetLevels),
        popularityAtYearStart: state.gameState.political.popularity,
      }
    }

    case 'NEW_GAME':
      return freshRunState(generateSeed(), 'landing')

    /** M5 §56: the loaded save is validated (`gameVersion`, JSON-parseable) BEFORE this ever dispatches — see save.ts's `loadGame`. Handing it back verbatim is what makes "resume" and "an uninterrupted run" produce identical subsequent RNG draws — nothing here re-derives or resets anything. */
    case 'RESUME_SAVED_GAME':
      return action.savedState
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

  const popularityDelta = popularityDeltaFromBillOutcome(voteResult.passed, effectiveBill.definition.controversy)
  const gameState = nudgePoliticalWithGovernment(state.gameState, popularityDelta, state.choices.governmentProfileId)
  const tensionFromVote = tensionDeltaFromVoteOutcome(voteResult.passed, effectiveBill.definition.controversy)

  const attemptsExhausted = attemptNumber >= MAX_VOTE_ATTEMPTS
  const isTerminal = voteResult.passed || attemptsExhausted

  if (!isTerminal) {
    return {
      ...state,
      gameState,
      governmentTension: applyTensionDelta(state.governmentTension, tensionFromVote),
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
  const dealsForThisBill = politicalDeals.filter((d) => d.billId === effectiveBill.definition.id && d.turn === state.gameState.meta.turn)
  const tensionDelta =
    tensionFromVote +
    tensionDeltaFromBrokenDeals(dealsForThisBill) +
    tensionDeltaFromCompromise(state.activeBill.appliedConcessionIds.length, voteResult.passed)

  const isBudgetBill = state.activeBill.billId === BUDGET_BILL_ID
  let budgetLevels = state.budgetLevels
  let scheduledImplementations = state.scheduledImplementations
  if (isBudgetBill && status === 'ADOPTED') {
    budgetLevels = selectionsToLevels(state.draftBudgetSelections)
  }
  if (!isBudgetBill && status === 'ADOPTED') {
    const nextYearStartTurn = state.gameState.meta.turn + 1
    scheduledImplementations = scheduleImplementation(scheduledImplementations, {
      sourceId: definition.id,
      label: definition.title,
      adoptedTurn: nextYearStartTurn,
      scheduledTurn: nextYearStartTurn + definition.implementationDelay,
      policyEffect: scalePartialPolicy(effectiveBill.economicPolicyEffect, modifiers),
    })
  }

  const capitalDelta = status === 'ADOPTED' ? Math.round(2 + effectiveBill.definition.reformIntensity * 3) : -Math.round(4 + effectiveBill.definition.controversy * 6)

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
    politicalCapital: clampPoliticalCapital(applyCapitalDelta(state.politicalCapital ?? 0, capitalDelta)),
    governmentTension: applyTensionDelta(state.governmentTension, tensionDelta),
    blocRelations,
    politicalDeals,
    budgetLevels,
    scheduledImplementations,
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

  const isBudgetBill = state.activeBill.billId === BUDGET_BILL_ID
  let budgetLevels = state.budgetLevels
  let scheduledImplementations = state.scheduledImplementations
  if (isBudgetBill) {
    budgetLevels = selectionsToLevels(state.draftBudgetSelections)
  } else {
    const nextYearStartTurn = state.gameState.meta.turn + 1
    scheduledImplementations = scheduleImplementation(scheduledImplementations, {
      sourceId: definition.id,
      label: definition.title,
      adoptedTurn: nextYearStartTurn,
      scheduledTurn: nextYearStartTurn + definition.implementationDelay,
      policyEffect: scalePartialPolicy(effectiveBill.economicPolicyEffect, modifiers),
    })
  }

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
    governmentTension: procedureResult.governmentTensionAfter,
    blocRelations,
    budgetLevels,
    scheduledImplementations,
    lastVoteResult: null,
    billHistory: [...state.billHistory, historyEntry],
    activeBill: null,
    screen: 'billVote',
  }
}

/**
 * The deterministic part of one mandate turn (M5 §38): economic step, due
 * implementations, event roll, promise deadline resolution, popularity
 * drift — everything `mandate/turnController.ts` exposes as pure
 * functions, wired together with this playthrough's actual government
 * modifiers and stored state.
 */
function advanceTurnAction(state: GamePrototypeState): GamePrototypeState {
  if (state.screen !== 'mandateTurn') return state
  const governmentProfileId = state.choices.governmentProfileId
  if (!governmentProfileId || !state.parliamentComposition) return state
  const modifiers = getGovernmentProfile(governmentProfileId).modifiers
  const engineConfig = deriveGovernmentEngineConfig(DEFAULT_ECONOMIC_ENGINE_CONFIG, modifiers)

  const policyComponents: MandatePolicyComponents = {
    bercyPolicy: scalePartialPolicy(state.bercyPolicyEffect, modifiers),
    energyPolicy: {},
    enactedBudgetPolicy: scalePartialPolicy(budgetLevelsToPolicyInput(state.budgetLevels), modifiers),
    implementedReformPolicies: state.implementedReformPolicies,
  }

  const result = beginMandateTurn({
    state: state.gameState,
    worldState: state.worldState,
    config: engineConfig,
    seed: state.seed,
    policyComponents,
    previousMergedPolicy: state.lastMergedPolicyInput,
    scheduledImplementations: state.scheduledImplementations,
    firedEventIds: state.firedEventIds,
    selectedPromiseIds: state.choices.selectedPromiseIds,
    governmentProfileId,
    policyHistory: state.policyHistory,
    governmentTension: state.governmentTension,
    politicalCapital: state.politicalCapital ?? 0,
    events: EVENT_CATALOG,
  })

  const promiseCtx: PromiseEvaluationContext = {
    initialEconomic: state.initialEconomicSnapshot,
    currentEconomic: result.nextState.economic,
    currentTurn: result.nextState.meta.turn,
    policyHistory: state.policyHistory,
  }
  const newResolutions = resolveDuePromises(PROMISE_CATALOG, state.choices.selectedPromiseIds, state.promiseResolutions, promiseCtx)
  const newlyResolvedThisTurn = newResolutions.filter((r) => !state.promiseResolutions.some((old) => old.promiseId === r.promiseId))
  const promiseResolutionDelta = popularityDeltaFromNewPromiseResolutions(newlyResolvedThisTurn, PROMISE_CATALOG)

  const provisionalSnapshot = snapshotFrom(result.nextState.meta.turn, result.nextState.economic, state.gameState.political.popularity)
  const economicTrendDelta = computeEconomicSentimentDelta([...state.economicSnapshots, provisionalSnapshot])

  const rawTurnDelta = computePopularityTurnDelta({ economicTrendDelta, promiseResolutionDelta })
  const scaledTurnDelta = applyPopularityResilience(rawTurnDelta, modifiers)
  const gameStateWithPopularity = nudgePolitical(result.nextState, scaledTurnDelta)

  const finalSnapshot = snapshotFrom(result.nextState.meta.turn, result.nextState.economic, gameStateWithPopularity.political.popularity)
  const economicSnapshots = recordSnapshot(state.economicSnapshots, finalSnapshot)

  const implementationHistory: PolicyHistoryEntry[] = result.appliedImplementations.map((entry) => ({
    turn: result.nextState.meta.turn,
    sourceId: `${entry.sourceId}:implemented`,
    label: `${entry.label} — mise en œuvre`,
  }))

  const nextStateBase: GamePrototypeState = {
    ...state,
    gameState: gameStateWithPopularity,
    implementedReformPolicies: result.policyComponents.implementedReformPolicies,
    lastMergedPolicyInput: result.mergedPolicy,
    scheduledImplementations: [...result.scheduledImplementations],
    promiseResolutions: newResolutions,
    economicSnapshots,
    policyHistory: implementationHistory.reduce(appendPolicyHistory, state.policyHistory),
    firedEventIds: result.firedEvent ? [...state.firedEventIds, result.firedEvent.id] : state.firedEventIds,
  }

  if (result.firedEvent) {
    return { ...nextStateBase, screen: 'event', activeEventId: result.firedEvent.id, lastEventChoice: null }
  }

  return advanceScreenAfterTurn(nextStateBase)
}

function resolveEventChoice(state: GamePrototypeState, choiceId: string): GamePrototypeState {
  if (state.screen !== 'event' || !state.activeEventId) return state
  const event: EventDefinition = getEventDefinition(state.activeEventId)
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return state

  const governmentProfileId = state.choices.governmentProfileId
  const modifiers = governmentProfileId ? getGovernmentProfile(governmentProfileId).modifiers : null

  const scaledChoice: EventChoice = modifiers
    ? {
        ...choice,
        economicPolicyEffect: scalePartialPolicy(choice.economicPolicyEffect ?? {}, modifiers),
        delayedEffects: choice.delayedEffects?.map((d) => ({ ...d, policyEffect: scalePartialPolicy(d.policyEffect, modifiers) })),
      }
    : choice

  const turn = state.gameState.meta.turn
  const { policyComponents, scheduledImplementations } = applyEventChoice(
    turn,
    event,
    scaledChoice,
    { bercyPolicy: {}, energyPolicy: {}, enactedBudgetPolicy: {}, implementedReformPolicies: state.implementedReformPolicies },
    state.scheduledImplementations,
  )

  const worldState = applyEventWorldEffect(state.worldState, choice)

  let gameState = state.gameState
  if (choice.popularityEffect) {
    const scaled = modifiers ? applyPopularityResilience(choice.popularityEffect, modifiers) : choice.popularityEffect
    gameState = nudgePolitical(gameState, scaled)
  }
  const politicalCapital = clampPoliticalCapital(applyCapitalDelta(state.politicalCapital ?? 0, choice.politicalCapitalEffect ?? 0))
  const governmentTension = applyTensionDelta(state.governmentTension, choice.governmentTensionEffect ?? 0)

  let blocRelations = state.blocRelations
  if (choice.blocRelationshipEffects) {
    for (const [blocId, delta] of Object.entries(choice.blocRelationshipEffects)) {
      if (delta) blocRelations = adjustRelation(blocRelations, blocId, delta)
    }
  }

  const entry: PolicyHistoryEntry = {
    turn,
    sourceId: `event:${event.id}:${choice.id}`,
    label: `${event.title} — ${choice.title}`,
    amount: choice.fiscalEffect,
  }

  return {
    ...state,
    gameState,
    worldState,
    politicalCapital,
    governmentTension,
    blocRelations,
    implementedReformPolicies: policyComponents.implementedReformPolicies,
    scheduledImplementations: [...scheduledImplementations],
    policyHistory: appendPolicyHistory(state.policyHistory, entry),
    lastEventChoice: { eventId: event.id, eventTitle: event.title, choiceId: choice.id, immediateFeedback: choice.immediateFeedback },
  }
}

/** What screen comes after a turn's economic step (and any event choice) has fully resolved (M5 §5-6, §48-51). */
function advanceScreenAfterTurn(state: GamePrototypeState): GamePrototypeState {
  const turn = state.gameState.meta.turn
  const flags = turnTransitionFlags(turn)
  if (!flags.isYearEnd) return { ...state, screen: 'mandateTurn' }
  return finalizeYear(state, flags.isMandateEnd)
}

/** BILAN ANNÉE X (and, at turn 30, the mandate-ending "5 ANS PLUS TARD") — M5 §51-55. */
function finalizeYear(state: GamePrototypeState, isMandateEnd: boolean): GamePrototypeState {
  const drift = applyYearEndDrift({
    popularityAtYearStart: state.popularityAtYearStart,
    popularityAtYearEnd: state.gameState.political.popularity,
    growthDelta: state.gameState.economic.growth - state.initialEconomicSnapshot.growth,
    governmentTension: state.governmentTension,
    politicalCapital: state.politicalCapital ?? 0,
  })

  const finalScoreBreakdown = computeFinalScore({
    start: state.initialEconomicSnapshot,
    end: state.gameState.economic,
    finalPopularity: state.gameState.political.popularity,
    finalGovernmentTension: drift.governmentTension,
    finalPoliticalCapital: drift.politicalCapital,
    promiseResolutions: state.promiseResolutions,
  })

  const base: GamePrototypeState = {
    ...state,
    politicalCapital: drift.politicalCapital,
    governmentTension: drift.governmentTension,
    finalScoreBreakdown,
  }

  if (!isMandateEnd) {
    return { ...base, screen: 'yearReview' }
  }

  const reformsEnacted = state.billHistory.filter((e) => e.billId !== BUDGET_BILL_ID && e.status === 'ADOPTED').length
  const endingTitle = computeEndingTitle({
    start: state.initialEconomicSnapshot,
    end: state.gameState.economic,
    finalPopularity: state.gameState.political.popularity,
    finalGovernmentTension: drift.governmentTension,
    promiseResolutions: state.promiseResolutions,
    reformsEnacted,
  })

  return { ...base, screen: 'mandateReview', endingTitle }
}
