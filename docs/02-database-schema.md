# 2. Schéma de base de données

Implémenté intégralement dans [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
(PostgreSQL via Supabase). Résumé des 10 tables :

## Vue d'ensemble (relations)

```
auth.users (Supabase Auth)
      │ 1:1 (trigger auto)
      ▼
  profiles ───────────────┐
      │ 1:N                │ 1:N
      ▼                    ▼
 subscriptions          payments
      │ N:1 (plan_code)     │
      ▼                     │
    plans                   │ (provider_transaction_id -> CinetPay)
                             │
  leagues ──1:N── teams ──┐  │
      │                    │ 2×(home/away)
      └──1:N── fixtures ◄──┘
                  │ 1:1 par model_version
                  ▼
             predictions ──1:N── prediction_results

  profiles ──1:N── notifications_log
```

## Détail des tables

### `profiles`
Étend `auth.users`. Créée automatiquement via un trigger (`handle_new_user`) à l'inscription.
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | text | identifiant principal (authentification par OTP email) |
| phone | text unique | optionnel, renseigné plus tard (alertes WhatsApp, paiement Mobile Money) |
| full_name | text | |
| role | enum `user` \| `admin` | |
| telegram_chat_id | text | pour les alertes |
| whatsapp_number | text | |
| language | text | `fr` par défaut, `en` prévu plus tard |

### `plans`
Catalogue d'abonnement, source de vérité des prix (jamais côté client).
| code | name | price_fcfa | duration_days |
|---|---|---|---|
| hebdo | Hebdo | 1000 | 7 |
| mensuel | Mensuel | 3000 | 30 |
| trimestriel | Trimestriel | 7500 | 90 |
| annuel | Annuel | 25000 | 365 |

### `subscriptions`
| Colonne | Type | Notes |
|---|---|---|
| user_id | uuid FK | |
| plan_code | text FK -> plans.code | |
| status | enum `trial`\|`active`\|`expired`\|`cancelled` | |
| started_at / ends_at | timestamptz | définit l'accès premium |
| amount_fcfa | int | montant réellement payé (traçabilité) |

### `payments`
Trace **toutes** les tentatives (succès, échec, en attente) — essentiel pour le support client.
| Colonne | Type | Notes |
|---|---|---|
| provider | text | `cinetpay` (extensible `paydunya`, `hub2`) |
| provider_transaction_id | text unique | idempotence du webhook |
| status | enum `pending`\|`success`\|`failed` | |
| payment_method | enum `tmoney`\|`flooz`\|`gozem`\|`card`\|`unknown` | déduit de la réponse CinetPay |
| raw_payload | jsonb | réponse brute de l'agrégateur (audit/debug) |

### `leagues`
| Colonne | Notes |
|---|---|
| priority_order | plus petit = affiché en premier (Ligue 1 Togo = 1, CAN = 3, Ligue des Champions UEFA = 10...) |
| avg_goals_per_match | paramètre du moteur Poisson, recalculable périodiquement |

### `teams`
| Colonne | Notes |
|---|---|
| elo | classement Elo, mis à jour après chaque match terminé |
| attack_rating / defense_rating | normalisés autour de 1.0 (calculés depuis les buts marqués/encaissés récents) |
| form_points_5 | points sur les 5 derniers matchs (0-15) |
| injuries_impact | 0 à 0.15, calculé depuis les absences de joueurs clés |

### `fixtures`
Un match. `live_stats` (jsonb) stocke possession/xG/tirs mis à jour en direct pendant le match.

### `predictions`
Une ligne par `(fixture_id, model_version)` — permet de comparer plusieurs versions du modèle
dans le temps sans perdre l'historique. Contient les probabilités, le score prédit, la
confiance (0-100) et l'explication texte générée par le moteur (section 5).

### `prediction_results`
Résultat réel vs pronostic, calculé automatiquement après chaque match terminé -> alimente la
page "Historique de précision" (transparence, argument de vente clé).

### `notifications_log`
Historique des alertes envoyées (Telegram/WhatsApp/push/SMS), pour debug et anti-spam.

## Sécurité (Row Level Security)

- **Lecture publique** : `leagues`, `teams`, `fixtures`, `predictions`, `plans` (les champs
  "premium" comme `explanation_text` détaillée sont filtrés **côté application**, pas en RLS —
  plus simple à maintenir qu'une RLS conditionnelle par colonne).
- **Lecture privée** (uniquement son propre enregistrement, ou admin) : `profiles`,
  `subscriptions`, `payments`, `notifications_log`.
- **Écriture** : jamais depuis le navigateur pour `subscriptions`/`payments`/`predictions` — ces
  tables ne sont modifiées que par les routes API serveur avec `SUPABASE_SERVICE_ROLE_KEY`, qui
  contourne RLS (webhooks de paiement, crons de génération de pronostics).
