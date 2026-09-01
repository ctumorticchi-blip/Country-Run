import { advanceEconomicTurn } from '../../../engine/economy/advanceEconomy.ts'
import type { EconomicEngineConfig } from '../../../engine/economy/config/types.ts'
import type { EconomicDiagnostics, EconomicPolicyInput, WorldState } from '../../../engine/economy/types.ts'
import type { GameState, Turn } from '../../../engine/state/gameState.ts'
import { isMandateEndTurn, isMidtermTurn, isYearEndTurn, isYearStartTurn } from './calendar.ts'
import { EVENT_CATALOG } from '../events/eventCatalog.ts'
import type { EventChoice, EventDefinition, EventEligibilityContext } from '../events/eventTypes.ts'
import { selectEventForTurn } from '../events/eventSelection.ts'
import { applyCapitalDelta, politicalCapitalDeltaFromYearEnd } from '../prototype/politicalCapital.ts'
import { createActionRng } from '../prototype/rng.ts'
import { mergePolicyDeltas } from '../prototype/yearOneFlow.ts'
import { dueImplementations, pendingImplementations, scheduleImplementation, type ScheduledImplementation } from '../parliament/implementationSchedule.ts'
import { applyTensionDelta, tensionDeltaFromPopularity } from './governmentTensionV2.ts'
import { popularityDeltaFromPromiseResolution } from './popularityV2.ts'
import type { PromiseDefinition } from '../promises/promiseTypes.ts'
import type { PromiseResolution } from '../promises/promiseResolution.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'

/**
 * M5 §38: the single orchestration point for advancing the mandate one
 * turn at a time (never a 6-turn batch like M2/M3's `simulateYearOne`).
 * Turn advancement itself only ever happens on an explicit player
 * confirmation dispatched by the reducer (task 41) — this module supplies
 * the PURE, independently-testable pieces that dispatch calls in sequence;
 * it never reaches into React state itself. Split into several small
 * functions rather than one big "do everything" call because an event's
 * player-chosen effects genuinely cannot be known until AFTER the player
 * has seen the EVENT screen and picked — `beginMandateTurn` covers exactly
 * the deterministic part of a turn (economic step, event roll, due
 * implementations), and `applyEventChoice`/`applyEventWorldEffect` cover
 * the part that depends on that later player input.
 */

/**
 * Separate named policy contributions, always freshly re-merged via
 * `mergeMandatePolicy` (which just calls the already-tested
 * `mergePolicyDeltas`) rather than one running accumulator — this is what
 * makes the M1.5 accumulation bug structurally impossible across 30 turns
 * and 5 budget cycles: `enactedBudgetPolicy` is REPLACED WHOLESALE every
 * budget cycle (never added to itself), while `implementedReformPolicies`
 * legitimately accumulates permanently, one bill/event effect at a time,
 * each folded in exactly once when it matures.
 */
export interface MandatePolicyComponents {
  bercyPolicy: Partial<EconomicPolicyInput>
  energyPolicy: Partial<EconomicPolicyInput>
  enactedBudgetPolicy: Partial<EconomicPolicyInput>
  implementedReformPolicies: Partial<EconomicPolicyInput>
}

export function mergeMandatePolicy(components: MandatePolicyComponents): EconomicPolicyInput {
  return mergePolicyDeltas(components.bercyPolicy, components.energyPolicy, components.enactedBudgetPolicy, components.implementedReformPolicies)
}

export interface BeginMandateTurnInput {
  state: GameState
  worldState: WorldState
  config: EconomicEngineConfig
  seed: string
  policyComponents: MandatePolicyComponents
  /**
   * The FULL merged policy actually fed to the engine on the PRECEDING
   * turn — stored and threaded by the caller, exactly like the engine's
   * own `advanceEconomicTurn`'s `previousPolicyInput` contract (see
   * `engine/economy/advanceEconomy.ts`'s doc comment: "the engine has
   * nowhere else to remember it"). This CANNOT be re-derived from
   * `policyComponents` alone: a component like `enactedBudgetPolicy` can
   * jump to a new value the instant a budget bill is adopted, and by the
   * time this function runs, `policyComponents` already reflects that NEW
   * value — re-merging it for both "previous" and "new" would make
   * `computePolicyDelta` see zero change even on the very turn the change
   * should first be felt (the M1.5 bug class, reintroduced by construction
   * if this field is ever skipped or re-derived instead of threaded).
   */
  previousMergedPolicy: EconomicPolicyInput
  scheduledImplementations: readonly ScheduledImplementation[]
  firedEventIds: readonly string[]
  selectedPromiseIds: readonly string[]
  governmentProfileId: string | null
  policyHistory: readonly PolicyHistoryEntry[]
  governmentTension: number
  politicalCapital: number
  /** Defaults to the full `EVENT_CATALOG` — overridable for isolated testing. */
  events?: readonly EventDefinition[]
}

