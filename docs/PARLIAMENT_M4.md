# Parliament — M4 (Negotiation & Political Capital)

M4 turns Parliament from a single seeded coin flip (M2/M3) into a real
political-strategy layer: 7 data-driven blocs with differentiated policy
affinities, a generic bill/negotiation/vote pipeline reused for both the
mandatory annual Budget Bill and one discretionary Year 1 reform, spendable
and recoverable political capital, bloc-level relationship memory, and an
"engager la responsabilité du gouvernement" exceptional procedure. This
document explains what M4 added; it does not re-explain the M1.5 engine
(`docs/ECONOMIC_ENGINE.md`) or the M2/M3 layers (`docs/GAMEPLAY_M2.md`,
`docs/GAMEPLAY_M3.md`), which are otherwise unchanged.

## Design philosophy (M4 §1)

Deliberately NOT a dice-roll and NOT a procedural simulator. The target is
"80% instantly understandable, 20% deeper strategy": a player should be
able to read one screen and think *"I need 26 more votes — who can I
convince, and what will it cost me?"* without needing to understand the
underlying formula. Every number the player sees is a range or a bounded
estimate (M4 §6, §32-34) — never a fabricated precise prediction — while
the actual vote resolution underneath is fully deterministic from
`(seed, bill, negotiation state)`.

## New modules (`src/game/country-run/parliament/`)

| Module | Responsibility |
| --- | --- |
| `politicalTypes.ts` | Shared primitives: `PolicyDimension` (12 axes), `ConcessionType` (6), `BillStatus`, `BlocStance`, `SupportConfidence` |
| `blocTypes.ts` / `blocDefinitions.ts` | The `ParliamentBlocDefinition` shape and the 7 canonical blocs |
| `billTypes.ts` | `PoliticalBillDefinition` (static), `ActiveBillState` (runtime), `BillHistoryEntry` (finalized) — see "3-layer split" below |
| `bills.ts` | The 4 discretionary Year 1 bills |
| `budgetBillDerivation.ts` | Derives the mandatory Budget Bill live from Budget Builder choices |
| `concessions.ts` | The 6 concession definitions + `applyConcessionsToBill` (the ONE place a bill and its concessions combine) |
| `supportEstimate.ts` | The centralized, documented support formula — ranges only |
| `voteResolution.ts` | Deterministic actual vote resolution |
| `blocRelations.ts` | Bloc-level relationship memory, [-100, 100] |
| `politicalDeal.ts` | The `PoliticalDeal` record type |
| `exceptionalProcedure.ts` | "ENGAGER LA RESPONSABILITÉ DU GOUVERNEMENT" |

`prototype/politicalCapital.ts` (M3) gained spend/recover/cost-range
functions; `prototype/parliamentComposition.ts` (M3) now sources its
6 opposition blocs' data from `parliament/blocDefinitions.ts` instead of
an inline list — the seat-generation ALGORITHM itself (`computePlayerSeats`,
`proportionalSplit`, the RNG jitter) is untouched from M3.

## The 7 canonical blocs

