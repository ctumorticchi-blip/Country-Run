import { BERCY_WARNING_COPY } from '../../game/country-run/budget/budgetEffects.ts'
import type { BudgetImpactEstimate } from '../../game/country-run/budget/budgetTypes.ts'
import { formatMdEuros, formatSigned } from '../format.ts'

interface BudgetSummaryProps {
  estimate: BudgetImpactEstimate
  projectedRevenue: number
  projectedSpending: number
  projectedDeficitRatio: number
}

function rangeText(range: [number, number], decimals = 1, suffix = ''): string {
  return `${formatSigned(range[0], decimals, suffix)} à ${formatSigned(range[1], decimals, suffix)}`
}

/** The sticky live-updating summary panel — always visible while the player adjusts the budget (M2 §13, M5 §32). */
export function BudgetSummary({ estimate, projectedRevenue, projectedSpending, projectedDeficitRatio }: BudgetSummaryProps) {
  const warning = BERCY_WARNING_COPY[estimate.warningLevel]
  const nextDeficitRatio = projectedDeficitRatio + (estimate.deficitRatioDeltaRange[0] + estimate.deficitRatioDeltaRange[1]) / 2

  return (
    <div className="cr-summary">
      <strong>VOTRE BUDGET</strong>

      <div className={`cr-warning-banner${warning.severe ? ' cr-warning-banner--severe' : ''}`}>
        {warning.severe ? '⚠️ ' : ''}
        <strong>{warning.title}</strong>
        <div>{warning.body}</div>
      </div>

      <dl style={{ margin: 0 }}>
        <div className="cr-summary__row">
          <dt>Recettes projetées</dt>
          <dd>{formatMdEuros(projectedRevenue)}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Dépenses projetées</dt>
          <dd>{formatMdEuros(projectedSpending + estimate.totalAnnualLevel)}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Stance budgétaire totale</dt>
          <dd>{formatSigned(estimate.totalAnnualLevel, 0, ' Md€/an')}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Changement vs politique actuelle</dt>
          <dd>{formatSigned(estimate.netChangeFromCurrentPolicy, 0, ' Md€/an')}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Déficit projeté</dt>
          <dd>
            {projectedDeficitRatio.toFixed(1)}% → ~{nextDeficitRatio.toFixed(1)}%
          </dd>
        </div>
        <div className="cr-summary__row">
          <dt>Croissance à 12 mois</dt>
          <dd>{rangeText(estimate.growthDeltaRange, 1, ' pt')}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Popularité</dt>
          <dd>{rangeText(estimate.popularityDeltaRange, 1)}</dd>
        </div>
        <div className="cr-summary__row">
          <dt>Risque marché</dt>
          <dd>
            <span className={`cr-risk-pill cr-risk-pill--${estimate.marketRisk}`}>{estimate.marketRisk}</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
