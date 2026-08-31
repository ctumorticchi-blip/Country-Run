import { SeededRng } from '../../../engine/seeded-rng/SeededRng.ts'

/**
 * RNG safety (M2 §26): `SeededRng` is a stateful class — mutating one
 * instance across renders would break the moment React's `<StrictMode>`
 * double-invokes a reducer (it does, in development, specifically to catch
 * impure reducers) or a component re-renders for unrelated reasons. If a
 * single shared RNG instance advanced on every render/dispatch, a
 * double-invoke would silently burn an extra random draw and desync the
 * displayed state from what a second run of the same actions would
 * produce.
 *
 * The fix used everywhere in this game's UI layer: never store a mutable
 * `SeededRng` instance in React/game state. Instead, derive a FRESH
 * instance for each discrete game action, keyed by the game's seed plus a
 * label unique to that action (e.g. the current turn number and a step
 * name). Deriving a fresh instance from a pure string key means calling
 * the same action twice (StrictMode's double-invoke, or any other
 * re-render) always reproduces the exact same random draws — there is no
 * shared mutable state to advance twice. `SeededRng` itself never needs to
 * change for this; only the calling convention does.
 *
 * All simulation-advancing logic runs inside the game reducer, dispatched
 * only by explicit player actions (button clicks) — never inside a render
 * function or a `useEffect` that could re-fire.
 */
export function createActionRng(seed: string, label: string): SeededRng {
  return new SeededRng(`${seed}::${label}`)
}
