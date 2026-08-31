import type { Condition } from '../conditions/types.ts'
import type { DelayedEffect } from '../effects/delayedEffect.ts'
import type { Effect } from '../effects/types.ts'

/** One selectable choice within a Decision. */
export interface DecisionOption {
  id: string
  label: string
  effects: Effect[]
  delayedEffects?: DelayedEffect[]
}

/**
 * A generic engine-level decision point: a prompt with a small set of
 * options, each carrying its own effects. Concrete Country Run decisions
 * (content) are authored under src/game/country-run/decisions using this
 * shape — none exist yet at M0.
 */
export interface Decision {
  id: string
  title: string
  description?: string
  /** Only offered to the player when this condition holds (if present). */
  condition?: Condition
  options: DecisionOption[]
}
