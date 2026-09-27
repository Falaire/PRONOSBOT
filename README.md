# KickPredict Togo 🇹🇬⚽

SaaS d'abonnement de pronostics football par IA statistique (Elo + Poisson), pensé pour le
Togo et l'UEMOA : mobile-first, 100 % en français, paiement **T-Money / Flooz** (Mobile Money),
sans carte bancaire.

> ⚠️ Service d'**analyse statistique et d'information sportive** (18+). Ce n'est pas un service
> de paris : aucune mise n'est prise, aucun gain n'est reversé. Voir [`/legal/cgu`](app/legal/cgu/page.tsx).

La documentation produit complète (architecture, schéma BDD, wireframes, flow de paiement,
prompt IA, monétisation, roadmap MVP, APIs externes, cadre juridique) est dans **[`docs/`](docs/)**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FFalaire%2FPRONOSBOT%2Ftree%2Farena%2F01a0e32c-pronosbot&project-name=kickpredict-togo&repository-name=kickpredict-togo&env=NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,API_FOOTBALL_KEY,PAYMENTS_PROVIDER,NEXT_PUBLIC_MANUAL_TMONEY_NUMBER,NEXT_PUBLIC_MANUAL_FLOOZ_NUMBER,NEXT_PUBLIC_MANUAL_PAYMENT_HOLDER,NEXT_PUBLIC_MANUAL_WHATSAPP_NUMBER,NEXT_PUBLIC_OTP_CHANNEL,CRON_SECRET&envDescription=Voir%20la%20liste%20complete%20et%20les%20valeurs%20dans%20docs%2F11-deploiement-vercel.md)

Guide détaillé pas à pas (avec toutes les valeurs prêtes à copier) : [docs/11-deploiement-vercel.md](docs/11-deploiement-vercel.md).

## Démarrage rapide

```bash
npm install
cp .env.example .env.local     # remplis au minimum Supabase pour sortir du mode démo
npm run dev                     # http://localhost:3000
npm test                        # tests du moteur de prédiction (Elo + Poisson)
```

Sans variables Supabase configurées, l'app démarre quand même en **mode démo** (données
fictives dans `lib/demo-data.ts`) pour visualiser tout le produit immédiatement.

## Mise en route complète (production)

1. Crée un projet gratuit sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, colle le contenu de `supabase/migrations/0001_init.sql`
   - ⚠️ Erreur `relation "profiles" already exists` ? Ton projet a probablement déjà une table
     `profiles` créée par le script de démarrage par défaut de Supabase. Exécute d'abord
     `supabase/migrations/0000_reset_before_install.sql` (sans danger sur un projet neuf), puis
     relance `0001_init.sql`.
