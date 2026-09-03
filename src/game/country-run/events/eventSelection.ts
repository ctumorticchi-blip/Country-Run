import { turnsSinceTag } from '../../../engine/events/memory.ts'
import { createActionRng } from '../prototype/rng.ts'
import type { EventDefinition, EventEligibilityContext } from './eventTypes.ts'

/** M6.5 §9: minimum turns between two DIFFERENT events sharing a `topic` — about 1 gameplay year, so the same subject can't dominate a run, while still letting a deliberate arc escalate faster (see the `arcId` exemption below). */
export const TOPIC_COOLDOWN_TURNS = 6

/**
 * M6.5 §9: true when `event` should be suppressed by the topic/variety
 * cooldown — its `topic` recently fired from a DIFFERENT arc (or no arc at
 * all). An event always stays eligible for its OWN arc's next episode
 * (`arcId` matches the most recent same-topic memory) — a cooldown exists
 * to stop unrelated near-duplicate beats, never to block a deliberate
 * escalating storyline.
 */
function suppressedByTopicCooldown(event: EventDefinition, ctx: EventEligibilityContext): boolean {
  if (!event.topic) return false
  const memories = ctx.eventMemories ?? []
  const sameTopic = [...memories].reverse().find((m) => m.tags.includes(`topic:${event.topic}`))
  if (!sameTopic) return false
  if (event.arcId && sameTopic.arcId === event.arcId) return false
  return ctx.turn - sameTopic.turn < TOPIC_COOLDOWN_TURNS
}

/**
 * M5 §7-10, §24: deterministic per-turn event selection. Every eligible
 * event is filtered by turn window / one-shot-already-fired /
 * `exclusiveGroup` (at most one event per group fires in a run) /
 * `conditions` / M6.5's topic cooldown, THEN a single RNG roll per turn
 * (never one roll per candidate event — that would make the actual fire
 * rate depend on how many events happen to be eligible that turn) walks
 * the eligible list in a fixed, seed-independent order (sorted by id)
 * accumulating probability mass, so the same turn+seed+state always
 * yields the same outcome.
 */
export function eligibleEvents(events: readonly EventDefinition[], ctx: EventEligibilityContext): EventDefinition[] {
  const firedGroups = new Set(
    events.filter((e) => ctx.firedEventIds.includes(e.id) && e.exclusiveGroup).map((e) => e.exclusiveGroup),
  )
  return events.filter((e) => {
    if (ctx.turn < e.earliestTurn || ctx.turn > e.latestTurn) return false
    if (ctx.firedEventIds.includes(e.id)) return false
    if (e.exclusiveGroup && firedGroups.has(e.exclusiveGroup)) return false
    if (e.cooldown && ctx.eventMemories && turnsSinceTag(ctx.eventMemories, `event:${e.id}`, ctx.turn) < e.cooldown) return false
    if (suppressedByTopicCooldown(e, ctx)) return false
    if (e.conditions && !e.conditions(ctx)) return false
    return true
  })
}

/** At most one event per turn — `null` when no event fires. */
export function selectEventForTurn(
  events: readonly EventDefinition[],
  ctx: EventEligibilityContext,
  seed: string,
): EventDefinition | null {
  const eligible = eligibleEvents(events, ctx)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  if (eligible.length === 0) return null

  const rng = createActionRng(seed, `event-turn-${String(ctx.turn)}`)
  const roll = rng.next()
  let cumulative = 0
  for (const event of eligible) {
    const modifier = event.probabilityModifier ? event.probabilityModifier(ctx) : 1
    const probability = Math.min(1, Math.max(0, event.baseProbability * modifier))
    cumulative += probability
    if (roll < cumulative) return event
  }
  return null
}
