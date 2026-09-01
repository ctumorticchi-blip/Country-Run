import type { ParliamentComposition } from '../../game/country-run/prototype/parliamentComposition.ts'
import { TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'

interface LegislativeElectionScreenProps {
  composition: ParliamentComposition
  onProceed: () => void
}

const MAJORITY_LABEL: Record<ParliamentComposition['majorityOutcome'], string> = {
  MAJORITÉ_ABSOLUE: 'MAJORITÉ ABSOLUE',
  MAJORITÉ_RELATIVE: 'MAJORITÉ RELATIVE',
  ASSEMBLÉE_FRAGMENTÉE: 'ASSEMBLÉE FRAGMENTÉE',
}

export function LegislativeElectionScreen({ composition, onProceed }: LegislativeElectionScreenProps) {
  return (
    <div className="cr-screen cr-center">
      <p className="cr-eyebrow">Juin 2027</p>
      <h1 className="cr-hook" style={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)' }}>
        LES LÉGISLATIVES SONT TERMINÉES
      </h1>
      <p className="cr-score__value" style={{ fontSize: '2.2rem' }}>
        {composition.playerSeats} / {TOTAL_SEATS}
      </p>
      <p className="cr-supporting">sièges pour votre majorité présidentielle</p>
      <span className="cr-badge">{MAJORITY_LABEL[composition.majorityOutcome]}</span>
      <div className="cr-button-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cr-button cr-button--primary" onClick={onProceed}>
          VOIR L’ASSEMBLÉE
        </button>
      </div>
    </div>
  )
}
