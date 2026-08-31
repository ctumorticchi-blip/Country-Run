/**
 * A dot-separated path into a state tree, e.g. "economic.gdp" or "meta.turn".
 *
 * Not statically validated against a particular shape at M0 — conditions and
 * effects are data-driven (they can come from JSON content), so the path is
 * resolved at runtime. Keep this in mind when authoring content: a typo in a
 * path will silently resolve to `undefined` rather than fail to compile.
 */
export type StatePath = string
