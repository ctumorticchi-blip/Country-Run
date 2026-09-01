interface CampaignIntroScreenProps {
  onBegin: () => void
}

export function CampaignIntroScreen({ onBegin }: CampaignIntroScreenProps) {
  return (
    <div className="cr-screen cr-center">
      <p className="cr-eyebrow">Campagne présidentielle 2027</p>
      <h1 className="cr-hook">Votre campagne commence.</h1>
      <p className="cr-supporting">
        Avant d’entrer à l’Élysée, vous devez choisir vos 5 engagements de campagne, votre gouvernement — et affronter les
        élections législatives qui suivront votre victoire.
        <br />
        Ces choix ne sont pas décoratifs : ils façonneront le reste de votre mandat.
      </p>
      <p className="cr-small-text">Aucune étiquette idéologique ne vous sera jamais demandée — vos choix parlent d’eux-mêmes.</p>
      <div className="cr-button-row" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="cr-button cr-button--primary" onClick={onBegin}>
          CHOISIR MES ENGAGEMENTS
        </button>
      </div>
    </div>
  )
}
