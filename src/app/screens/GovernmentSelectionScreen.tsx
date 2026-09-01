import { GOVERNMENT_PROFILES } from '../../game/country-run/government/governmentProfiles.ts'

interface GovernmentSelectionScreenProps {
  onChoose: (profileId: string) => void
}

/** M3 §17: 4 fictional profiles, each a genuine trade-off — no profile is presented as the "correct" pick. */
export function GovernmentSelectionScreen({ onChoose }: GovernmentSelectionScreenProps) {
  return (
    <div className="cr-screen">
      <div className="cr-page">
        <div>
          <p className="cr-eyebrow">Formation du gouvernement</p>
          <h1 className="cr-title">CHOISISSEZ VOTRE GOUVERNEMENT</h1>
          <p className="cr-body-text">Chaque équipe a ses forces et ses faiblesses. Aucune n’est la solution parfaite.</p>
        </div>

        <div className="cr-choice-grid">
          {GOVERNMENT_PROFILES.map((profile) => (
            <button key={profile.id} type="button" className="cr-choice" onClick={() => { onChoose(profile.id) }}>
              <span className="cr-choice__title">{profile.name}</span>
              <span className="cr-choice__copy">{profile.tagline}</span>
              <span className="cr-choice__copy">{profile.description}</span>
              <div className="cr-government-traits">
                <div>
                  <span className="cr-government-traits__label cr-government-traits__label--strength">Points forts</span>
                  <span>{profile.strengths.join(', ')}</span>
                </div>
                <div>
                  <span className="cr-government-traits__label cr-government-traits__label--weakness">Points faibles</span>
                  <span>{profile.weaknesses.join(', ')}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
