import type { EconomicPolicyInput, ExternalShock } from '../../../engine/economy/types.ts'

/**
 * The full pre-presidency + 5-year mandate screen sequence. M3 (§1-9) added
 * everything through `budgetBuilder`. M4 (§21, §28, §31) added a generic
 * bill negotiation pipeline reused for BOTH the mandatory Budget Bill and a
 * discretionary reform: `'reformHub'` (choose the discretionary bill),
 * `'billNegotiation'` (concessions/courting/capital), `'billVote'` (the
 * resolved vote, for either bill).
 *
 * M5 §5-6, §38: the mandate is 30 turns, not one year, played through a
 * repeating annual cycle on top of that same M4 pipeline —
 * `'budgetBuilder'`/`'billNegotiation'`/`'billVote'`/`'reformHub'` are now
 * reused FIVE times (once per gameplay year), followed by 6 turns of
 * `'mandateTurn'` (the per-turn dashboard/hub — advances the calendar only
 * on explicit player confirmation, per M5 §5), each possibly interrupted by
 * `'event'` for a fired `EventDefinition`'s player choice, ending in
 * `'yearReview'` (BILAN ANNÉE X — also carries the special MI-MANDAT
 * banner at turn 18 rather than a separate screen id) and, after turn 30,
 * `'mandateReview'` ("5 ANS PLUS TARD"). `'energyShock'` is GONE — the
 * Energy Shock decision is migrated into the generic event catalog
 * (`events/eventCatalog.ts`'s `'energy-shock'` entry) rather than kept as
 * a duplicate fixed pre-mandate screen (M5 §11). `'yearReport'` is
 * likewise superseded by `'yearReview'`/`'mandateReview'`.
 */
export type ScreenId =
  | 'landing'
  | 'campaignIntro'
  | 'promiseSelection'
  | 'promiseConfirmation'
  | 'election'
  | 'franceBriefing'
  | 'governmentSelection'
  | 'legislativeElection'
  | 'parliamentComposition'
  | 'mandateStart'
  | 'bercyAudit'
  | 'budgetBuilder'
  | 'billNegotiation'
  | 'billVote'
  | 'reformHub'
  | 'mandateTurn'
  | 'event'
  | 'yearReview'
  | 'mandateReview'

export interface DecisionChoicePreview {
  label: string
  direction: 'up' | 'down' | 'strongUp' | 'strongDown' | 'neutral' | 'mixed'
}

/** One selectable option within a prototype decision (Bercy audit, energy shock). */
export interface DecisionChoice {
  id: string
  title: string
  copy: string
  previews: DecisionChoicePreview[]
  /** Real engine effect — merged into the accumulated policy stance (see policyDelta.ts, "Policy input units"). */
  policyDelta?: Partial<EconomicPolicyInput>
  /** Prototype-only popularity nudge (see popularity.ts) — never fed to the generic engine. */
  popularityDelta: number
  /** Prototype-only politicalCredibility nudge (GameState.political.politicalCredibility). */
  credibilityDelta?: number
}

export interface DecisionConfig {
  id: string
  title: string
  text: string
  choices: DecisionChoice[]
  /** Only the energy-shock decision carries an ExternalShock — applied regardless of the player's choice. */
  shock?: ExternalShock
}

/**
 * Accumulated player choices for the run — enough to replay deterministically
 * from the same seed. `selectedPromiseIds` and `governmentProfileId` are the
 * campaign-phase choices (M3 §3, §15); `bercyChoiceId` is the one remaining
 * fixed pre-mandate decision (M5 §11 keeps Bercy fixed at turn 0; Energy
 * Shock is gone from here — migrated into the generic event catalog). Every
 * recurring, per-year piece of mandate state (budget levels/draft, active
 * bill, promise resolutions, event history...) lives directly on
 * `GamePrototypeState`, not here — this type is only the ONE-OFF campaign
 * choices a save file needs to replay the opening sequence identically.
 */
export interface PlayerChoices {
  selectedPromiseIds: string[]
  governmentProfileId: string | null
  bercyChoiceId: string | null
}
