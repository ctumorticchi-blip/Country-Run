import type { EconomicPolicyInput } from '../../../engine/economy/types.ts'
import type { Turn } from '../../../engine/state/gameState.ts'

/**
 * M5 §38: fixes M4's limitation ("implementationDelay existed but was not
 * scheduled") — when a bill is ADOPTED, `mandate/turnController.ts`
 * pushes one of these; the turn controller applies it at exactly
 * `scheduledTurn`, then removes it from the queue, mirroring the generic
 * engine's own `delayedEffect.ts` "register now, apply once, remove"
 * pattern (kept as a SEPARATE queue here because a bill's economic effect
 * is a sustained `EconomicPolicyInput` contribution, folded into the
 * mandate's running policy total — not a one-off `Effect` state write like
 * `engine/effects/delayedEffect.ts` schedules). Deliberately generic
 * (`sourceId`/`label`, not `billId`/`billTitle`) — the turn controller
 * reuses this SAME queue for an event choice's own `EventDelayedEffect`
 * (M5 §9), not just bill adoption, rather than maintaining two
 * near-identical queues.
 */
export interface ScheduledImplementation {
  sourceId: string
  label: string
  adoptedTurn: Turn
  scheduledTurn: Turn
  policyEffect: Partial<EconomicPolicyInput>
}

export function scheduleImplementation(
  schedule: readonly ScheduledImplementation[],
  entry: ScheduledImplementation,
): ScheduledImplementation[] {
  return [...schedule, entry]
}

/** Entries whose `scheduledTurn` has been reached. */
export function dueImplementations(schedule: readonly ScheduledImplementation[], currentTurn: Turn): ScheduledImplementation[] {
  return schedule.filter((entry) => entry.scheduledTurn <= currentTurn)
}

/** Entries still waiting — the caller replaces the full queue with this after applying the due ones, so each entry is applied exactly once. */
export function pendingImplementations(schedule: readonly ScheduledImplementation[], currentTurn: Turn): ScheduledImplementation[] {
  return schedule.filter((entry) => entry.scheduledTurn > currentTurn)
}
