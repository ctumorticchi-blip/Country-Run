interface ElectionScreenProps {
  onEnter: () => void
}

export function ElectionScreen({ onEnter }: ElectionScreenProps) {
  return (
    <div className="cr-screen cr-center">
      <p className="cr-eyebrow">9 mai 2027</p>
      <h1 className="cr-hook" style={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)' }}>
        VOUS ÊTES ÉLU PRÉSIDENT
      </h1>
      <p className="cr-score__value" style={{ fontSize: '2.2rem' }}>
        51,8 %
      </p>
      <p className="cr-supporting">
        La campagne est terminée.
        <br />
        Les promesses commencent maintenant.
      </p>
      <p className="cr-small-text">Votre première réunion avec Bercy commence dans quelques heures.</p>
      <div className="cr-button-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cr-button cr-button--primary" onClick={onEnter}>
          ENTRER À L’ÉLYSÉE
        </button>
      </div>
    </div>
  )
}
