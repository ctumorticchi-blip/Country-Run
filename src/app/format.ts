/** Formatting helpers shared by the game screens — never expose raw engine coefficients, only player-facing numbers. */

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatSigned(value: number, decimals = 1, suffix = ''): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}${suffix}`
}

export function formatMdEuros(value: number): string {
  return `${value.toFixed(0)} Md€`
}

/** Purchasing power is shown as an index starting at 100 (M2 §4), even though the engine stores it as a 0-based cumulative delta. */
export function purchasingPowerIndex(purchasingPowerDelta: number): number {
  return 100 + purchasingPowerDelta
}

export function formatArrowTrend(from: number, to: number, decimals = 1, suffix = ''): { text: string; direction: 'up' | 'down' | 'neutral' } {
  const direction = to > from + 0.005 ? 'up' : to < from - 0.005 ? 'down' : 'neutral'
  return { text: `${from.toFixed(decimals)}${suffix} → ${to.toFixed(decimals)}${suffix}`, direction }
}

export function formatPointDelta(delta: number, decimals = 1): { text: string; direction: 'up' | 'down' | 'neutral' } {
  const direction = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'neutral'
  return { text: formatSigned(delta, decimals, ' pt'), direction }
}

const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function formatPeriod(year: number, month: number): string {
  return `${MONTH_LABELS_FR[month - 1] ?? ''} ${String(year)}`
}

/**
 * M6 §60: proper French locale formatting (comma decimal, space thousands
 * separator — e.g. "1 590 Md€", "5,2 %") for the new finance UI. Kept
 * separate from the plain `.toFixed()`-based helpers above, which the
 * existing M0-M5 screens keep using unchanged (a documented scope decision
 * — see docs/ECONOMY_BUDGET_M6.md's "known limitations": unifying every
 * screen's number formatting was out of scope for this milestone).
 */
export function formatMdFr(value: number, decimals = 0): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} Md€`
}

export function formatSignedMdFr(value: number, decimals = 0): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatMdFr(value, decimals)}`
}

export function formatPercentFr(value: number, decimals = 1): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`
}

export function formatSignedPercentFr(value: number, decimals = 1): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatPercentFr(value, decimals)}`
}

/**
 * M6.2 §11: collapse a forecast range into a single value once its two
 * player-facing (already-rounded/formatted) endpoints read identically —
 * never show a fake "7,9–7,9 %" range. Pure presentation only; the
 * underlying low/high forecast numbers are never touched.
 */
export function formatRange(lowText: string, highText: string, dash = '–'): string {
  return lowText === highText ? lowText : `${lowText}${dash}${highText}`
}
