interface IndicatorProps {
  label: string
  value: string
  /** e.g. "5.0% → 5.4%" or "+2" — small trend label shown under the value. */
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
}

/** A single large stat tile — the base unit of the economic dashboard and the Year 1 report. */
export function Indicator({ label, value, trend, trendDirection = 'neutral' }: IndicatorProps) {
  return (
    <div className="cr-indicator">
      <span className="cr-indicator__label">{label}</span>
      <span className="cr-indicator__value">{value}</span>
      {trend ? <span className={`cr-indicator__trend cr-indicator__trend--${trendDirection}`}>{trend}</span> : null}
    </div>
  )
}
