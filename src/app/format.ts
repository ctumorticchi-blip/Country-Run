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
