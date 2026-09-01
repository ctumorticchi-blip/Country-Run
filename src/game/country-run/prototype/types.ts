import type { EconomicPolicyInput, ExternalShock } from '../../../engine/economy/types.ts'
import type { BudgetSelections } from '../budget/budgetTypes.ts'

/**
 * The full pre-presidency + Year 1 screen sequence (M3 §1-9, extending the
 * M2 vertical slice). `'parliament'` was renamed `'parliamentVote'` to
 * disambiguate it from the new `'parliamentComposition'` screen (the
 * legislative election's seat results) — same Year 1 budget-vote screen as
 * M2, just a clearer name now that Parliament has two distinct screens.
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
  | 'parliamentVote'
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

export interface ParliamentChoiceConfig {
  id: 'negotiate' | 'maintain' | 'concede'
  title: string
  copy: string
  passProbability: number
  concession: Partial<EconomicPolicyInput>
  popularityDelta: number
}

export type ParliamentOutcome = 'adopted' | 'rejected'

/**
 * Accumulated player choices for the run — enough to replay deterministically
 * from the same seed. `selectedPromiseIds` and `governmentProfileId` are the
 * campaign-phase choices (M3 §3, §15); everything else is the Year 1
 * gameplay choices carried over unchanged from M2.
 */
export interface PlayerChoices {
  selectedPromiseIds: string[]
  governmentProfileId: string | null
  bercyChoiceId: string | null
  energyChoiceId: string | null
  budgetSelections: BudgetSelections
  parliamentChoiceId: ParliamentChoiceConfig['id'] | null
}
