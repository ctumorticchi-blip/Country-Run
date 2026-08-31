# economy/

Reserved for the Economic Engine (Product Bible §6): the relations that
compute GDP, revenue, deficit, debt, unemployment, inflation, purchasing
power, confidence indices, etc. turn over turn.

**Not implemented in M0.** `advanceTurn` (see `../state/turnEngine.ts`)
currently only advances the calendar and resolves due delayed effects — it
does not run any economic calculation. This folder exists to hold that
engine once M1 builds it, keeping it isolated from generic turn/state
mechanics and from Country Run content.
