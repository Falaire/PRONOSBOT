# 6. Plan de monétisation détaillé (FCFA)

## 6.1 Grille tarifaire (déjà implémentée dans `plans` + `PLAN_PRICES_FCFA`)

| Plan | Prix FCFA | Durée | Prix / mois équivalent | Positionnement |
|---|---|---|---|---|
| **Free** | 0 | illimité | — | Acquisition : 3-5 matchs/jour, watermark, sans "value bet", sans historique |
| **Hebdo** | 1 000 FCFA | 7 jours | ~4 300 FCFA/mois | "Essai sérieux" pour un weekend de matchs (derby, CAN) |
| **Mensuel** | 3 000 FCFA | 30 jours | 3 000 FCFA/mois | **Plan phare**, mis en avant partout |
| **Trimestriel** | 7 500 FCFA | 90 jours | 2 500 FCFA/mois (-17%) | Fidélisation |
| **Annuel** | 25 000 FCFA | 365 jours | 2 083 FCFA/mois (-30%) | Power users / paris réguliers |

Repères locaux : 1 000 FCFA ≈ le prix d'une recharge crédit téléphonique courante ; 3 000 FCFA
reste sous le seuil psychologique d'un abonnement Canal+/Netflix local, cohérent avec le pouvoir
d'achat moyen togolais pour un produit de loisir/info à usage quotidien.

## 6.2 Free vs Premium — ce qui pousse à la conversion

| Fonctionnalité | Free | Premium |
|---|---|---|
| Matchs visibles/jour | 3-5 (ligues mélangées) | Illimité, toutes ligues suivies |
| Détail du pronostic | 1X2 seulement, floutage du reste | 1X2 + Over/Under + BTTS + score + explication complète |
| Mode Value Bet | ❌ | ✅ |
| Alertes Telegram | ❌ (ou 1/jour générique) | ✅ Telegram + WhatsApp personnalisées |
| Historique de précision | Vue globale seulement | Vue détaillée par ligue |
| Watermark sur les visuels partageables | Oui | Non |

## 6.3 Sources de revenus additionnelles (post-MVP)

1. **Parrainage** : code de parrainage -> 1 semaine offerte pour le parrain ET le filleul dès le
   premier abonnement payant du filleul (mécanique low-cost, très efficace au Togo via WhatsApp).
2. **Groupes VIP WhatsApp/Telegram payants** : palier "VIP" à 5 000 FCFA/mois avec accès à un
   groupe de discussion animé + pronostics combinés (« combo du jour »).
3. **Partenariats affiliés avec bookmakers agréés** (SI juridiquement encadré, voir section 9) :
   lien d'affiliation vers un opérateur de paris agréé au Togo, commission au dépôt — à traiter
   avec prudence pour ne pas brouiller le positionnement "service d'analyse, pas un bookmaker".
4. **Extension multi-sport** (basketball, etc.) vendue en add-on.
5. **B2B** : API de pronostics en marque blanche pour des médias sportifs locaux ou des radios
   togolaises (ex. un module "pronostic du jour" sponsorisé sur un site d'actu sportive local).

## 6.4 Projection simplifiée (illustrative, à ajuster avec de vraies données d'acquisition)

Hypothèses conservatrices pour un scénario "MVP + 3 mois de traction organique au Togo" :

| Métrique | Hypothèse |
|---|---|
| Visiteurs uniques/mois (WhatsApp, bouche-à-oreille, réseaux) | 5 000 |
| Taux d'inscription (essai gratuit) | 15% -> 750 inscrits |
| Taux de conversion essai -> payant | 12% -> 90 abonnés payants |
| Répartition plans | 50% Mensuel, 30% Hebdo, 15% Trimestriel, 5% Annuel |
| Revenu mensuel brut approximatif | 90 abonnés × panier moyen ~2 800 FCFA ≈ **252 000 FCFA/mois** |
| Coûts fixes mensuels (Vercel/Supabase gratuits au démarrage, API-Football gratuit/limité, frais CinetPay ~3,5%) | ≈ 10 000-20 000 FCFA (essentiellement frais de transaction + éventuel plan payant API-Football au-delà du quota gratuit) |

Ce n'est **pas** un plan d'affaires définitif — c'est un ordre de grandeur pour prioriser :
l'objectif MVP réaliste est d'atteindre ~50-100 abonnés payants avant d'investir dans des
fonctionnalités avancées (LLM, multi-sport, app native).

## 6.5 Indicateurs à suivre dès le lancement (dashboard interne simple)

- **Taux de conversion** essai gratuit -> premier paiement
- **Churn mensuel** (abonnés qui ne renouvellent pas)
- **Précision réelle de l'IA** (déjà affichée publiquement — sert aussi en interne d'alerte qualité)
- **Coût d'acquisition** par canal (WhatsApp organique vs éventuelle pub Facebook/TikTok locale)
- **ARPU** (revenu moyen par utilisateur payant) et **LTV** estimée sur 6 mois
