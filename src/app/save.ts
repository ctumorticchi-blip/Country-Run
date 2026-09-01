import { GAME_VERSION, type GamePrototypeState } from './gameReducer.ts'

/**
 * M5 §56: local save/resume. `GamePrototypeState` is already fully
 * JSON-serializable (M3 §28/M4 §36's own tests prove a JSON round-trip is
 * lossless) — this module is intentionally thin: no custom (de)serializer,
 * no migration logic, just `JSON.stringify`/`JSON.parse` gated by
 * `GAME_VERSION`. An incompatible or corrupt save is never partially
 * loaded or "fixed up" — it fails safely to `null`, and the caller falls
 * back to a brand-new game (App.tsx always constructs a fresh
 * `GamePrototypeState` regardless of what `loadGame` returns).
 *
 * Crucially, none of this can alter the RNG sequence: every random draw in
 * this codebase is derived fresh via `createActionRng(seed, label)` (see
 * prototype/rng.ts), where `label` is built from state already present in
 * `GamePrototypeState` (the current turn, a bill id, an attempt number...).
 * Reloading from a save and continuing therefore reproduces EXACTLY the
 * same draws a continuous, uninterrupted run would have made — the RNG has
 * no notion of "how many times the page was loaded", only of the state
 * it's given.
 */
const SAVE_KEY = 'country-run:save-v1'

/** A minimal `Storage`-shaped interface — `localStorage`-compatible, but swappable in tests without needing a DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function resolveStore(store?: KeyValueStore): KeyValueStore | null {
  if (store) return store
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

/** Called after every resolved turn/decision (App.tsx saves on every state change) — cheap and idempotent, so over-saving is harmless. */
export function saveGame(state: GamePrototypeState, store?: KeyValueStore): void {
  const target = resolveStore(store)
  if (!target) return
  try {
    target.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Storage full, private-browsing restrictions, or unavailable — non-critical, fail silently (same pattern as the clipboard/share fallbacks elsewhere in this app).
  }
}

/** `null` for "no save" AND for "an incompatible/corrupt save" — the caller doesn't need to distinguish the two, both mean "start fresh". */
export function loadGame(store?: KeyValueStore): GamePrototypeState | null {
  const target = resolveStore(store)
  if (!target) return null
  try {
    const raw = target.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GamePrototypeState>
    if (parsed.gameVersion !== GAME_VERSION) return null
    return parsed as GamePrototypeState
  } catch {
    return null
  }
}

export function clearSave(store?: KeyValueStore): void {
  const target = resolveStore(store)
  if (!target) return
  try {
    target.removeItem(SAVE_KEY)
  } catch {
    // ignore — nothing meaningful to recover from here either.
  }
}
