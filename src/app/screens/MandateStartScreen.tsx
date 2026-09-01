import { getGovernmentProfile } from '../../game/country-run/government/governmentProfiles.ts'
import type { ParliamentComposition } from '../../game/country-run/prototype/parliamentComposition.ts'
import { getPromiseDefinition } from '../../game/country-run/promises/promiseCatalog.ts'

interface MandateStartScreenProps {
  selectedPromiseIds: readonly string[]
  governmentProfileId: string
  composition: ParliamentComposition
  politicalCapital: number
  onBegin: () => void
}

const MAJORITY_LABEL: Record<ParliamentComposition['majorityOutcome'], string> = {
  MAJORITÉ_ABSOLUE: 'MAJORITÉ ABSOLUE',
  MAJORITÉ_RELATIVE: 'MAJORITÉ RELATIVE',
  ASSEMBLÉE_FRAGMENTÉE: 'ASSEMBLÉE FRAGMENTÉE',
}

/** Last campaign screen before the existing M2 Year 1 flow (M3 §9) — a recap, so the transition never feels abrupt. */
export function MandateStartScreen({ selectedPromiseIds, governmentProfileId, composition, politicalCapital, onBegin }: MandateStartScreenProps) {
  const government = getGovernmentProfile(governmentProfileId)

  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">20 juin 2027</p>
          <h1 className="cr-title">LE MANDAT COMMENCE</h1>
        </div>

        <div className="cr-card">
          <p className="cr-body-text" style={{ marginBottom: '0.5rem' }}>Vos 5 engagements</p>
          <ul className="cr-recap-list">
            {selectedPromiseIds.map((id) => (
              <li key={id}>{getPromiseDefinition(id).title}</li>
            ))}
          </ul>
        </div>

        <div className="cr-report-grid">
          <div className="cr-report-row">
            <span className="cr-report-row__label">Gouvernement</span>
            <span className="cr-report-row__value">{government.name}</span>
          </div>
          <div className="cr-report-row">
            <span className="cr-report-row__label">Assemblée</span>
            <span className="cr-report-row__value">{MAJORITY_LABEL[composition.majorityOutcome]}</span>
          </div>
          <div className="cr-report-row">
            <span className="cr-report-row__label">Capital politique</span>
            <span className="cr-report-row__value">{politicalCapital} / 100</span>
          </div>
        </div>

        <div className="cr-button-row">
          <button type="button" className="cr-button cr-button--primary" onClick={onBegin}>
            GOUVERNER
          </button>
        </div>
      </div>
    </div>
  )
}
