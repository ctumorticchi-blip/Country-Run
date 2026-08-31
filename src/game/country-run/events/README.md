# events/

Reserved for Country Run's actual events content built on the generic
`GameEvent` type from `src/engine/events/types.ts` (a `requires`/
`probability`/`effects`/`delayedEffects` shape meant for a larger,
data-driven event catalogue).

**Still empty as of M2.** The M2 vertical slice's one external event (the
energy price shock) is authored directly as an `ExternalShock`
(`src/engine/economy/types.ts`) inside
`game/country-run/prototype/decisions.ts` instead — it only needs to
modify `WorldState`/confidence once, with no `requires`/`probability`
roll, so the lighter `ExternalShock` shape was a better fit than the
generic `GameEvent`. If/when a larger, conditionally-triggered event
catalogue is authored, that's what this folder and `GameEvent` are for.
