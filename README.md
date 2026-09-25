# PRONOSBOT — SaaS de pronostics sportifs IA pour le Togo

Pronostics football par modèle statistique (Elo + Poisson). Mobile-first, 100% français,
paiement T-Money / Flooz. 18+ — service d'analyse statistique, jouez responsable.

## Installation locale

1. `git clone` ce repo, puis `npm install`
2. Copie `.env.example` → `.env.local` et remplis les clés Supabase
3. Crée un projet sur supabase.com (gratuit) → SQL Editor → colle le contenu de
   `supabase/migrations/0001_init.sql`
4. `node scripts/seed.mjs` (importe les 32 équipes de départ)
5. `npm run dev` → http://localhost:3000
6. `npm test` → vérifie le moteur de prédiction (11 tests)

## Déploiement Vercel (gratuit)

1. Push ce repo sur GitHub
2. vercel.com → Import Project → ajoute les variables d'environnement depuis `.env.local`
3. Crons Vercel à ajouter ensuite (fuseau Africa/Lome) :
   - 06h00 — synchronisation API-Football
   - 06h30 — calcul des pronostics du jour
   - 08h00 — alertes Telegram aux abonnés Premium

## Devenir admin

Après inscription sur le site, dans Supabase → SQL Editor :

    UPDATE profiles SET role = 'admin' WHERE id = 'TON_USER_ID';

## Modèle de prédiction

Elo + Poisson — spécification complète et testée : `lib/prediction/engine.ts`

- λ domicile = buts_moyens_ligue × att_dom × def_ext × 1.25 × forme_dom
- λ extérieur = buts_moyens_ligue × att_ext × def_dom × forme_ext
- Probas 1X2 par matrice de Poisson (0-9 buts), score modal, +2,5 buts, BTTS
- Mise à jour Elo : Elo + K × (Résultat − Espérance), K = 20
- Forme : 1 + (points − 7.5)/30 sur les 5 derniers matchs, bornée [0.80, 1.20]

## Stack

Next.js 14 (App Router) · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS) ·
Vercel (hobby) · API-Football (plan gratuit) · Telegram Bot API

## Structure

    app/                pages Next.js (landing, à compléter)
    lib/prediction/     moteur Elo+Poisson + données de seed
    lib/supabase/       clients Supabase navigateur et serveur
    supabase/migrations schéma SQL complet (9 tables, RLS, trigger)
    scripts/seed.mjs    import des équipes
    tests/              11 tests unitaires du moteur
