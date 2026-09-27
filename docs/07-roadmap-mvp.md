# 7. Roadmap MVP (4-6 semaines) — ce qui génère déjà des revenus au Togo

Principe directeur : **le MVP le plus simple qui peut facturer un vrai abonnement en FCFA dès la
semaine 4**, quitte à automatiser moins de choses au départ (ex: mise à jour manuelle des équipes
togolaises au début plutôt qu'un pipeline de données 100% automatique).

## Semaine 1 — Fondations + moteur de prédiction

- [x] Scaffold Next.js + Tailwind + Supabase (fait dans ce repo)
- [x] Schéma de base de données complet + RLS (`supabase/migrations/0001_init.sql`)
- [x] Moteur de prédiction Elo + Poisson + tests unitaires (`lib/prediction/engine.ts`)
- [x] Seed des équipes togolaises + top ligues africaines/européennes
- Livrable : le moteur produit des pronostics crédibles sur des données de départ (même saisies
  à la main au démarrage, avant intégration API-Football).

## Semaine 2 — Authentification + Dashboard + Landing

- [x] Auth téléphone + OTP (Supabase Auth)
- [x] Landing page + Dashboard "Matchs du jour" avec gating free/premium
- [x] Page détail d'un match (probabilités, explication, value bet)
- [x] Page "Historique de précision" (même avec peu de données au début — la transparence compte
      dès le premier jour)
- Livrable : un utilisateur peut s'inscrire, voir des pronostics gratuits, et comprendre la
  proposition de valeur en moins de 30 secondes sur mobile.

## Semaine 3 — Paiement Mobile Money (LE cœur du modèle économique)

- [x] Intégration CinetPay (init + webhook + vérification serveur-à-serveur)
- [x] Page abonnement avec les 4 plans FCFA
- [x] Activation automatique de l'abonnement après paiement confirmé
- [ ] **Tests réels en sandbox CinetPay puis en production avec de petits montants** (ex: un
      abonnement Hebdo à 1000 FCFA payé par l'équipe elle-même sur un vrai numéro T-Money/Flooz)
- Livrable : **le produit peut facturer un vrai client togolais dès cette semaine.** C'est le
  jalon le plus critique du MVP — tout le reste peut être imparfait, pas ça.

## Semaine 4 — Automatisation des données + alertes

- [x] Cron de synchronisation des matchs (API-Football)
- [x] Cron de génération des pronostics
- [x] Cron d'alertes Telegram
- [ ] Bot Telegram minimal (`/start` pour lier son `telegram_chat_id` à son compte) — à ajouter
      en une route API simple (`/api/telegram/webhook` recevant les commandes du bot)
- [ ] Intégration WhatsApp Business Cloud API pour les alertes premium (peut démarrer en mode
      "groupe WhatsApp communautaire" manuel le temps d'obtenir l'accès API Meta, souvent le
      goulot d'étranglement administratif du MVP)
- Livrable : le contenu se met à jour tout seul chaque matin, sans intervention manuelle.

## Semaine 5 — Qualité, mentions légales, polish mobile

- [ ] Pages CGU / Confidentialité finalisées avec un avocat local si budget le permet (au
      minimum, faire relire le texte actuel — voir section 9)
- [ ] Test réel sur téléphones d'entrée de gamme (Android Go, connexions 3G) — vérifier temps de
      chargement, poids des images, lisibilité
- [ ] Ajout d'un mode "watermark" visuel sur les captures partageables (free tier) pour
      encourager le partage organique tout en incitant à l'abonnement
- [ ] Mise en place d'un canal support simple (numéro WhatsApp Business dédié)
- Livrable : produit "présentable" à de vrais utilisateurs payants sans friction majeure.

## Semaine 6 — Lancement soft + premiers retours

- [ ] Lancement auprès d'un groupe restreint (amis, groupes WhatsApp de supporters togolais,
      pages Facebook de foot local) pour valider le taux de conversion réel avant tout budget pub
- [ ] Mise en place du tracking basique (conversions, churn — même un simple export Supabase
      suffit au début, pas besoin de Mixpanel/Amplitude payant tout de suite)
- [ ] Ajustement des prix/plans selon les premiers retours
- Livrable : premiers abonnés payants réels, premiers retours utilisateurs, décision go/no-go
      sur l'investissement des mois suivants (multi-sport, app native, LLM, pub payante).

## Ce qui est volontairement HORS scope du MVP (à ne pas faire avant la V2)

- Modèle LLM génératif pour les explications (le moteur Elo+Poisson suffit, voir section 5.4)
- Application mobile native (une PWA/site mobile-first suffit au démarrage)
- Paiement récurrent automatique (le renouvellement manuel via lien direct suffit au MVP)
- Multi-sport (basketball, etc.)
- Système de parrainage complet (peut rester une mécanique manuelle au début : code promo statique)
- Tableau de bord analytics sophistiqué (Supabase + quelques requêtes SQL suffisent)