`PRESIDENTIAL_BLOC` (the player's own coalition — always votes for) plus 6
entirely fictional opposition blocs: `REFORM_CENTER`, `SOCIAL_LEFT`,
`ECOLOGISTS`, `CONSERVATIVE_RIGHT`, `NATIONAL_POPULISTS`, `NON_ATTACHED`.
No real French party is named or implied (verified in
`blocDefinitions.test.ts`). Each carries a `policyAffinity` across the 12
`PolicyDimension`s (signed intensity, e.g. `businessTax: -1` means "cuts
business tax", not an absolute stance), a `negotiationStyle` (flavor),
`reliability`, `baseGovernmentSupport`, `redLines` (dimensions where a
strongly opposed bill value caps support near-zero), `preferredConcessions`,
and `politicalTags` (reused from `promises/promiseTypes.ts` for the
promise-linked bonus and, unchanged from M3, the legislative-election seat
weighting). No bloc is a caricature: e.g. `CONSERVATIVE_RIGHT` supports
`laborMarket` deregulation but opposes `fiscalDiscipline`-eroding bills,
while still having a *positive* `defense` affinity — a bill can win part of
a bloc's favor and lose another part.

`seatWeight` (not in the brief's suggested field list) is a generation-only
input to `parliamentComposition.ts`'s seat split — it is never itself a
seat count. The actual per-playthrough seat count for each bloc lives
exactly where M3 put it: `ParliamentComposition.blocs[i].seats`, generated
once at the legislative election.

## The bill model — a 3-layer split

Mirrors M3's promise architecture exactly, to avoid both storing derived
data AND double-applying a concession (M4 §38, the M1.5 regression class):

1. **`PoliticalBillDefinition`** — static content-as-code. No `status`
   field.
2. **`ActiveBillState`** — the ONLY bill-related state in
   `GamePrototypeState.activeBill`: a `billId` pointer plus the player's
   accumulated negotiation choices (`appliedConcessionIds`,
   `courtedBlocIds`, `capitalSpent`, `voteAttempts`, `status`).
3. **`EffectiveBill`** (`concessions.ts`'s `applyConcessionsToBill`) — the
   DERIVED bill (definition + concessions merged in), computed fresh every
   time support is estimated, the vote is resolved, or Year 1 is
   finalized. There is exactly one function that combines a definition
   with its concessions; every consumer calls it from the same
   `appliedConcessionIds` list rather than keeping its own mutated copy —
   `concessions.test.ts`'s "recomputing... never compounds the delta" and
   `gameReducer.test.ts`'s "a concession applied once contributes its
   fiscal delta exactly once" both assert this directly.

The Budget Bill is a special case: `budgetBillDerivation.ts`'s
`deriveBudgetBill` computes its `PoliticalBillDefinition` live from
`state.choices.budgetSelections` — nothing about it is stored except which
concessions were later applied.

## The support formula (`supportEstimate.ts`)

Centralized — no magic numbers in any screen component. For each
non-presidential bloc:

```
affinity          = normalized dot product of bill.policyTags · bloc.policyAffinity
base              = 0.5 + affinity × 0.35 + bloc.baseGovernmentSupport × 0.15
relationBonus     = blocRelations[bloc] / 100 × 0.15
popularityBonus   = (popularity − 50) / 50 × 0.05        (§26: modest, capped)
negotiationBonus  = (government.parliamentNegotiation − 1) × 0.5
fiscalCredibility = bloc has 'fiscalDiscipline' tag ? (government.fiscalForecastAccuracy − 1) × 0.3 : 0
controversyGovBoost = bill.controversy × (government.reformEffectiveness − 1) × 0.5
controversyPenalty  = (bill.controversy + controversyGovBoost) × 0.2 × (1 − max(0, affinity))
courtedBonus      = courted this negotiation ? +0.08 : 0
capitalBonus      = min(0.2, capitalSpentThisNegotiation / 100)
promiseBonus      = bill.promiseLinks non-empty ? +0.03 : 0

probability = clamp(0.03, 0.97, sum of all the above)
if any bloc.redLines dimension has bill.policyTags[dim] <= −0.5: probability = min(probability, 0.15)
```

This single function (`computeBlocSupportProbability`) backs BOTH the
pre-vote estimate (`estimateBillSupport`, which widens it into a
`[low, high]` seat range with a fixed ±0.15 probability uncertainty band)
and the actual vote (`voteResolution.ts`, which draws a small deterministic
jitter around the same probability). The player only ever sees the range +
a `HIGH`/`MEDIUM`/`LOW` confidence label — never the bare number.

### Government profile integration (M4 §25)

Reuses M3's existing 7 government dimensions — no new modifier fields were
added, per "use M3 government modifiers, do not redesign M3":

- **Les Politiques**: high `parliamentNegotiation` → `negotiationBonus` above.
- **Le Gouvernement d'Union**: high `parliamentNegotiation` +
  `popularityResilience` — no separate "relationship baseline" coefficient
  exists; the brief's "better cross-bloc relationship baseline" is an
  emergent property of those two M3 dimensions rather than an 8th one.
- **Les Experts**: high `fiscalForecastAccuracy` → `fiscalCredibilityBonus`,
  but ONLY for blocs carrying the `fiscalDiscipline` political tag
  (`CONSERVATIVE_RIGHT`, `REFORM_CENTER`) — verified in
  `supportEstimate.test.ts` to leave other blocs (e.g. `ECOLOGISTS`)
  untouched.
- **Les Réformateurs**: high `reformEffectiveness` → `controversyGovBoost`
  (their own reforms read as more socially resistant), and (unchanged from
  M3) `implementationSpeed` shortens delayed-effect horizons via
  `deriveGovernmentEngineConfig`.

## Vote resolution (`voteResolution.ts`)

Deterministic: `resolveVote(seed, attemptNumber, bill, composition,
blocRelations, popularity, governmentModifiers, negotiation)` always
returns the same `{votesFor, votesAgainst, abstentions, blocBreakdown,
passed}` for the same inputs (`voteResolution.test.ts`). Each
non-presidential bloc's seats are split for/against/abstain using the
largest-remainder method (the same deterministic-rounding technique
`parliamentComposition.ts` already used for seat generation), so every
bloc row — and therefore the grand total — sums to exactly the Assembly's
seat count. Abstention share peaks for a torn bloc (probability near 0.5)
and shrinks toward 0 for a decisive one. The presidential bloc always
votes FOR in full — this game never models the president's own coalition
defecting. `attemptNumber` is part of the deterministic key, so a second
vote attempt on an unchanged negotiation still draws independently.

## Political capital (`prototype/politicalCapital.ts`)

M3 computed a starting value once; M4 makes it live:

- **Costs** (M4 §9): `requiredPoliticalCapital` charged once when a bill is
  proposed; `SEEK_SUPPORT_CAPITAL_COST` (2) per courted bloc;
  `NEGOTIATE_SPEND_CAPITAL` up to `MAX_CAPITAL_SPEND_PER_ACTION` (20) per
  action; `EXCEPTIONAL_PROCEDURE_CAPITAL_COST` (25) for the exceptional
  procedure. `classifyReformDifficulty`/`politicalCapitalCostRange` map a
  bill's `controversy` to the brief's 4 documented tiers (EASY 0-5,
  MODERATE 5-12, DIFFICULT 12-20, VERY_CONTROVERSIAL 20-30) for display.
- **Recovery/loss** (M4 §10): `politicalCapitalDeltaFromBillOutcome` — a
  passed vote recovers `2 + reformIntensity × 3`; a rejected one costs
  `4 + controversy × 6`. `politicalCapitalDeltaFromYearEnd` adds a small
  (±5 max) drift from the mandate's overall popularity/growth trajectory.
  Every function is bounded to `[0, 100]` via `clampPoliticalCapital` —
  it can never go negative.

## Bloc relationships & deals

`blocRelations.ts`'s `BlocRelations` (`Partial<Record<string, number>>`,
[-100, 100]) is nudged at every TERMINAL bill resolution (not on an
in-progress rejection that still has retries left) via
`RELATIONSHIP_EFFECTS`: `SUCCESSFUL_AGREEMENT` (+6, a preferred concession
was granted and the bloc favored the bill), `COURTED_AND_DELIVERED` (+3,
courted only), `PASSIVE_GOODWILL` (+2, favored without any negotiation
touch), `BROKEN_AGREEMENT` (-8, courted/conceded-to but still opposed),
`PROCEDURAL_FORCING` (-12, the exceptional procedure was used against a
bloc's clear opposition). Whenever a bloc was courted or received one of
its preferred concessions, a `PoliticalDeal` (`politicalDeal.ts`) is
recorded and marked `fulfilled` based on whether that bloc's seats actually
favored the final outcome — visible in `GamePrototypeState.politicalDeals`.

## Exceptional procedure (M4 §20)

`ENGAGER LA RESPONSABILITÉ DU GOUVERNEMENT` — a deliberately fictionalized
name, not "49.3" — bypasses the vote entirely (`resolveExceptionalProcedure`
in `gameReducer.ts`): the bill is force-adopted, costing
`EXCEPTIONAL_PROCEDURE_CAPITAL_COST` (25) capital and
`EXCEPTIONAL_PROCEDURE_POPULARITY_PENALTY` (-6) popularity, and bumping
`governmentTension` by 15 (bounded [0, 100]). Every bloc that was clearly
opposed at the moment of forcing (`blocsHostileToProcedure`, support
probability < 0.4) takes the `PROCEDURAL_FORCING` relationship hit. `M4`
tracks `governmentTension` purely as architecture for a future confidence-
vote/government-collapse mechanic — no such mechanic exists yet this
milestone.

## Concessions feed back into real economics (M4 §13)

Every concession in `concessions.ts` carries an `economicPolicyEffectDelta`
(merged additively into the bill's `EconomicPolicyInput` via
`applyConcessionsToBill`) and a `policyTagDelta` (shifts the bill's
`policyTags`, changing how compatible blocs react on the SAME support
formula above). A concession is never cosmetic: it changes the bill's
displayed fiscal cost, the actual policy fed to the simulation on
adoption, and every bloc's computed support — all from the SAME merged
`EffectiveBill`, so nothing can drift out of sync.

## Bill pipeline (M4 §28)

```
SUBMIT_BUDGET / PROPOSE_BILL     → activeBill created (status NEGOTIATING)
NEGOTIATE_SEEK_SUPPORT /
NEGOTIATE_OFFER_CONCESSION /
NEGOTIATE_SPEND_CAPITAL          → mutate activeBill's negotiation state only
NEGOTIATE_REFUSE_COMPROMISE      → status → READY_FOR_VOTE
CALL_VOTE                        → resolveVote(); passed or attempts-exhausted
                                    → TERMINAL: billHistory entry, activeBill → null
                                    → otherwise: status REJECTED, retry available
RENEGOTIATE_BILL / WITHDRAW_BILL → retry (budget bill can never be withdrawn)
USE_EXCEPTIONAL_PROCEDURE        → TERMINAL (ADOPTED), bypasses CALL_VOTE
```

`MAX_VOTE_ATTEMPTS` (3) bounds the renegotiate loop — the mandatory Budget
Bill auto-resolves via M2's existing `COMPROMISE_SCALE_ON_REJECTION` (0.5)
if it's still rejected after 3 attempts (a scaled-down version of the
Bill's own policy still applies, so Year 1 always has SOME budget); a
rejected discretionary bill simply contributes nothing to the simulation —
it was optional. `finalizeYearOne` (`gameReducer.ts`) runs the ONE real
`simulateYearOne` call for the year, merging Bercy + energy (unchanged
immediate presidential decisions) + the Budget Bill's effective policy
(scaled on an exhausted rejection) + the discretionary bill's effective
policy (only if ADOPTED).

## Reform Hub — exactly one discretionary bill per Year 1 (M4 §31)

`hasUsedDiscretionaryBillSlot` (derived, never stored) checks
`billHistory`/`activeBill` for any non-budget bill id — once true,
`PROPOSE_BILL` on a second discretionary bill is a no-op. The 4 example
bills (`bills.ts`): Hospital Plan, Education Investment, Business Tax Cut,
Energy Transition — each links to a real M3 promise id, so completing one
can move that promise toward `ON_TRACK`/`KEPT` in the existing
`PromiseTracker` (M3's evaluators already read `policyHistory`; adopting a
bill doesn't currently ALSO append a `policyHistory` entry the way Bercy/
energy/budget-category choices do — a natural follow-up for a future
milestone, noted below).

## Implementation delay — known simplification

`PoliticalBillDefinition.implementationDelay` is a real field (shown in the
UI as part of a bill's summary) but M4's Year 1 simulation, like M2/M3's
before it, still applies every ADOPTED bill's full-year effect from turn 1
via a single merged `EconomicPolicyInput` passed to `simulateYearOne` —
the same simplification Bercy/energy/budget already used pre-M4. True
per-turn delayed activation across a whole mandate is a natural extension
once Years 2-5 exist; scheduling it correctly inside a single Year 1 window
was judged not worth the added risk of reintroducing an M1.5-style
policy-accumulation bug for a multi-year payoff this milestone can't yet
observe.

## Known limitations

- Only Year 1 is playable — `governmentTension` and multi-year bloc-memory
  arcs are architecture for M5+.
- `implementationDelay` is displayed, not yet scheduled turn-by-turn (see
  above).
- Adopting a discretionary bill doesn't yet append its own `policyHistory`
  entry, so promise evaluators that key off `policyHistory` (rather than
  the real `EconomicState` movement the bill causes) won't see it directly
  this milestone.
- The support formula's coefficients (0.35, 0.15, 0.05, 0.2, 0.08...) are
  gameplay-calibration placeholders, tuned for a coherent, "80% legible"
  first pass — not validated against real political-science data, same
  caveat as `popularity.ts`/`scoring.ts` since M2.
- No government-collapse/confidence-vote mechanic exists yet — the
  exceptional procedure's cost is currently the only guardrail against
  spamming it.
