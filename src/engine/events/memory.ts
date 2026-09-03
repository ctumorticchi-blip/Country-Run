/**
 * M6.5 §2: a generic, France-agnostic event-memory record. Lives in
 * `engine/` (never `game/country-run/`) precisely because it carries no
 * content — no event ids, arc names, or choice semantics are hardcoded
 * here, only the shape a content layer uses to remember what happened.
 * Plain, serializable data (a save-file entry), never a class instance.
 */
export interface EventMemory {
  /** The narrative arc this event belongs to, if any — absent for a standalone event. */
  arcId?: string
  eventId: string
  turn: number
  choiceId: string
  /** Free-form labels a content layer can filter/query by (e.g. a topic, a family, a severity). */
  tags: readonly string[]
  /** An optional numeric payload a content layer can use for later magnitude-aware branching (e.g. "how much was invested"). */
  numericContext?: number
  /** An optional free-form status a content layer can use for arc bookkeeping (e.g. "SUCCESS" | "FAILED" | "ONGOING"). */
  status?: string
}

export function recordEventMemory(memories: readonly EventMemory[], memory: EventMemory): EventMemory[] {
  return [...memories, memory]
}

/** Every memory for a given arc, oldest first (memories are always appended in turn order). */
export function memoriesForArc(memories: readonly EventMemory[], arcId: string): EventMemory[] {
  return memories.filter((m) => m.arcId === arcId)
}

/** Every memory for one specific event id — normally 0 or 1 for a one-shot event, but a recurring one may fire more than once. */
export function memoriesForEvent(memories: readonly EventMemory[], eventId: string): EventMemory[] {
  return memories.filter((m) => m.eventId === eventId)
}

/** Every memory carrying a given tag, across every arc/event — the basis for topic/family cooldowns. */
export function memoriesWithTag(memories: readonly EventMemory[], tag: string): EventMemory[] {
  return memories.filter((m) => m.tags.includes(tag))
}

/** The most recent memory for an arc, or `null` if the arc has never fired — the usual way a follow-up episode reads "what did the player choose last time". */
export function latestMemoryForArc(memories: readonly EventMemory[], arcId: string): EventMemory | null {
  const arcMemories = memoriesForArc(memories, arcId)
  return arcMemories.length > 0 ? arcMemories[arcMemories.length - 1] : null
}

/** True if any memory for this arc recorded the given choice id — the common "did the player ever pick X" query for a follow-up's conditions. */
export function arcHasChoice(memories: readonly EventMemory[], arcId: string, choiceId: string): boolean {
  return memoriesForArc(memories, arcId).some((m) => m.choiceId === choiceId)
}

/** Turns since the most recent memory carrying `tag` — `Infinity` if it never happened, for a simple `turnsSinceTag(...) >= cooldown` check. */
export function turnsSinceTag(memories: readonly EventMemory[], tag: string, currentTurn: number): number {
  const tagged = memoriesWithTag(memories, tag)
  if (tagged.length === 0) return Infinity
  const mostRecentTurn = Math.max(...tagged.map((m) => m.turn))
  return currentTurn - mostRecentTurn
}