export interface BeginMandateTurnResult {
  nextState: GameState
  diagnostics: EconomicDiagnostics
  policyComponents: MandatePolicyComponents
  /** The merged policy just used as "new" this turn — the caller MUST store this and pass it back as next turn's `previousMergedPolicy`. */
  mergedPolicy: EconomicPolicyInput
  scheduledImplementations: readonly ScheduledImplementation[]
  /** Implementations that matured and were folded in this turn — for a policyHistory entry / a "what changed" note. */
  appliedImplementations: readonly ScheduledImplementation[]
  /** The event selected for this turn, if any — the reducer routes to the EVENT screen when non-null, otherwise proceeds straight to the next MANDATE_TURN. */
  firedEvent: EventDefinition | null
}

/**
 * The deterministic part of one mandate turn: applies any implementation
 * whose `scheduledTurn` is now due, re-derives the merged policy, runs
 * exactly one turn of the real economic engine, and rolls for (at most)
 * one event. Everything here is a pure function of its inputs plus `seed`
 * — the same seed and state always produce the same turn.
 */
export function beginMandateTurn(input: BeginMandateTurnInput): BeginMandateTurnResult {
  const nextTurn: Turn = input.state.meta.turn + 1
  const previousMergedPolicy = input.previousMergedPolicy

  const applied = dueImplementations(input.scheduledImplementations, nextTurn)
  const remaining = pendingImplementations(input.scheduledImplementations, nextTurn)
  const implementedReformPolicies = mergePolicyDeltas(input.policyComponents.implementedReformPolicies, ...applied.map((entry) => entry.policyEffect))
  const policyComponents: MandatePolicyComponents = { ...input.policyComponents, implementedReformPolicies }
  const newMergedPolicy = mergeMandatePolicy(policyComponents)

  const eligibilityCtx: EventEligibilityContext = {
    turn: nextTurn,
    gameState: input.state,
    worldState: input.worldState,
    selectedPromiseIds: input.selectedPromiseIds,
    governmentProfileId: input.governmentProfileId,
    policyHistory: input.policyHistory,
    governmentTension: input.governmentTension,
    politicalCapital: input.politicalCapital,
    firedEventIds: input.firedEventIds,
  }
  const firedEvent = selectEventForTurn(input.events ?? EVENT_CATALOG, eligibilityCtx, input.seed)
  const shocks = firedEvent?.worldShock ? [firedEvent.worldShock] : []

  const rng = createActionRng(input.seed, `mandate-turn-${String(nextTurn)}`)
  const { nextState, diagnostics } = advanceEconomicTurn(input.state, newMergedPolicy, input.worldState, rng, input.config, shocks, previousMergedPolicy)

  return { nextState, diagnostics, policyComponents, mergedPolicy: newMergedPolicy, scheduledImplementations: remaining, appliedImplementations: applied, firedEvent }
}

export interface ApplyEventChoiceResult {
  policyComponents: MandatePolicyComponents
  scheduledImplementations: readonly ScheduledImplementation[]
}

/**
 * Folds one chosen `EventChoice`'s economic effects into mandate state:
 * `economicPolicyEffect` joins `implementedReformPolicies` immediately
 * (felt from next turn onward, same convention as a bill's effect), each
 * `delayedEffects` entry becomes a `ScheduledImplementation` due
 * `turnsLater` turns from now — reusing the SAME queue bills use, per
 * `implementationSchedule.ts`'s doc comment.
 */
