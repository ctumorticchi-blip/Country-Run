/**
 * Single source of truth for the game's calendar convention (Product Bible
 * §2, "Temps moteur"): one turn = 2 in-fiction months, so 6 turns per year.
 *
 * Both the turn engine (calendar display) and the economic engine
 * (annualized-rate ↔ per-turn conversions) depend on this — it must not be
 * duplicated or hardcoded elsewhere.
 */
export const MONTHS_PER_TURN = 2
export const TURNS_PER_YEAR = 12 / MONTHS_PER_TURN
