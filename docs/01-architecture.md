# 1. Architecture complète du projet

## 1.1 Vue d'ensemble

```
┌─────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│  Navigateur /    │      │   Next.js 14/15       │      │   Supabase          │
│  PWA mobile      │◄────►│   (App Router)        │◄────►│  PostgreSQL + Auth  │
│  (Lomé, 3G/4G)   │      │  Vercel (hosting)      │      │  + Row Level Sec.   │
└─────────────────┘      └──────────┬───────────┘      └────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     ┌────────────────┐   ┌──────────────────┐   ┌───────────────────────┐
     │  API-Football   │   │   CinetPay        │   │  Telegram / WhatsApp   │
     │  (données foot) │   │ T-Money / Flooz   │   │  (alertes pronostics)  │
     └────────────────┘   └──────────────────┘   └───────────────────────┘
              ▲
              │  Crons Vercel (06h00 / 06h30 / 08h00, Africa/Lomé = UTC)
              ▼
     ┌───────────────────────────────────────┐
     │ Moteur de prédiction Elo + Poisson      │
     │ (lib/prediction/engine.ts)              │
     │ -> pas d'appel LLM payant nécessaire     │
     │    pour le MVP, 100% déterministe        │
     └───────────────────────────────────────┘
```

**Choix clé pour le MVP** : le moteur de prédiction est un modèle statistique déterministe
(Elo + Poisson), pas un LLM. Cela évite un coût variable par requête OpenAI/Claude, donne des
résultats reproductibles et audités, et suffit largement pour 1X2 / Over-Under / BTTS / score
probable. Un LLM (prompt en section 5) peut être ajouté **en couche d'habillage** au-dessus des
résultats du moteur pour reformuler l'explication de façon plus naturelle, sans jamais lui
laisser inventer les probabilités.

## 1.2 Structure de dossiers (implémentée dans ce repo)

```
app/
  page.tsx                        Landing page (hero, features, pricing, WhatsApp CTA)
  layout.tsx, globals.css         Layout racine, thème sombre par défaut
  (auth)/
    auth-form.tsx                 Formulaire partagé téléphone + OTP SMS
    connexion/page.tsx            /connexion
    inscription/page.tsx          /inscription
  dashboard/
    page.tsx                      Matchs du jour (gating free/premium)
    match/[id]/page.tsx           Détail d'un pronostic
    abonnement/page.tsx           Plans + paiement Mobile Money
    abonnement/payment-panel.tsx  Formulaire client (numéro + plan -> CinetPay)
    historique/page.tsx           Précision de l'IA (transparence)
    compte/page.tsx               Statut de compte / abonnement
  admin/
    page.tsx, admin-actions.tsx   Déclenchement manuel du pipeline (admin only)
  api/
    health/route.ts
    payments/cinetpay/init/route.ts       Crée une transaction Mobile Money
    payments/cinetpay/webhook/route.ts    Confirme le paiement, active l'abonnement
    predictions/sync-fixtures/route.ts    Cron: récupère les matchs (API-Football)
    predictions/generate/route.ts         Cron: calcule les pronostics
    notify/telegram/route.ts              Cron: envoie les alertes Telegram
  legal/cgu/, legal/confidentialite/      Mentions légales

components/
  ui/ (button, card, badge, confidence-bar)
  MatchCard.tsx, PricingCard.tsx, Navbar.tsx, BottomNav.tsx

lib/
  prediction/{types.ts,engine.ts}         Moteur Elo + Poisson (100% testé unitairement)
  supabase/{client.ts,server.ts}          Clients Supabase (navigateur / serveur / admin)
  payments/cinetpay.ts                    Intégration CinetPay (init + vérification)
  notify/telegram.ts                      Envoi de messages Telegram
  subscription.ts                         Statut d'abonnement de l'utilisateur courant
  api-auth.ts                             Garde d'accès admin/cron pour les routes API
  demo-data.ts                            Données de démonstration (mode sans backend)
  utils.ts                                Helpers (FCFA, dates Lomé, cn())

supabase/migrations/0001_init.sql         Schéma complet (voir doc 2)
scripts/{seed.mjs,seed-data.mjs}          Import des ligues/équipes de départ
tests/engine.test.ts                      14 tests unitaires du moteur
middleware.ts                             Rafraîchissement de session Supabase (SSR)
vercel.json                               Déclaration des 3 crons
```

## 1.3 Pourquoi cette stack pour le Togo

| Choix | Raison |
|---|---|
| **Next.js App Router** | Un seul déploiement (front + API routes), SSR pour un chargement rapide sur réseau 3G, Vercel gratuit (Hobby) suffit pour le MVP. |
| **Supabase** (au lieu de NestJS + Postgres séparé) | Postgres managé gratuit, Auth par téléphone/OTP intégrée, Row Level Security pour ne jamais exposer les clés admin côté client, un seul service à opérer -> moins de DevOps pour une équipe réduite. |
| **CinetPay** | Agrégateur qui couvre nativement T-Money et Flooz au Togo (contrairement à Stripe/PayPal), API REST simple, webhook standard. |
| **Pas de microservices** | Un mono-repo Next.js suffit pour un MVP à 1-3 devs ; on découplera vers NestJS/queues seulement si le volume l'exige (voir section 7, post-MVP). |
| **Elo + Poisson avant tout LLM** | Coût marginal ≈ 0 par pronostic, latence quasi nulle, résultats explicables et vérifiables — indispensable pour la confiance des utilisateurs togolais qui paient de leur poche. |

## 1.4 Évolutions futures (post-MVP, hors scope immédiat)

- Découplage du pipeline de données dans un worker séparé (Railway/Render) avec file d'attente
  (BullMQ + Redis) si le volume de matchs/jour dépasse la capacité des Vercel Functions (10s max
  sur le plan Hobby, 60s sur Pro).
- Cache Redis pour les données live (cotes, xG) rafraîchies toutes les 30-60s pendant les matchs.
- App mobile légère (React Native / Expo) ou PWA installable pour réduire encore la consommation
  de données.
- Extension multi-sport (basketball AfroBasket, etc.) en réutilisant le même moteur probabiliste
  généralisé.
