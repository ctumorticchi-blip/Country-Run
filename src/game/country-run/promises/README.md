# promises/

Country Run's campaign promise library (M3 §5-9), authored with its own
`PromiseDefinition` shape (`promiseTypes.ts`) rather than the generic
engine's `GamePromise` (`src/engine/state/promise.ts`) — see
`promiseTypes.ts`'s header comment for why the two `PromiseStatus` types
are deliberately distinct.

- `promiseTypes.ts` — the `PromiseDefinition`/`PromiseStatus`/`PoliticalTag` shapes.
- `promiseCatalog.ts` — the 15 static promises (content-as-code).
- `promiseEvaluators.ts` — 3 reusable evaluator shapes.
- `promiseSelection.ts` — selection validity, fiscal cost aggregation, tag coherence.

See `docs/GAMEPLAY_M3.md` for the full architecture writeup.