3. Renseigne `.env.local` (Supabase, CinetPay, API-Football, Telegram — voir `.env.example`)
4. `node --env-file=.env.local scripts/seed.mjs` → importe les ligues + équipes de départ
5. Déploie sur [Vercel](https://vercel.com) (Hobby gratuit) — `vercel.json` configure déjà les
   3 tâches planifiées (crons, fuseau UTC = heure de Lomé) :
   - `06h00` — synchronisation des matchs du jour (API-Football)
   - `06h30` — génération des pronostics (moteur Elo + Poisson)
   - `08h00` — envoi des alertes Telegram
6. Passe ton compte en admin dans Supabase → SQL Editor :
   ```sql
   update profiles set role = 'admin' where id = 'TON_USER_ID';
   ```
7. `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` : crée un compte marchand sur
   [cinetpay.com](https://cinetpay.com) pour activer T-Money et Flooz au Togo.

## Paiement : mode manuel par défaut

Le temps d'activer un compte marchand CinetPay, `PAYMENTS_PROVIDER=manual` (valeur par défaut)
active un **flux de paiement manuel** :

1. Le client choisit un plan sur `/dashboard/abonnement` et envoie lui-même le montant via
   T-Money/Flooz vers le numéro marchand affiché (`NEXT_PUBLIC_MANUAL_TMONEY_NUMBER` /
   `NEXT_PUBLIC_MANUAL_FLOOZ_NUMBER`).
2. Il déclare son paiement dans le formulaire (numéro payeur, référence de transaction optionnelle).
3. L'admin vérifie la réception réelle (SMS reçu sur le numéro marchand) puis clique "Valider"
   dans `/admin` — l'abonnement s'active immédiatement (route `/api/payments/manual/approve`).

Pour repasser en paiement automatique dès que le compte CinetPay est prêt : mets
`PAYMENTS_PROVIDER=cinetpay` et renseigne `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` — le code
CinetPay (`lib/payments/cinetpay.ts`, webhook avec vérification serveur-à-serveur) est déjà en
place et ne nécessite aucun changement de code, juste la bascule de variable d'environnement.

## Modèle de prédiction (Elo + Poisson)

Spécification complète, testée unitairement : [`lib/prediction/engine.ts`](lib/prediction/engine.ts).

- `λ_domicile = buts_moyens_ligue × attaque_dom × défense_ext × 1.25 × forme_dom`
- `λ_extérieur = buts_moyens_ligue × attaque_ext × défense_dom × forme_ext`
- Probabilités 1X2 / Over-Under 2.5 / BTTS par matrice de Poisson bivariée (0 à 9 buts)
- Mise à jour Elo : `Elo + K × (Résultat − Espérance)`, `K = 20`
- Forme : `1 + (points_5_derniers_matchs − 7.5) / 30`, bornée `[0.80, 1.20]`
- Détection de "value bet" : `proba_IA − (1 / cote_décimale) ≥ 5 points`

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth OTP + RLS) ·
CinetPay (Mobile Money T-Money/Flooz) · API-Football · Telegram Bot API · Vercel (crons + hosting)

## Structure du projet

```
app/
  page.tsx                       landing page (hero, features, pricing, CTA WhatsApp)
  (auth)/connexion, inscription  authentification téléphone + OTP SMS
  dashboard/                     matchs du jour, détail match, abonnement, historique, compte
  admin/                         déclenchement manuel du pipeline (sync / génération / notif)
  api/
    payments/cinetpay/init       initialise une transaction Mobile Money
    payments/cinetpay/webhook    confirme le paiement -> active l'abonnement
    predictions/sync-fixtures    cron: récupère les matchs du jour (API-Football)
    predictions/generate         cron: calcule les pronostics (Elo + Poisson)
    notify/telegram              cron: envoie les pronostics du jour sur Telegram
  legal/cgu, confidentialite     mentions légales (jeu d'argent vs information)
components/                      UI (Button, Card, Badge, ConfidenceBar), MatchCard, PricingCard, Navbar
lib/
  prediction/                    moteur Elo + Poisson (types.ts, engine.ts)
  supabase/                      clients navigateur / serveur / admin
  payments/cinetpay.ts           intégration CinetPay (init + vérification de transaction)
  notify/telegram.ts             envoi de messages Telegram
  subscription.ts                statut d'abonnement de l'utilisateur courant
  demo-data.ts                   données de démonstration (mode sans backend)
supabase/migrations/0001_init.sql schéma complet (10 tables, enums, RLS, trigger, seed des plans)
scripts/seed.mjs, seed-data.mjs  import des ligues et équipes de départ
tests/engine.test.ts             tests unitaires du moteur de prédiction
docs/                            spec produit complète (voir ci-dessous)
```

## Documentation produit complète

| # | Document | Contenu |
|---|----------|---------|
| 1 | [docs/01-architecture.md](docs/01-architecture.md) | Architecture technique détaillée |
| 2 | [docs/02-database-schema.md](docs/02-database-schema.md) | Schéma de base de données |
| 3 | [docs/03-wireframes.md](docs/03-wireframes.md) | Wireframes des écrans principaux |
| 4 | [docs/04-payment-flow.md](docs/04-payment-flow.md) | Flow d'abonnement + paiement Mobile Money |
| 5 | [docs/05-ai-prompt.md](docs/05-ai-prompt.md) | Prompt système de l'agent IA de prédiction |
| 6 | [docs/06-monetization.md](docs/06-monetization.md) | Plan de monétisation en FCFA |
| 7 | [docs/07-roadmap-mvp.md](docs/07-roadmap-mvp.md) | Roadmap MVP en 4-6 semaines |
| 8 | [docs/08-external-apis.md](docs/08-external-apis.md) | APIs et services externes |
| 9 | [docs/09-legal.md](docs/09-legal.md) | Points d'attention juridiques |
| 10 | [docs/10-sms-otp-setup.md](docs/10-sms-otp-setup.md) | Configuration du fournisseur SMS/WhatsApp pour l'OTP (Twilio + Supabase) |
| 11 | [docs/11-deploiement-vercel.md](docs/11-deploiement-vercel.md) | Déploiement Vercel étape par étape |
