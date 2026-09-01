import type { EconomicPolicyInput, ExternalShock } from '../../../engine/economy/types.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'

/**
 * The full pre-presidency + Year 1 screen sequence. M3 (§1-9) added
 * everything through `budgetBuilder`. M4 (§21, §28, §31) replaces the old
 * `'parliamentVote'` single negotiate/maintain/concede screen with a
 * generic negotiation pipeline reused for BOTH the mandatory Budget Bill
 * and the one discretionary Year 1 reform: `'reformHub'` (choose the
 * discretionary bill), `'billNegotiation'` (concessions/courting/capital),
 * `'billVote'` (the resolved vote, for either bill).
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
  | 'energyShock'
  | 'budgetBuilder'
  | 'billNegotiation'
  | 'billVote'
  | 'reformHub'
  | 'yearReport'

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
 * campaign-phase choices (M3 §3, §15); `bercyChoiceId`/`energyChoiceId`/
 * `budgetSelections` are the Year 1 gameplay choices carried over unchanged
 * from M2. The old `parliamentChoiceId` (M2's negotiate/maintain/concede
 * pick) is gone — the Budget Bill's negotiation state now lives in
 * `GamePrototypeState.activeBill`/`billHistory` (M4 §36).
 */
export interface PlayerChoices {
  selectedPromiseIds: string[]
  governmentProfileId: string | null
  bercyChoiceId: string | null
  energyChoiceId: string | null
  budgetSelections: BudgetSelections
}
