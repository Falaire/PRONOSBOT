# 10. Authentification par email + code OTP (Supabase)

L'inscription et la connexion se font par **email + code à 6 chiffres**, envoyé grâce au
service d'email intégré à Supabase Auth. **Aucun compte externe (Twilio ou autre) n'est
nécessaire pour démarrer** — ça fonctionne dès que le projet Supabase est créé.

> Historique : la première version du produit utilisait un OTP par SMS (Twilio), plus adapté
> à un marché mobile-first, mais nettement plus cher (~300 FCFA par SMS envoyé au Togo) et plus
> long à mettre en place (compte Twilio, vérification, geo-permissions...). Le passage à l'email
> permet de lancer le produit immédiatement, gratuitement, sans dépendance externe.

## 10.1 Ce qu'il y a à faire côté Supabase : rien de spécial

Le provider **Email** est activé par défaut sur tout nouveau projet Supabase
(**Authentication → Providers → Email**). Le flow OTP par email (`signInWithOtp` /
`verifyOtp` côté code, déjà implémenté dans `app/(auth)/auth-form.tsx`) fonctionne directement
avec l'envoi d'email intégré à Supabase — pas de clé API à configurer.

Un point à vérifier une seule fois :

1. Dashboard Supabase → ton projet → **Authentication** → **Providers** → **Email**
2. Vérifie que **"Enable Email provider"** est activé (c'est le cas par défaut)
3. Vérifie que **"Confirm email"** correspond à ce que tu veux :
   - Pour le flow OTP à 6 chiffres utilisé ici, aucune action supplémentaire n'est nécessaire —
     Supabase envoie automatiquement un email contenant un code lors de l'appel à
     `signInWithOtp({ email })`.

## 10.2 ⚠️ Limite de volume du service d'email gratuit intégré

Le service d'email **par défaut** de Supabase (partagé entre tous les projets gratuits) est
volontairement limité en débit — pensé pour le développement et les tout premiers lancements,
pas pour un volume important d'inscriptions quotidiennes. Concrètement :

- Les emails peuvent parfois arriver **avec quelques minutes de retard**, ou dans les **spams**.
- Il y a une limite de **quelques emails par heure** par projet.

**C'est largement suffisant pour lancer et tester le produit.** Si le volume d'inscriptions
augmente (plusieurs dizaines par jour), il suffit de brancher un vrai fournisseur SMTP — gratuit
jusqu'à un certain volume, et ça prend 5 minutes, sans toucher au code.

## 10.3 Passer à un fournisseur SMTP dédié (recommandé dès que le trafic grandit)

Options gratuites/pas chères qui fonctionnent bien avec le Togo :

| Fournisseur | Gratuit jusqu'à | Notes |
|---|---|---|
| **Resend** | 3 000 emails/mois, 100/jour | Le plus simple à connecter à Supabase, très bonne délivrabilité |
| **Brevo (ex-Sendinblue)** | 300 emails/jour | Interface en français, bon support |
| **SendGrid** | 100 emails/jour | Historique, un peu plus technique à configurer |

### Étapes (exemple avec Resend)

1. Crée un compte sur [resend.com](https://resend.com) (gratuit, pas de carte bancaire requise
   pour le tier gratuit)
2. Vérifie un domaine d'envoi (ou utilise leur domaine de test pour commencer)
3. Récupère ta clé API SMTP (**Resend → API Keys**)
4. Dashboard Supabase → **Project Settings** → **Authentication** → **SMTP Settings**
5. Active **"Enable Custom SMTP"** et renseigne :
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (TLS)
   - Username : `resend`
   - Password : ta clé API Resend
   - Sender email : une adresse sur ton domaine vérifié (ex: `noreply@kickpredict.tg`)
6. **Save** — tous les emails d'authentification (OTP, etc.) passeront désormais par Resend,
   sans limite de débit partagé et avec une bien meilleure délivrabilité.

## 10.4 Tester le flow complet

1. Va sur `/inscription` sur ton déploiement (ou en local avec `npm run dev`)
2. Saisis une adresse email réelle (la tienne pour commencer)
3. Vérifie ta boîte de réception (et le dossier spam) — le code arrive en général en quelques
   secondes avec le service par défaut
4. Saisis le code → tu dois être redirigé vers `/dashboard`

## 10.5 Tester sans recevoir de vrai email (numéro/email de test)

Supabase permet aussi de configurer des identifiants de test avec un code OTP fixe, utile en
développement. Pour l'email, le plus simple reste d'utiliser ta propre adresse (le volume est
trop faible pour poser problème en phase de test). Si besoin d'un flow 100% automatisé sans
boîte mail réelle (tests automatisés, CI), utilise l'API Admin de Supabase
(`supabase.auth.admin.generateLink`) pour récupérer le lien/code directement côté serveur.

## 10.6 Le numéro de téléphone reste utile — pas pour se connecter, mais pour limiter l'abus

Une adresse email seule est trop facile à multiplier à l'infini (services d'email jetable type
temp-mail) pour réclamer plusieurs fois l'essai gratuit de 3 jours. Pour limiter ça **sans
dépendre d'un envoi de SMS payant**, le produit demande le numéro de téléphone juste après la
vérification de l'email, avant d'activer l'essai gratuit :

- Le numéro est normalisé et contrôlé au format (8 chiffres togolais plausibles) —
  voir `lib/phone.ts`.
- Il doit être **unique** : impossible de l'associer à deux comptes différents
  (`profiles.phone`).
- Une table dédiée, `trial_phone_ledger` (migration `0003_phone_trial_gate.sql`), retient pour
  toujours qu'un numéro a déjà servi à un essai gratuit — même si le compte est supprimé
  ensuite. Un numéro déjà utilisé peut créer un compte et se connecter normalement, mais
  n'obtient pas de second essai gratuit (il doit passer directement à un abonnement payant).

⚠️ **Limite honnête** : comme le numéro n'est pas vérifié par SMS/appel, rien n'empêche
techniquement quelqu'un de saisir un faux numéro plausible pour chaque nouveau compte. Cette
mesure bloque l'abus « facile » (réutiliser son vrai numéro avec plusieurs emails jetables),
pas un attaquant déterminé et automatisé. Si l'abus persiste à grande échelle, les leviers
suivants (par ordre de coût croissant) :
1. Ajouter un CAPTCHA gratuit (ex: Cloudflare Turnstile) sur le formulaire d'inscription pour
   bloquer les scripts automatisés.
2. Limiter le nombre d'inscriptions par adresse IP/appareil.
3. Vérifier réellement le numéro par SMS/WhatsApp (Twilio Verify, voir sections précédentes de
   ce document) — le plus fiable, mais payant par tentative.
