import type { ParliamentComposition } from '../../game/country-run/prototype/parliamentComposition.ts'
import { ABSOLUTE_MAJORITY, TOTAL_SEATS } from '../../game/country-run/prototype/parliament.ts'

interface ParliamentCompositionScreenProps {
  composition: ParliamentComposition
  onProceed: () => void
}

const MAJORITY_LABEL: Record<ParliamentComposition['majorityOutcome'], string> = {
  MAJORITÉ_ABSOLUE: 'MAJORITÉ ABSOLUE',
  MAJORITÉ_RELATIVE: 'MAJORITÉ RELATIVE',
  ASSEMBLÉE_FRAGMENTÉE: 'ASSEMBLÉE FRAGMENTÉE',
}

const BLOC_COLORS = ['#4d7cff', '#e7a93c', '#3ec98b', '#e0455a', '#7aa0ff', '#cfd3dc']

export function ParliamentCompositionScreen({ composition, onProceed }: ParliamentCompositionScreenProps) {
  const majorityPct = (ABSOLUTE_MAJORITY / TOTAL_SEATS) * 100

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Assemblée nationale</p>
          <h1 className="cr-title">COMPOSITION DE L’ASSEMBLÉE</h1>
          <span className="cr-badge">{MAJORITY_LABEL[composition.majorityOutcome]}</span>
        </div>

        <div className="cr-card">
          <div className="cr-seats-bar cr-seats-bar--stacked">
            {composition.blocs.map((bloc, i) => (
              <div
                key={bloc.id}
                className="cr-seats-bar__segment"
                style={{ width: `${String((bloc.seats / TOTAL_SEATS) * 100)}%`, background: BLOC_COLORS[i % BLOC_COLORS.length] }}
                title={`${bloc.name} — ${String(bloc.seats)} sièges`}
              />
            ))}
            <div className="cr-seats-bar__majority-mark" style={{ left: `${String(majorityPct)}%` }} />
          </div>
          <p className="cr-body-text" style={{ marginTop: '0.6rem' }}>
            {ABSOLUTE_MAJORITY} sièges nécessaires pour la majorité absolue, sur {TOTAL_SEATS}.
          </p>
        </div>

        <ul className="cr-bloc-list">
          {composition.blocs.map((bloc, i) => (
            <li key={bloc.id} className="cr-report-row">
              <span className="cr-report-row__label">
                <span className="cr-bloc-list__dot" style={{ background: BLOC_COLORS[i % BLOC_COLORS.length] }} />
                {bloc.name}
                {bloc.isPlayerCoalition ? ' (vous)' : ''}
              </span>
              <span className="cr-report-row__value">{bloc.seats} sièges</span>
            </li>
          ))}
        </ul>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onProceed}>
            CONTINUER
          </button>
        </div>
      </div>
    </div>
  )
}
