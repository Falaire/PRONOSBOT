# 11. Déploiement Vercel

> Cette étape doit être faite depuis ton compte Vercel : je n'ai pas d'accès réseau sortant vers
> vercel.com depuis cet environnement (voir limitation expliquée dans la conversation), donc je ne
> peux pas cliquer à ta place. Voici la marche à suivre exacte, ça prend 5-10 minutes.

## 11.1 Pré-requis (déjà faits ✅)

- [x] Le code est poussé sur GitHub, branche `arena/01a0e32c-pronosbot` du repo `Falaire/PRONOSBOT`
- [x] `npm run build` passe sans erreur
- [x] `vercel.json` déclare les 3 tâches planifiées (compatibles avec le plan Hobby gratuit — voir
      section 11.5)
- [x] `.env.example` liste toutes les variables nécessaires

## 11.2 Étape par étape — premier déploiement

1. Va sur [vercel.com](https://vercel.com) et connecte-toi (ou crée un compte) **avec ton compte
   GitHub** (le même que celui utilisé pour `Falaire/PRONOSBOT`) — ça simplifie l'import.
2. Clique **Add New...** → **Project**.
3. Dans la liste des repos GitHub, sélectionne **Falaire/PRONOSBOT**.
   - Si le repo n'apparaît pas : clique "Adjust GitHub App Permissions" et autorise Vercel à
     accéder à ce repo.
4. **Configure Project** :
   - **Branch** : choisis `arena/01a0e32c-pronosbot` (Vercel déploie `main` par défaut ; change la
     "Production Branch" dans Project Settings → Git après le premier import si tu veux que cette
     branche soit celle qui se déploie en continu, ou fusionne d'abord vers `main` via la Pull
     Request déjà ouverte).
   - **Framework Preset** : Next.js (détecté automatiquement)
   - **Build Command** / **Output Directory** : laisser les valeurs par défaut Next.js
5. **Environment Variables** — ajoute toutes les variables de `.env.example` avec tes vraies
   valeurs (copie directement le contenu de ton `.env.local`) :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://TON-PROJET.vercel.app` (à corriger après le premier déploiement avec l'URL réelle, ou ton nom de domaine) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://qzwyyxaatwamjwemcdhw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ta clé anon |
   | `SUPABASE_SERVICE_ROLE_KEY` | ta clé service_role (⚠️ ne jamais cocher "expose to browser") |
   | `API_FOOTBALL_KEY` | ta clé API-Football |
   | `PAYMENTS_PROVIDER` | `manual` |
   | `NEXT_PUBLIC_MANUAL_TMONEY_NUMBER` | `+228 70 65 87 96` |
   | `NEXT_PUBLIC_MANUAL_FLOOZ_NUMBER` | (laisser vide pour l'instant) |
   | `NEXT_PUBLIC_MANUAL_PAYMENT_HOLDER` | `KickPredict Togo` |
   | `NEXT_PUBLIC_MANUAL_WHATSAPP_NUMBER` | `+22870658796` |
   | `NEXT_PUBLIC_OTP_CHANNEL` | `sms` (ou `whatsapp` une fois configuré, voir doc 10) |
   | `CRON_SECRET` | génère une valeur aléatoire longue (ex: `openssl rand -hex 32`) |
   | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | quand le bot Telegram sera créé |

   Laisse `CINETPAY_*` et `WHATSAPP_*` vides pour l'instant (mode manuel, voir doc 04).
6. Clique **Deploy**. Le premier build prend ~1-2 minutes.
7. Une fois déployé, Vercel te donne une URL du type `https://pronosbot-xxxx.vercel.app`.
   **Retourne dans Project Settings → Environment Variables**, mets à jour
   `NEXT_PUBLIC_SITE_URL` avec cette vraie URL, puis clique **Redeploy** (Deployments → menu "..."
   sur le dernier déploiement → Redeploy) pour que la variable soit prise en compte partout
   (liens WhatsApp, retour de paiement, etc.).

## 11.3 Vérifications post-déploiement

- [ ] La landing page (`/`) s'affiche correctement sur mobile
- [ ] `/inscription` déclenche bien l'envoi d'un OTP (une fois Twilio configuré, voir doc 10)
- [ ] `/dashboard/abonnement` affiche le panneau de paiement manuel avec le bon numéro T-Money
- [ ] `/admin` redirige vers `/dashboard` pour un compte non-admin (sécurité)
- [ ] `curl https://TON-DOMAINE/api/health` renvoie `{"status":"ok",...}`

## 11.4 Passer ton compte en administrateur

Une fois inscrit sur le site déployé (via `/inscription`), va dans **Supabase Dashboard** → ton
projet → **SQL Editor**, et exécute (remplace par ton vrai user id, visible dans
**Authentication** → **Users**) :

```sql
update profiles set role = 'admin' where id = 'TON_USER_ID';
```

Tu peux alors accéder à `/admin` pour valider les paiements manuels et déclencher le pipeline de
données.

## 11.5 Tâches planifiées (crons) sur le plan Hobby (gratuit)

Le plan **Hobby** de Vercel autorise jusqu'à 100 crons par projet, mais **chacun doit s'exécuter
au maximum une fois par jour** (une expression plus fréquente est rejetée au déploiement). Nos 3
crons (`06h00`, `06h30`, `08h00`, un par jour chacun) respectent cette limite. Deux nuances à
connaître :

- **Fuseau horaire** : les crons Vercel s'exécutent en UTC. Le Togo étant en UTC+0 toute l'année
  (pas de changement d'heure), `06h00 UTC` = `06h00` heure de Lomé — aucune conversion nécessaire.
- **Précision horaire** : sur Hobby, l'heure exacte d'exécution n'est garantie qu'à l'heure près
  (un cron à `06h00` peut réellement partir jusqu'à `06h59`). Sans impact réel pour des
  pronostics du matin, à garder en tête si tu ajoutes plus tard un cron sensible au timing (ex:
  alertes juste avant le coup d'envoi).
- Si un jour tu as besoin d'exécutions plus fréquentes (ex: rafraîchir les cotes live toutes les
  5 minutes pendant les matchs), il faudra soit passer au plan **Pro** (crons jusqu'à 1×/minute),
  soit utiliser un service de cron externe (cron-job.org, EasyCron, GitHub Actions scheduled
  workflow) qui appelle tes routes API avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## 11.6 Nom de domaine personnalisé (optionnel)

Dans **Project Settings** → **Domains**, ajoute ton propre domaine (ex: `kickpredict.tg` si
disponible, ou `.com`/`.africa`) et suis les instructions DNS de Vercel (enregistrement A ou
CNAME chez ton registrar). Pense à remettre à jour `NEXT_PUBLIC_SITE_URL` avec le nouveau domaine.

## 11.7 Ce qui ne fonctionnera pas tant que Supabase n'est pas migré (voir réponse précédente)

Tant que `supabase/migrations/0001_init.sql` n'a pas été exécuté dans le SQL Editor de ton projet
Supabase, les pages qui dépendent de la base de données réelle (dashboard avec vraies données,
inscription, abonnement) fonctionneront en **mode démo** (données fictives) sans erreur bloquante,
mais aucune vraie donnée ne sera persistée. Fais cette étape avant d'inviter de vrais utilisateurs.
