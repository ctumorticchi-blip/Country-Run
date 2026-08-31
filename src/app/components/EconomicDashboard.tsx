import type { EconomicState, GameMeta, PoliticalState } from '../../engine/state/gameState.ts'
import { formatArrowTrend, formatPercent, formatPeriod, purchasingPowerIndex } from '../format.ts'
import { Indicator } from './Indicator.tsx'

interface EconomicDashboardProps {
  economic: EconomicState
  political: Pick<PoliticalState, 'popularity'>
  meta: Pick<GameMeta, 'year' | 'month'>
  /** When provided, indicators show a "before → after" trend instead of a bare value. */
  previous?: { economic: EconomicState; political: Pick<PoliticalState, 'popularity'> }
  periodLabel: string
}

/** The compact macro dashboard, reused across every gameplay screen (M2 §7). */
export function EconomicDashboard({ economic, political, meta, previous, periodLabel }: EconomicDashboardProps) {
  const purchasingPower = purchasingPowerIndex(economic.purchasingPower)

  return (
    <div className="cr-dashboard">
      <div className="cr-dashboard__period">
        {periodLabel} — {formatPeriod(meta.year, meta.month)}
      </div>
      <div className="cr-indicator-grid">
        <Indicator
          label="Croissance"
          value={formatPercent(economic.growth)}
          {...(previous ? trendProps(formatArrowTrend(previous.economic.growth, economic.growth)) : {})}
        />
        <Indicator
          label="Chômage"
          value={formatPercent(economic.unemployment)}
          {...(previous ? trendProps(formatArrowTrend(previous.economic.unemployment, economic.unemployment, 1, '%'), true) : {})}
        />
        <Indicator
          label="Inflation"
          value={formatPercent(economic.inflation)}
          {...(previous ? trendProps(formatArrowTrend(previous.economic.inflation, economic.inflation)) : {})}
        />
        <Indicator
          label="Déficit"
          value={`${formatPercent(economic.deficitRatio)} du PIB`}
          {...(previous ? trendProps(formatArrowTrend(previous.economic.deficitRatio, economic.deficitRatio, 1, '%'), true) : {})}
        />
        <Indicator
          label="Dette"
          value={`${formatPercent(economic.debtRatio, 0)} du PIB`}
          {...(previous ? trendProps(formatArrowTrend(previous.economic.debtRatio, economic.debtRatio, 0, '%'), true) : {})}
        />
        <Indicator
          label="Pouvoir d’achat"
          value={purchasingPower.toFixed(1)}
          {...(previous
            ? trendProps(formatArrowTrend(purchasingPowerIndex(previous.economic.purchasingPower), purchasingPower))
            : {})}
        />
        <Indicator
          label="Popularité"
          value={`${political.popularity.toFixed(0)}%`}
          {...(previous ? trendProps(formatArrowTrend(previous.political.popularity, political.popularity, 0, '%')) : {})}
        />
      </div>
    </div>
  )
}

function trendProps(trend: { text: string; direction: 'up' | 'down' | 'neutral' }, invert = false) {
  const direction = invert ? invertDirection(trend.direction) : trend.direction
  return { trend: trend.text, trendDirection: direction }
}

function invertDirection(direction: 'up' | 'down' | 'neutral'): 'up' | 'down' | 'neutral' {
  if (direction === 'up') return 'down'
  if (direction === 'down') return 'up'
  return 'neutral'
}
