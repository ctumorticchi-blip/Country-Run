# decisions/

Reserved for Country Run's actual decisions content built on the generic
`Decision` type from `src/engine/state/decision.ts`.

**Still empty as of M2.** The M2 vertical slice's two decisions (the
Bercy audit and the energy shock) are authored as a simpler, ad-hoc
`DecisionConfig` shape under `game/country-run/prototype/decisions.ts`
instead — a lighter-weight structure suited to exactly two hardcoded
decisions, not the generic `Decision`/`DecisionOption` engine type (which
expects `Condition`/`Effect` values, more machinery than two fixed
choices need). If/when a larger decision library is authored, revisit
whether `prototype/decisions.ts`'s content should move here onto the
generic type instead.
