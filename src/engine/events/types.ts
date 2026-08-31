import type { Condition } from '../conditions/types.ts'
import type { DelayedEffect } from '../effects/delayedEffect.ts'
import type { Effect } from '../effects/types.ts'

/**
 * A generic, data-driven external event: available only when `requires`
 * holds, then triggered with `probability` (Product Bible §16, "Les
 * événements doivent être data-driven avec requires / probability / effects
 * / delayedEffects"). Concrete Country Run events (content) are authored
 * under src/game/country-run/events using this shape — none exist yet at
 * M0.
 */
export interface GameEvent {
  id: string
  title: string
  description?: string
  /** Only eligible to trigger when this condition holds (if present). */
  requires?: Condition
  /** Probability in [0, 1] of triggering once eligible. Defaults to 1 (always) when absent. */
  probability?: number
  effects?: Effect[]
  delayedEffects?: DelayedEffect[]
}
