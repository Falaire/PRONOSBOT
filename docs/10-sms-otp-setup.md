# 10. Configuration du fournisseur SMS pour l'OTP (Supabase + Twilio)

Supabase Auth ne délivre pas les SMS lui-même : il faut brancher un fournisseur externe. Les
providers supportés nativement sont **Twilio, Twilio Verify, MessageBird, Vonage**, et
**TextLocal** (communautaire). **Twilio** est retenu ici car c'est le mieux documenté, le plus
utilisé avec Supabase, et il couvre officiellement le Togo (+228).

## 10.1 Deux façons de faire, laquelle choisir ?

| Option | Fonctionnement | Avantages | Inconvénients |
|---|---|---|---|
| **A. Twilio Verify** (recommandé) | Twilio génère ET vérifie lui-même le code OTP ; Supabase lui délègue tout. | Plus fiable (Twilio gère les retries, le anti-fraude, l'expiration), configuration la plus simple côté Supabase. | Nécessite de créer un "Verify Service" dans la console Twilio (2 min). |
| **B. Twilio SMS classique** | Supabase génère le code lui-même et demande à Twilio d'envoyer juste le texte. | Contrôle total du message envoyé (`SMS_TEMPLATE`). | Nécessite un numéro Twilio (Messaging Service) capable d'envoyer vers le Togo. |

👉 **Recommandation : Twilio Verify.** C'est l'option la plus simple à opérer au quotidien pour
une petite équipe, et c'est celle utilisée dans la plupart des tutoriels Supabase + Next.js.

## 10.2 ⚠️ Point d'attention coût — important pour le modèle économique togolais

Le prix d'un SMS Twilio sortant vers le Togo (+228) est d'environ **0,49 $US** (~300 FCFA) par
message. Pour un abonnement Hebdo à 1000 FCFA, un utilisateur qui reçoit 2-3 SMS OTP avant
d'aboutir (erreur de saisie, nouvel appareil...) peut faire perdre presque toute la marge sur cet
abonnement.

**Bonne nouvelle : dans ce produit, l'OTP n'est demandé qu'à l'inscription (ou en cas de
changement d'appareil / déconnexion volontaire)**, pas à chaque visite — la session Supabase
reste active sur l'appareil (cookies rafraîchis automatiquement par `middleware.ts`). Le volume
réel de SMS reste donc proche du nombre de **nouvelles inscriptions**, pas du nombre de visites.

Deux leviers pour réduire encore la facture :

1. **Canal WhatsApp au lieu du SMS.** Supabase + Twilio supportent l'envoi de l'OTP par WhatsApp
   (`channel: "whatsapp"`, déjà implémenté dans `app/(auth)/auth-form.tsx`, activable via
   `NEXT_PUBLIC_OTP_CHANNEL=whatsapp`). Les messages WhatsApp Business sont généralement bien
   moins chers qu'un SMS international sortant, et WhatsApp est déjà l'canal principal utilisé au
   Togo — cohérent avec le reste du produit (alertes pronostics par WhatsApp).
   - Prérequis : dans la console Twilio, activer le "WhatsApp Sender" (sandbox pour les tests,
     puis un numéro WhatsApp Business vérifié pour la production).
2. **Limiter les tentatives** : Supabase limite déjà une demande d'OTP par numéro à 1 par 60
   secondes par défaut — suffisant pour éviter le spam accidentel.

## 10.3 Étape par étape — Twilio Verify + Supabase

### A. Créer le compte Twilio et le Verify Service

1. Va sur [twilio.com/try-twilio](https://www.twilio.com/try-twilio) et crée un compte (email +
   téléphone de vérification).
2. Dans la Console Twilio, va dans **Verify** → **Services** → **Create a new Service**.
   - Nom : `KickPredict Togo OTP`
   - Note le **Service SID** (commence par `VA...`).
3. Dans la Console Twilio, page d'accueil du compte : note ton **Account SID** (commence par
   `AC...`) et ton **Auth Token** (bouton "Show").
4. **Vérifie les permissions géographiques** : Console Twilio → **Messaging** → **Geo permissions**
   → active bien le Togo (+228) dans la liste des pays autorisés (désactivé par défaut sur les
   nouveaux comptes pour limiter la fraude).
5. (Compte d'essai gratuit uniquement) Twilio en mode "trial" n'envoie des SMS qu'aux numéros que
   tu as explicitement vérifiés dans la console. Pour toucher de vrais clients togolais, il faudra
   passer en compte payant (recharge quelques dollars suffit pour commencer les tests réels).

### B. Configurer Supabase

1. Dashboard Supabase → ton projet → **Authentication** → **Providers** → **Phone**.
2. Active **Enable phone provider**.
3. **SMS provider** : sélectionne **Twilio Verify**.
4. Renseigne :
   - `Twilio Account SID` = ton Account SID (`AC...`)
   - `Twilio Auth Token` = ton Auth Token
   - `Twilio Verify Service SID` = ton Service SID (`VA...`)
5. Sauvegarde.
6. (Optionnel) Dans **Authentication** → **Settings**, ajuste la durée d'expiration de l'OTP si
   besoin (par défaut souvent 60 secondes côté Supabase self-hosted, généralement plus long sur
   le cloud managé — vérifie la valeur affichée et ajuste si tes utilisateurs se plaignent d'un
   code expiré trop vite).

### C. Activer le canal WhatsApp (optionnel mais recommandé au Togo)

1. Console Twilio → **Messaging** → **Try it out** → **Send a WhatsApp message** (sandbox pour
   commencer) ou configure un numéro WhatsApp Business officiel pour la production.
2. Dans `.env.local` / variables Vercel : `NEXT_PUBLIC_OTP_CHANNEL=whatsapp`.
3. Redéploie — le formulaire d'inscription (`app/(auth)/auth-form.tsx`) enverra automatiquement
   l'OTP via WhatsApp au lieu du SMS.
4. Teste avec ton propre numéro avant d'ouvrir au public (les sandbox WhatsApp Twilio demandent
   parfois que le destinataire envoie d'abord un message-code au sandbox pour "opt-in" — à retirer
   une fois un numéro WhatsApp Business officiel configuré).

### D. Tester le flow complet

1. Va sur `/inscription` sur ton déploiement (ou en local avec `npm run dev`).
2. Saisis un numéro togolais réel (le tien pour commencer).
3. Vérifie la réception du code (SMS ou WhatsApp selon la config).
4. Saisis le code → tu dois être redirigé vers `/dashboard`.
5. En cas d'erreur, vérifie dans la Console Twilio → **Monitor** → **Logs** → **Errors** (les
   erreurs de géo-permission ou de format de numéro y apparaissent clairement).

## 10.4 Numéros de test Supabase (développement, sans consommer de vrais SMS)

Supabase permet de définir des "Test OTPs" pour des numéros de téléphone fixes : dans
**Authentication** → **Settings** → section **Test OTP**, tu peux mapper un numéro fictif (ex:
`+22800000000`) à un code fixe (ex: `123456`). Utile pour développer/tester l'interface sans
dépenser de crédit Twilio à chaque test.

## 10.5 Alternative si Twilio pose problème administrativement

Si l'ouverture d'un compte Twilio (carte bancaire internationale, vérification) est un blocage
au Togo, les alternatives supportées nativement par Supabase sont **Vonage** et **MessageBird** —
la configuration est similaire (Account/API key + Secret dans le même écran **Authentication** →
**Providers** → **Phone**). Vérifie leur couverture et leurs tarifs pour le Togo avant de choisir.
