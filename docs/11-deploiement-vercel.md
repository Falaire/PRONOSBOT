# 11. Déploiement Vercel

> Je n'ai pas d'accès réseau sortant vers vercel.com depuis cet environnement (sandbox restreint
> aux registres npm/GitHub), donc je ne peux pas cliquer à ta place. Voici la marche à suivre
> exacte, avec toutes tes vraies valeurs déjà prêtes à copier-coller — ça prend 5-10 minutes.

## 11.1 Pré-requis (déjà faits ✅)

- [x] Code poussé sur GitHub, branche `arena/01a0e32c-pronosbot` du repo `Falaire/PRONOSBOT`
- [x] `npm run build` passe sans erreur, `npm test` : 14/14 tests OK
- [x] `vercel.json` déclare les 3 tâches planifiées (compatibles plan Hobby gratuit, voir 11.5)
- [x] `package.json` précise `engines.node >= 18.18.0` (requis par Next.js 15)
- [x] Paiement en mode manuel configuré (numéro T-Money réel, Flooz en attente)

## 11.2 Étape par étape — premier déploiement

### Option A — Bouton "Deploy" (le plus rapide)

Clique le bouton en haut du [README](../README.md) : il importe directement la branche
`arena/01a0e32c-pronosbot` et te pré-remplit la liste des variables à saisir (les valeurs, elles,
sont à coller depuis le tableau ci-dessous — Vercel ne peut pas les connaître à l'avance).

### Option B — Import manuel

1. Va sur [vercel.com](https://vercel.com) et connecte-toi **avec ton compte GitHub** (celui
   utilisé pour `Falaire/PRONOSBOT`).
2. **Add New...** → **Project** → sélectionne **Falaire/PRONOSBOT**.
   - Si le repo n'apparaît pas : "Adjust GitHub App Permissions" → autorise l'accès à ce repo.
3. Dans l'écran de configuration, ouvre **Git** et choisis la branche **`arena/01a0e32c-pronosbot`**
   (par défaut Vercel propose `main` — change bien la branche importée ici).
4. **Framework Preset** : Next.js (détecté automatiquement, ne rien changer).

## 11.3 Variables d'environnement — prêtes à copier

Dans l'écran d'import (ou après coup dans **Project Settings → Environment Variables**), ajoute
exactement ces valeurs (celles que tu m'as données) :

```
NEXT_PUBLIC_SITE_URL=https://TON-PROJET.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://qzwyyxaatwamjwemcdhw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3l5eGFhdHdhbWp3ZW1jZGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzIyNTksImV4cCI6MjEwNTkwODI1OX0.bjacFwag4llUAaR8vjW3EK7K501xUYWh34wim2lXrEo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3l5eGFhdHdhbWp3ZW1jZGh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDMzMjI1OSwiZXhwIjoyMTA1OTA4MjU5fQ.m_xBtmIQXjjay4rQKGYRjTlJR2MTKccIOKGqGkTJWqY
API_FOOTBALL_KEY=23a02d93669240054361ac9a0f7ca98f
PAYMENTS_PROVIDER=manual
NEXT_PUBLIC_MANUAL_TMONEY_NUMBER=+228 70 65 87 96
NEXT_PUBLIC_MANUAL_FLOOZ_NUMBER=
NEXT_PUBLIC_MANUAL_PAYMENT_HOLDER=KickPredict Togo
NEXT_PUBLIC_MANUAL_WHATSAPP_NUMBER=+22870658796
NEXT_PUBLIC_OTP_CHANNEL=sms
CRON_SECRET=c5be5a2a0a975779ca5779ba1acd0bca112d46025afe35b4ef8c989cb2b0e909
```

⚠️ **`SUPABASE_SERVICE_ROLE_KEY`** : dans le formulaire Vercel, laisse la case **"Sensitive"**
cochée si elle est proposée (elle masque la valeur dans l'UI après sauvegarde) et ne la mets
**jamais** dans une variable préfixée `NEXT_PUBLIC_`.

Variables à ajouter **plus tard** (laisser vides pour l'instant, tout fonctionne sans elles en
mode manuel/démo) :

```
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
OPENAI_API_KEY=
```

## 11.4 Déployer, puis corriger l'URL

1. Clique **Deploy**. Premier build : ~1-2 minutes.
2. Vercel te donne une URL du type `https://kickpredict-togo-xxxx.vercel.app`.
3. Retourne dans **Project Settings → Environment Variables**, remplace la valeur de
   `NEXT_PUBLIC_SITE_URL` par cette URL réelle.
4. **Deployments** → menu "..." sur le dernier déploiement → **Redeploy** (nécessaire pour que la
   nouvelle valeur de `NEXT_PUBLIC_SITE_URL` soit prise en compte partout : lien WhatsApp, retour
   de paiement CinetPay futur, etc.).

## 11.5 Vérifications post-déploiement

Une fois déployé, teste dans l'ordre :

- [ ] `https://TON-URL.vercel.app/` → landing page s'affiche
- [ ] `https://TON-URL.vercel.app/api/health` → répond `{"status":"ok",...}`
- [ ] `https://TON-URL.vercel.app/dashboard/abonnement` → affiche le panneau de paiement manuel
      avec le numéro **+228 70 65 87 96** et Flooz grisé "(bientôt)"
- [ ] `https://TON-URL.vercel.app/admin` → redirige vers `/dashboard` (normal, pas encore admin)
- [ ] `https://TON-URL.vercel.app/inscription` → le formulaire OTP s'affiche (l'envoi réel du SMS
      ne fonctionnera qu'une fois Twilio configuré dans Supabase, voir doc 10)

## 11.6 Étapes suivantes une fois déployé

1. **Exécuter la migration Supabase** (`supabase/migrations/0001_init.sql` dans le SQL Editor) —
   sans ça, inscription/abonnement restent en mode démo (aucune donnée persistée).
2. **Configurer Twilio** (doc 10) pour que l'OTP par SMS/WhatsApp fonctionne réellement.
3. **T'inscrire une première fois** sur le site déployé, puis te passer admin en SQL :
   ```sql
   update profiles set role = 'admin' where id = 'TON_USER_ID';
   ```
   (Ton `TON_USER_ID` est visible dans Supabase → **Authentication** → **Users**.)
4. Aller sur `/admin` pour valider les futurs paiements manuels et déclencher le pipeline de
   données (sync matchs / génération pronostics) sans attendre le cron du lendemain matin.

## 11.7 Tâches planifiées (crons) sur le plan Hobby (gratuit)

Le plan **Hobby** autorise jusqu'à 100 crons par projet, mais **chacun doit s'exécuter au maximum
une fois par jour**. Nos 3 crons (`06h00`, `06h30`, `08h00`, chacun une fois/jour) respectent
cette limite sans upgrade payant. Deux nuances :

- **Fuseau horaire** : les crons Vercel tournent en UTC. Le Togo est en UTC+0 toute l'année (pas
  de changement d'heure) → `06h00 UTC` = `06h00` heure de Lomé, aucune conversion nécessaire.
- **Précision horaire** : sur Hobby, l'heure n'est garantie qu'à l'heure près (un cron à `06h00`
  peut réellement partir jusqu'à `06h59`) — sans impact pour des pronostics du matin.
- Besoin d'exécutions plus fréquentes plus tard (ex: cotes live toutes les 5 min pendant un
  match) → soit passer au plan **Pro** (crons 1×/minute), soit un cron externe
  (cron-job.org, GitHub Actions) qui appelle la route avec `Authorization: Bearer $CRON_SECRET`.

## 11.8 Nom de domaine personnalisé (optionnel)

**Project Settings → Domains** → ajoute ton domaine (ex: `kickpredict.tg` si disponible) → suis
les instructions DNS (enregistrement A ou CNAME chez ton registrar) → remets à jour
`NEXT_PUBLIC_SITE_URL` avec le nouveau domaine et redéploie.
