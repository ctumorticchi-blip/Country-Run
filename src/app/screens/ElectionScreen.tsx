import type { ElectionResult } from '../../game/country-run/prototype/electionResult.ts'

interface ElectionScreenProps {
  electionResult: ElectionResult
  onEnter: () => void
}

const PROFILE_DESCRIPTION: Record<ElectionResult['profileLabel'], string> = {
  RÉFORMATEUR: 'Votre campagne a été perçue comme une promesse de changement rapide.',
  INVESTISSEUR: 'Votre campagne a mis l’avenir et l’investissement au cœur du débat.',
  PROTECTEUR: 'Votre campagne a promis de protéger ceux qui en ont le plus besoin.',
  GESTIONNAIRE: 'Votre campagne a mis en avant la rigueur et le sérieux budgétaire.',
  PRAGMATIQUE: 'Votre campagne a assemblé des priorités très diverses, sans ligne unique.',
}

export function ElectionScreen({ electionResult, onEnter }: ElectionScreenProps) {
  return (
    <div className="cr-screen cr-center">
      <p className="cr-eyebrow">9 mai 2027</p>
      <h1 className="cr-hook" style={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)' }}>
        VOUS ÊTES ÉLU PRÉSIDENT
      </h1>
      <p className="cr-score__value" style={{ fontSize: '2.2rem' }}>
        {electionResult.scorePct.toFixed(1)} %
      </p>
      <p className="cr-supporting">
        {PROFILE_DESCRIPTION[electionResult.profileLabel]}
        <br />
        La presse retient déjà une étiquette : « {electionResult.profileLabel} ».
      </p>
      <p className="cr-small-text">La campagne est terminée. Les promesses commencent maintenant.</p>
      <div className="cr-button-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cr-button cr-button--primary" onClick={onEnter}>
          DÉCOUVRIR L’ÉTAT DE LA FRANCE
        </button>
      </div>
    </div>
  )
}
