# 9. Points d'attention juridiques — jeu d'argent vs information pure

> ⚠️ Ce document est une **synthèse de bon sens produit/tech**, pas un avis juridique. Avant tout
> lancement commercial réel au Togo, faites valider ces points par un avocat local (droit des
> jeux d'argent togolais/UEMOA en évolution constante).

## 9.1 Le principe central à respecter absolument

**KickPredict Togo doit rester, à la fois dans les faits ET dans la communication, un service
d'analyse statistique et d'information sportive vendu par abonnement — jamais un service de
paris.** La frontière juridique entre "vendre de l'information sur le sport" (légal, assimilable
à un média/service d'analyse) et "organiser ou faciliter des paris d'argent" (activité réglementée,
nécessitant une licence spécifique, souvent réservée à des opérateurs agréés comme la loterie
nationale ou des bookmakers licenciés) est stricte dans la plupart des juridictions d'Afrique de
l'Ouest, y compris probablement au Togo.

### Ce que KickPredict Togo NE DOIT JAMAIS faire

- Collecter des mises d'argent auprès des utilisateurs pour les redistribuer selon un résultat
  sportif (= paris mutuels / bookmaking, nécessite une licence de jeu).
- Promettre ou garantir un gain financier lié à un résultat sportif.
- Utiliser un vocabulaire de pari ("misez", "gagnez de l'argent avec nos pronostics", "cote
  gagnante garantie") dans le marketing ou l'interface.
- Se présenter comme un bookmaker, un intermédiaire de paris, ou une loterie.

### Ce que KickPredict Togo FAIT (et doit continuer à documenter clairement)

- Vend un **abonnement à du contenu d'analyse statistique** (comme un abonnement à un magazine
  sportif spécialisé ou un service de stats premium), payé en FCFA.
- Les probabilités et scores prédits sont présentés comme des **estimations informatives**, avec
  un indice de confiance explicite et un historique de précision publié en toute transparence
  (ce qui *renforce* la crédibilité "service d'analyse" plutôt que "martingale magique").
- Toute mise éventuelle que l'utilisateur ferait ensuite se passe **en dehors** de KickPredict
  Togo, auprès d'opérateurs tiers de son choix, sous sa seule responsabilité.

## 9.2 Mentions obligatoires déjà intégrées dans le produit

- Disclaimer visible sur la landing page et dans le footer : *« KickPredict Togo est un service
  d'analyse statistique et d'information sportive (18+). Nous ne sommes ni un bookmaker ni un
  opérateur de jeux d'argent... »* (voir `app/page.tsx` et `app/legal/cgu/page.tsx`).
- Vérification d'âge déclarative (18+) — à renforcer en v1.1 par une case à cocher explicite lors
  de l'inscription ("Je certifie avoir 18 ans ou plus").
- CGU précisant explicitement l'absence de garantie de résultat et l'absence de gestion de mises.

## 9.3 Protection des données personnelles

- Le Togo dispose d'un cadre de protection des données (loi togolaise sur la protection des
  données à caractère personnel, sous supervision de l'Instance de Protection des Données à
  Caractère Personnel - IPDCP). À anticiper :
  - Déclaration/enregistrement de l'activité de traitement de données si le volume d'utilisateurs
    le requiert (à vérifier avec un juriste local selon le seuil applicable).
  - Politique de confidentialité claire (déjà ébauchée dans `app/legal/confidentialite/page.tsx`),
    précisant la finalité de la collecte du numéro de téléphone, la durée de conservation, et le
    droit à la suppression du compte.
  - Ne jamais stocker de code secret Mobile Money ou d'identifiants opérateur (déjà respecté :
    ces informations transitent uniquement via CinetPay/l'opérateur, jamais via nos serveurs).

## 9.4 Paiement et régulation financière

- CinetPay (et agrégateurs équivalents) opèrent déjà sous licence/autorisation dans les pays
  UEMOA pour agréger les flux Mobile Money — KickPredict Togo n'a pas besoin d'une licence
  d'établissement de paiement propre tant qu'il utilise un agrégateur agréé comme intermédiaire
  (à reconfirmer contractuellement avec CinetPay avant lancement en production).
- Conserver une facturation/traçabilité claire des abonnements vendus (table `payments`) pour
  toute obligation fiscale locale (TVA/impôt sur les sociétés selon le statut juridique choisi
  pour l'exploitant du service).

## 9.5 Publicité et partenariats avec des opérateurs de paris agréés

Si une future version envisage un partenariat d'affiliation avec un bookmaker **légalement
agréé** au Togo (source de revenu mentionnée en section 6.3) :

- Ce partenariat doit être clairement identifié comme un lien publicitaire externe ("Nos
  partenaires paris agréés"), physiquement et logiquement séparé du contenu d'analyse
  KickPredict, pour ne pas créer de confusion sur la nature du service.
- Vérifier que l'opérateur partenaire détient bien une licence de jeu d'argent valide dans la
  juridiction togolaise avant tout partenariat commercial.
- Ajouter un message de jeu responsable à proximité de tout lien d'affiliation.

## 9.6 Statut juridique de l'exploitant

Avant la commercialisation réelle (facturation en production), formaliser une structure
juridique togolaise adaptée (entreprise individuelle, SARL, etc.) permettant :
- de signer un contrat marchand avec CinetPay/l'agrégateur de paiement,
- de facturer légalement les abonnements et de déclarer les revenus,
- de disposer d'un interlocuteur juridique identifiable pour les utilisateurs (obligatoire dans
  la plupart des CGU de services payants).

## 9.7 Check-list "avant mise en production réelle"

- [ ] Relecture des CGU/Politique de confidentialité par un juriste togolais
- [ ] Case de confirmation d'âge (18+) explicite à l'inscription
- [ ] Structure juridique togolaise créée (pour la facturation et le contrat CinetPay)
- [ ] Contrat marchand CinetPay signé, mode production activé
- [ ] Vérification qu'aucun texte marketing n'emploie un vocabulaire de "pari"/"gain garanti"
- [ ] Politique de confidentialité conforme aux exigences togolaises de protection des données
- [ ] Canal de support clairement identifié (numéro/WhatsApp) pour les réclamations liées aux
      paiements ou à la suppression de compte
