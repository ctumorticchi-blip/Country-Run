/**
 * Data provenance tag (Product Bible §19, "Données et garde-fous"): every
 * figure shown to the player should eventually be traceable to whether it
 * was observed, forecast, a game-design estimate, or produced by the
 * simulation. M2 does not surface this everywhere in the UI, but the type
 * exists so data structures can carry it without a later rework.
 */
export type DataProvenance = 'OBSERVED' | 'FORECAST' | 'GAME_ESTIMATE' | 'SIMULATED'
