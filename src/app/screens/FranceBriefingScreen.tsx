import { useState } from 'react'
import type { EconomicState } from '../../engine/state/gameState.ts'
import type { WorldState } from '../../engine/economy/types.ts'
import { FRANCE_BRIEFING_INDICATORS, PROVENANCE_LABEL } from '../../game/country-run/prototype/franceBriefingContent.ts'
import { formatPercent, purchasingPowerIndex } from '../format.ts'

interface FranceBriefingScreenProps {
  economic: EconomicState
  worldState: WorldState
  onProceed: () => void
}

function indicatorValue(id: string, economic: EconomicState, worldState: WorldState): string {
  switch (id) {
    case 'growth':
      return formatPercent(economic.growth)
    case 'unemployment':
      return formatPercent(economic.unemployment)
    case 'inflation':
      return formatPercent(economic.inflation)
    case 'deficit':
      return `${formatPercent(economic.deficitRatio)} du PIB`
    case 'debt':
      return `${formatPercent(economic.debtRatio, 0)} du PIB`
    case 'purchasingPower':
      return purchasingPowerIndex(economic.purchasingPower).toFixed(1)
    case 'oilPrice':
      return worldState.oilPriceIndex.toFixed(0)
    case 'marketConfidence':
      return `${economic.marketConfidence.toFixed(0)} / 100`
    default:
      return '—'
  }
}

/** M3 §5: every headline indicator carries a provenance badge and an expandable explanation — never presented as a bare, unexplained number. */
export function FranceBriefingScreen({ economic, worldState, onProceed }: FranceBriefingScreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">État des lieux</p>
          <h1 className="cr-title">LA FRANCE, AU 1ᵉʳ JOUR DE VOTRE MANDAT</h1>
          <p className="cr-body-text">
            Ces chiffres sont le point de départ de votre mandat dans ce prototype — pas une donnée officielle. Touchez un
            indicateur pour en savoir plus.
          </p>
        </div>

        <div className="cr-indicator-grid">
          {FRANCE_BRIEFING_INDICATORS.map((indicator) => {
            const expanded = expandedId === indicator.id
            return (
              <button
                key={indicator.id}
                type="button"
                className="cr-indicator cr-indicator--interactive"
                onClick={() => { setExpandedId(expanded ? null : indicator.id) }}
              >
                <span className="cr-indicator__label">{indicator.label}</span>
                <span className="cr-indicator__value">{indicatorValue(indicator.id, economic, worldState)}</span>
                <span className={`cr-provenance-pill cr-provenance-pill--${indicator.provenance}`}>{PROVENANCE_LABEL[indicator.provenance]}</span>
                {expanded ? <span className="cr-indicator__detail">{indicator.explanation}</span> : null}
              </button>
            )
          })}
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onProceed}>
            CHOISIR MON GOUVERNEMENT
          </button>
        </div>
      </div>
    </div>
  )
}
