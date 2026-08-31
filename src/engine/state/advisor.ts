/**
 * An advisor's forecast for a metric: a range and a confidence level, never
 * a single guaranteed number (Product Bible §7, "Multiplicateurs et
 * incertitude" — advisors give ranges and confidence, never perfect truth).
 */
export interface AdvisorForecast {
  advisorId: string
  /** Path or label of the forecasted metric, e.g. "economic.growth". */
  metric: string
  range: [low: number, high: number]
  confidence: 'low' | 'medium' | 'high'
  note?: string
}
