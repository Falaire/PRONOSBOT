# 8. Liste des APIs et services externes nécessaires

## 8.1 Données sportives

| Service | Usage | Plan de départ | Lien |
|---|---|---|---|
| **API-Football (API-SPORTS)** | Calendriers, résultats, statistiques équipes/joueurs, cotes | Plan gratuit (100 requêtes/jour) pour le MVP, puis plan payant selon volume | api-football.com |
| **Sportmonks** | Alternative/complément, meilleure couverture de certaines ligues africaines selon les périodes | Plan payant dès le départ, à évaluer si API-Football manque de couverture Ligue 1 Togo / CAF | sportmonks.com |
| Source manuelle (feuilles de match Ligue 1 Togo, sites fédération) | Fallback si les APIs ci-dessus ne couvrent pas bien le championnat togolais au lancement | Gratuit (saisie manuelle via `/admin` au démarrage) | — |

> ⚠️ Point d'attention réel : la couverture des championnats **togolais** et de certaines ligues
> ouest-africaines par les APIs internationales est souvent partielle ou en retard. Prévoir un
> mode de saisie manuelle (admin) des équipes/matchs togolais en secours pendant les premières
> semaines, le temps de valider quelle API couvre le mieux la Ligue 1 Togo.

## 8.2 Paiement

| Service | Usage | Lien |
|---|---|---|
| **CinetPay** | Agrégateur retenu par défaut — T-Money, Flooz, couverture Togo confirmée | cinetpay.com |
| PayDunya | Alternative crédible si CinetPay indisponible ou conditions moins favorables | paydunya.com |
| Hub2 | Alternative multi-pays UEMOA | hub2.io |

## 8.3 Authentification & Base de données

| Service | Usage | Lien |
|---|---|---|
| **Supabase** | PostgreSQL managé + Auth (OTP téléphone) + Row Level Security + Storage (logos d'équipes) | supabase.com |
| Twilio / Vonage (via Supabase Auth SMS provider) | Envoi effectif des SMS OTP — Supabase nécessite de configurer un fournisseur SMS tiers | supabase.com/docs/guides/auth/phone-login |

## 8.4 Notifications

| Service | Usage | Lien |
|---|---|---|
| **Telegram Bot API** | Alertes gratuites, illimitées, très utilisées en Afrique de l'Ouest | core.telegram.org/bots |
| **WhatsApp Business Cloud API (Meta)** | Alertes premium personnalisées — nécessite une validation de compte Meta Business (délai administratif à anticiper) | developers.facebook.com/docs/whatsapp |
| Web Push (optionnel, navigateur) | Notifications sans app native | web.dev/push-notifications |

## 8.5 Hébergement & Infrastructure

| Service | Usage | Lien |
|---|---|---|
| **Vercel** | Hébergement Next.js + crons planifiés (Hobby gratuit suffit pour le MVP) | vercel.com |
| Railway / Render | Si un worker séparé devient nécessaire (traitement lourd, files d'attente) — pas requis au MVP | railway.app / render.com |
| Upstash Redis (serverless) | Cache éventuel des données live (cotes, xG) — à ajouter si besoin de rafraîchissement très fréquent | upstash.com |

## 8.6 IA générative (optionnelle, v1.1+)

| Service | Usage | Lien |
|---|---|---|
| OpenAI (`gpt-4o-mini`) | Enrichissement des explications en langage naturel (voir section 5) | platform.openai.com |
| Anthropic Claude (`claude-3-5-haiku`) | Alternative | console.anthropic.com |

## 8.7 Observabilité (recommandé dès que possible, pas bloquant pour le MVP)

| Service | Usage | Lien |
|---|---|---|
| Sentry (plan gratuit) | Suivi des erreurs front/back | sentry.io |
| Vercel Analytics | Suivi de trafic basique inclus | vercel.com/analytics |

## 8.8 Récapitulatif des variables d'environnement (voir `.env.example`)

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
CINETPAY_API_KEY / CINETPAY_SITE_ID
API_FOOTBALL_KEY
TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN
CRON_SECRET
OPENAI_API_KEY (optionnel)
```
