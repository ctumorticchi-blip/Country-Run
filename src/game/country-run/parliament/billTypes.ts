import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { Turn } from '../../../engine/state/gameState.ts'
import type { BillStatus, BillUrgency, ConcessionType, PolicyAffinity } from './politicalTypes.ts'

/**
 * Static content for one reusable bill/reform (M4 §5, §30) — content-as-code
 * like `promiseCatalog.ts`. Deliberately has NO `status` field: status is
 * runtime state (`ActiveBillState` below), never part of the definition,
 * for the same reason a `PromiseDefinition` never stores whether it's been
 * kept — see this file's header note on the 3-layer split.
 *
 * ## The 3-layer split (mirrors M3's promise architecture)
 *
 * 1. `PoliticalBillDefinition` (this type) — static, content-as-code.
 * 2. `ActiveBillState` (below) — the ONLY thing persisted in
 *    `GamePrototypeState.activeBill`: a `billId` pointer plus the player's
 *    accumulated negotiation choices (which concessions were applied, which
 *    blocs were courted, capital spent, current `status`).
 * 3. `EffectiveBill` (`concessions.ts`'s `applyConcessionsToBill`) — the
 *    DERIVED bill (definition + applied concessions merged in), computed
 *    fresh every time support is estimated or the vote is resolved, never
 *    stored. This is what prevents a concession from being double-applied
 *    (M4 §38, the M1.5 regression class): there is exactly one place that
 *    combines a definition with its concessions, and every consumer
 *    (support estimate, vote resolution, the eventual economic simulation)
 *    calls it fresh from the same `appliedConcessionIds` list instead of
 *    each keeping its own mutated copy.
 */
export interface PoliticalBillDefinition {
  id: string
  title: string
  description: string
  /** The bill's own lean on each axis, in [-1, 1] (M4 §4) — used for the bloc-affinity dot product. */
  policyTags: PolicyAffinity
  /** The real `EconomicPolicyInput` delta if adopted, BEFORE concessions — fed into the engine exactly once, on adoption. */
  economicPolicyEffect: Partial<EconomicPolicyInput>
  /** Md€/year, base fiscal cost before concessions. */
  fiscalCost: number
  /** [0, 1] — how structurally deep the reform is. */
  reformIntensity: number
  /** [0, 1] — how politically charged the bill is; scales down broad support and sharpens red-line reactions. */
  controversy: number
  /** Promise ids this bill helps deliver (M4 §27) — feeds a small support/capital bonus when the player is pursuing something they promised. */
  promiseLinks: string[]
  /** Political capital spent just to bring the bill to a vote (M4 §9), on top of anything spent negotiating. */
  requiredPoliticalCapital: number
  urgency: BillUrgency
  /** [0, 1] — how much concessions can realistically move support on this bill. */
  negotiability: number
  concessionsAvailable: ConcessionType[]
  /** Seats needed to pass — `ABSOLUTE_MAJORITY` (289) for every M4 bill; a distinct field so a future milestone can model other thresholds. */
  voteThreshold: number
  /** Turns between adoption and the `economicPolicyEffect` actually landing (M4 §29) — 0 means "next turn's simulation already includes it". */
  implementationDelay: number
}

/**
 * The ONLY bill-related state persisted in `GamePrototypeState` (M4 §36).
 * `appliedConcessionIds` is a Set-like array — `concessions.ts` enforces
 * "no concession twice" when adding to it.
 */
export interface ActiveBillState {
  billId: string
  status: BillStatus
  appliedConcessionIds: ConcessionType[]
  courtedBlocIds: string[]
  /** Cumulative political capital spent negotiating THIS bill (SPEND_POLITICAL_CAPITAL + SEEK_SUPPORT costs) — separate from `requiredPoliticalCapital`, which is charged once when the bill is first proposed. */
  capitalSpent: number
  turnProposed: Turn
  /** Capped (M4 §19, "prevent infinite retries in the same turn"). */
  voteAttempts: number
}

export const MAX_VOTE_ATTEMPTS = 3

/**
 * A finalized bill outcome (M4 §16, §36) — appended to
 * `GamePrototypeState.billHistory` once a bill reaches a terminal status
 * (ADOPTED, a final REJECTED, or WITHDRAWN). Deliberately does NOT
 * duplicate an economic snapshot (M4 §16: "avoid storing duplicate
 * economic snapshots... store decisions/events") — `votesFor`/
 * `votesAgainst`/`abstentions` are the vote's own numbers, not a copy of
 * `EconomicState`.
 */
export interface BillHistoryEntry {
  turn: Turn
  billId: string
  billTitle: string
  status: 'ADOPTED' | 'REJECTED' | 'WITHDRAWN'
  votesFor: number
  votesAgainst: number
  abstentions: number
  appliedConcessionIds: ConcessionType[]
  usedExceptionalProcedure: boolean
  politicalCapitalDelta: number
  popularityDelta: number
}
