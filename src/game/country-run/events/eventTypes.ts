import type { EconomicPolicyInput, ExternalShock, WorldState } from '../../../engine/economy/types.ts'
import type { EconomicState, GameState, Turn } from '../../../engine/state/gameState.ts'
import type { EventMemory } from '../../../engine/events/memory.ts'
import type { PolicyHistoryEntry } from '../prototype/policyHistory.ts'

/**
 * ⚠️ M5 §7-10 event system — Country Run content on top of the generic
 * engine, exactly like `promiseCatalog.ts`/`parliament/bills.ts`. No real
 * political party or a literal future real-world event is simulated — the
 * France baseline is real-inspired, the mandate's future is fictional.
 */
export type EventCategory =
  | 'ECONOMY'
  | 'ENERGY'
  | 'SOCIAL'
  | 'INTERNATIONAL'
  | 'PUBLIC_SERVICES'
  | 'INDUSTRY'
  | 'HOUSING'
  | 'CLIMATE'
  | 'SECURITY'
  | 'POLITICAL'

/** Everything an event's `conditions`/`probabilityModifier` and a choice's effects might need to read. */
export interface EventEligibilityContext {
  turn: Turn
  gameState: GameState
  worldState: WorldState
  selectedPromiseIds: readonly string[]
  governmentProfileId: string | null
  policyHistory: readonly PolicyHistoryEntry[]
  governmentTension: number
  politicalCapital: number
  /** ids of events already resolved this run, in `sourceEventId` form — for `exclusiveGroup`/one-shot checks. */
  firedEventIds: readonly string[]
  /**
   * M6.5 §2-3: the FULL history of every event choice made this run —
   * richer than `firedEventIds` (which only proves "this exact episode id
   * already fired"). A follow-up episode's `conditions` reads this to ask
   * "what did the player choose LAST time in this arc", enabling genuine
   * multi-stage branching without a bespoke state field per arc. Defaults
   * to `[]` for any caller not yet threading it (kept optional so a
   * pre-M6.5 test object literal doesn't need updating).
   */
  eventMemories?: readonly EventMemory[]
  /** M6.5 §40, §45: whether FONDS SOUVERAIN FRANCE exists this run — gates fund-specific event choices/events. `false`/absent when it doesn't exist. */
  sovereignFundExists?: boolean
}

/** A policy contribution that only becomes active a fixed number of turns after the choice is made (M5 §13, "delayed employment effects preferred"). */
export interface EventDelayedEffect {
  turnsLater: number
  policyEffect: Partial<EconomicPolicyInput>
}

export interface EventChoice {
  id: string
  title: string
  description: string
  /** Md€/year, display only — the real driver is `economicPolicyEffect`. */
  fiscalEffect?: number
  /** Folded permanently into the mandate's sustained policy total from this turn onward (like a reform). */
  economicPolicyEffect?: Partial<EconomicPolicyInput>
  /** A permanent, additive nudge to exogenous WorldState fields — distinct from the event's own one-off `worldShock`. */
  worldEffect?: Partial<Pick<WorldState, 'eurozoneGrowth' | 'globalTradeGrowth' | 'externalInflation' | 'oilPriceIndex'>>
  popularityEffect?: number
  politicalCapitalEffect?: number
  governmentTensionEffect?: number
  /** blocId -> relationship delta. */
  blocRelationshipEffects?: Partial<Record<string, number>>
  delayedEffects?: EventDelayedEffect[]
  /** M6 §39: when set, `economicPolicyEffect` is reversed automatically, exactly once, `durationTurns` after it takes effect (see `finance/fiscalLedger.ts`'s expiration mechanism) — a genuinely TEMPORARY measure rather than a sustained level. */
  temporaryPolicy?: { durationTurns: number }
  /** Shown right after the player picks this choice — never invented narrative, only a plain-language echo of the effects above. */
  immediateFeedback: string
  riskDescription?: string
}

export interface EventDefinition {
  id: string
  title: string
  category: EventCategory
  description: string
  earliestTurn: Turn
  latestTurn: Turn
  /** Roll probability PER ELIGIBLE TURN once earliestTurn is reached (M5 §24: kept low so events stay ~1 every 2-4 turns overall). */
  baseProbability: number
  conditions?: (ctx: EventEligibilityContext) => boolean
  /** Multiplies `baseProbability` — e.g. "higher if health spending was cut" (M5 §12). */
  probabilityModifier?: (ctx: EventEligibilityContext) => number
  /** At most one event per group fires in a single run. */
  exclusiveGroup?: string
  /** Minimum turns between repeats — irrelevant for the current one-shot-only catalog, kept for a future recurring event. */
  cooldown?: number
  choices: EventChoice[]
  /** Applied once, regardless of choice, the turn the event fires (M2's original energy-shock pattern). */
  worldShock?: ExternalShock
  tags?: string[]
  /**
   * M6.5 §3, §9: the narrative arc this episode belongs to, if any —
   * standalone events (crises with no sequel, one-off opportunities) leave
   * this unset. Every episode of the same arc shares the same `arcId`;
   * `arcStage` orders them for display/History (1 = opening episode).
   */
  arcId?: string
  arcStage?: number
  /**
   * M6.5 §9, §56: when this episode is a direct follow-up to an earlier
   * one, names it so the UI can show "CONSÉQUENCE DE VOTRE DÉCISION DE
   * {turn}" — purely descriptive, never itself used for eligibility (use
   * `conditions` + `engine/events/memory.ts` helpers for that).
   */
  followUpToEventId?: string
  /**
   * M6.5 §9: a coarse topic label (e.g. 'health', 'industrial', 'fiscal')
   * used for the variety/cooldown system — several DIFFERENT event ids can
   * share a topic so the selector avoids firing near-identical beats back
   * to back, without needing every one of them in the same formal arc.
   */
  topic?: string
}

/** A quick read of the economy for a `conditions`/`probabilityModifier` closure, without importing the whole EventEligibilityContext shape everywhere. */
export function economicStateOf(ctx: EventEligibilityContext): EconomicState {
  return ctx.gameState.economic
}
