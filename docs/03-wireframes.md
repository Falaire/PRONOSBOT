# 3. Wireframes / description des écrans principaux

Tous les écrans sont **mobile-first** (largeur de référence 360-390px), thème sombre par défaut
(meilleure lisibilité en extérieur + économie de batterie sur écrans OLED d'entrée de gamme).
Implémentation réelle : voir `app/*/page.tsx`.

## 3.1 Landing page (`/`)

```
┌───────────────────────────────┐
│  KickPredict TG   [Connexion] │  <- Navbar sticky
│                    [Essai gratuit]
├───────────────────────────────┤
│   🇹🇬 Fait pour le Togo         │
│   Les pronostics foot par IA,  │  <- Hero
│   payables en T-Money / Flooz  │
│   [Essai gratuit 3 jours]      │
│   [Voir les tarifs]            │
├───────────────────────────────┤
│  Pronostics du jour            │
│  [Carte match] [Carte match]   │  <- Aperçu (3 matchs, 1-2 verrouillés)
├───────────────────────────────┤
│  Pourquoi KickPredict ?        │
│  🧠 IA  🏆 Ligues Afrique       │  <- Grille de features (icône+titre+desc)
│  📈 Value Bet 💬 WhatsApp       │
├───────────────────────────────┤
│  Abonnement en FCFA            │
│  [Hebdo][Mensuel★][Trim][An]   │  <- 4 cartes tarifaires
├───────────────────────────────┤
│  CTA WhatsApp gratuit          │
├───────────────────────────────┤
│  Disclaimer légal 18+ + liens  │
└───────────────────────────────┘
```

## 3.2 Inscription / Connexion (`/inscription`, `/connexion`)

Formulaire à 2 étapes (implémenté dans `app/(auth)/auth-form.tsx`) :
1. **Étape email** : champ adresse email, bouton "Recevoir le code par email".
2. **Étape OTP** : champ code à 6 chiffres, bouton "Confirmer" -> redirection `/dashboard`.

Pas de mot de passe : l'email est l'identifiant de connexion (via le service d'email intégré à
Supabase, gratuit, sans fournisseur SMS externe). Le numéro de téléphone reste optionnel, pour
les alertes WhatsApp et le paiement Mobile Money.

## 3.3 Dashboard — Matchs du jour (`/dashboard`)

```
┌───────────────────────────────┐
│ Pronostics du jour             │
│ [Badge: Gratuit 5/jour]        │  <- ou "Premium actif"
├───────────────────────────────┤
│ ┌─────────────────────────┐   │
│ │ Ligue 1 Togo   Auj. 18h  │   │
│ │ ASKO Kara  vs  AC Semassi│   │
│ │ ▓▓▓▓▓▓▓▓░░ 78% confiance │   │  <- carte débloquée (free)
│ │ [Victoire ASKO][2-1][🔥Value]│
│ │ 1: 58%  X: 24%  2: 18%   │   │
│ │ "ASKO Kara est favori..."│   │
│ │ Voir l'analyse complète →│   │
│ └─────────────────────────┘   │
│ ┌─────────────────────────┐   │
│ │ [flouté] 🔒 Débloquer    │   │  <- carte verrouillée (premium)
│ │  avec Premium            │   │
│ └─────────────────────────┘   │
├───────────────────────────────┤
│ [🏠][📈][💳][👤]  <- bottom nav mobile
└───────────────────────────────┘
```

Filtres prévus (v1.1, non bloquants pour le MVP) : par ligue, confiance minimale, "value bets
uniquement" — via des chips au-dessus de la liste.

## 3.4 Détail d'un match (`/dashboard/match/[id]`)

- En-tête : ligue, équipes, date/heure (fuseau Lomé).
- Bloc "Indice de confiance IA" (barre de progression colorée).
- Si verrouillé (free + match premium) : encart flouté + CTA "Débloquer pour 1000 FCFA/semaine".
- Si débloqué : 3 colonnes 1/X/2, bloc "Autres marchés" (+2.5 buts, BTTS, score exact), encart
  "Value bet détecté" si pertinent, puis le paragraphe d'explication en français simple.

## 3.5 Abonnement & Paiement (`/dashboard/abonnement`)

- 4 cartes tarifaires (reprises de la landing), plan "Mensuel" mis en avant.
- **Panneau de paiement** (`payment-panel.tsx`, composant client) :
  1. Sélecteur de plan (pré-rempli si venu d'un lien `?plan=mensuel`)
  2. Champ numéro Mobile Money
  3. Bouton "Payer XXX FCFA" -> appelle `/api/payments/cinetpay/init` -> redirection vers la
     page de paiement CinetPay (choix T-Money / Flooz, confirmation sur le téléphone du client)
  4. Retour sur `/dashboard/abonnement?status=retour` avec message "vérification en cours"
     (l'activation réelle se fait par le webhook, en arrière-plan, en quelques secondes).

## 3.6 Historique de précision (`/dashboard/historique`)

3 compteurs clés (précision 1X2 sur 30 jours, nombre de pronostics analysés, nombre corrects) +
paragraphe de méthodologie. Objectif : **transparence radicale**, argument de confiance N°1 pour
convaincre un utilisateur togolais méfiant de payer un abonnement.

## 3.7 Mon compte (`/dashboard/compte`)

Statut d'abonnement (actif/gratuit), plan en cours, bouton "Passer Premium" si non abonné.
(v1.1 : historique des paiements, changement de numéro Telegram/WhatsApp, suppression de compte.)

## 3.8 Panneau admin (`/admin`, réservé au rôle `admin`)

3 boutons d'action manuelle (Synchroniser les matchs / Générer les pronostics / Envoyer les
alertes Telegram) + log console en direct — utile pour forcer le pipeline sans attendre le cron,
notamment en debug ou pour une journée à match exceptionnel (finale CAN, derby...).

## 3.9 Charte visuelle

- **Couleurs** : vert `#18B862` (drapeau togolais, confiance/validation), or `#F7B500` (accent,
  CTA secondaires, badges "value bet"/"populaire"), fond quasi-noir `#0B1220` (mode sombre natif).
- **Typo** : Inter (lisible, gratuite, bon rendu sur petits écrans).
- **Composants** : cartes à coins arrondis (`rounded-xl2`), badges pilule, barre de confiance en
  dégradé vert→or, icônes `lucide-react` (poids léger, cohérent avec un design mobile-first).