export function applyEventChoice(
  turn: Turn,
  event: EventDefinition,
  choice: EventChoice,
  policyComponents: MandatePolicyComponents,
  scheduledImplementations: readonly ScheduledImplementation[],
): ApplyEventChoiceResult {
  const implementedReformPolicies = mergePolicyDeltas(policyComponents.implementedReformPolicies, choice.economicPolicyEffect ?? {})
  const nextPolicyComponents: MandatePolicyComponents = { ...policyComponents, implementedReformPolicies }

  const nextScheduled = (choice.delayedEffects ?? []).reduce(
    (schedule, delayed) =>
      scheduleImplementation(schedule, {
        sourceId: `${event.id}:${choice.id}`,
        label: `${event.title} — ${choice.title}`,
        adoptedTurn: turn,
        scheduledTurn: turn + delayed.turnsLater,
        policyEffect: delayed.policyEffect,
      }),
    scheduledImplementations,
  )

  return { policyComponents: nextPolicyComponents, scheduledImplementations: nextScheduled }
}

type WorldEffectKey = keyof NonNullable<EventChoice['worldEffect']>
const WORLD_STATE_EFFECT_KEYS: WorldEffectKey[] = ['eurozoneGrowth', 'globalTradeGrowth', 'externalInflation', 'oilPriceIndex']

/** A chosen event choice's permanent, additive nudge to exogenous `WorldState` fields — distinct from the event's own one-off `worldShock`, which `beginMandateTurn` already applies via `advanceEconomicTurn`'s `shocks`. */
export function applyEventWorldEffect(worldState: WorldState, choice: EventChoice): WorldState {
  if (!choice.worldEffect) return worldState
  const next = { ...worldState }
  for (const key of WORLD_STATE_EFFECT_KEYS) {
    const delta = choice.worldEffect[key]
    if (delta !== undefined) next[key] = next[key] + delta
  }
  return next
}

/** Bridges `promiseResolution.ts` to `popularityV2.ts` — the summed popularity effect of every promise resolution FROZEN this specific turn (already-frozen promises from earlier turns never contribute again). */
export function popularityDeltaFromNewPromiseResolutions(
  newlyResolvedThisTurn: readonly PromiseResolution[],
  promises: readonly PromiseDefinition[],
): number {
  return newlyResolvedThisTurn.reduce((sum, resolution) => {
    const promise = promises.find((p) => p.id === resolution.promiseId)
    if (!promise) return sum
    return sum + popularityDeltaFromPromiseResolution(resolution.finalStatus, promise.difficulty)
  }, 0)
}

export interface TurnTransitionFlags {
  /** First turn of a gameplay year (1, 7, 13, 19, 25) — that year's budget cycle begins. */
  isYearStart: boolean
  /** Last turn of a gameplay year (6, 12, 18, 24, 30) — BILAN ANNÉE X fires. */
  isYearEnd: boolean
  /** Turn 18 — the special MI-MANDAT midterm review. */
  isMidterm: boolean
  /** Turn 30 — the mandate is over; MANDATE_REVIEW fires. */
  isMandateEnd: boolean
}

/** A single bundled read of every calendar-driven phase trigger for a turn — the reducer's one stop for "what screen comes after this turn". */
export function turnTransitionFlags(turn: Turn): TurnTransitionFlags {
  return { isYearStart: isYearStartTurn(turn), isYearEnd: isYearEndTurn(turn), isMidterm: isMidtermTurn(turn), isMandateEnd: isMandateEndTurn(turn) }
}

export interface YearEndDriftInput {
  popularityAtYearStart: number
  popularityAtYearEnd: number
  growthDelta: number
  governmentTension: number
  politicalCapital: number
}

export interface YearEndDriftResult {
  politicalCapital: number
  governmentTension: number
}

/**
 * Applied once per gameplay year, at `isYearEndTurn` — political capital's
 * small year-review recovery/decline (M4's `politicalCapitalDeltaFromYearEnd`,
 * reused unchanged: it already never resets the running total, only nudges
 * it) plus government tension's own popularity-driven year-end drift.
 */
export function applyYearEndDrift(input: YearEndDriftInput): YearEndDriftResult {
  const capitalDelta = politicalCapitalDeltaFromYearEnd(input.popularityAtYearStart, input.popularityAtYearEnd, input.growthDelta)
  const tensionDelta = tensionDeltaFromPopularity(input.popularityAtYearEnd)
  return {
    politicalCapital: applyCapitalDelta(input.politicalCapital, capitalDelta),
    governmentTension: applyTensionDelta(input.governmentTension, tensionDelta),
  }
}
