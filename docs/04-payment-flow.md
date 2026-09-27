# 4. Flow d'abonnement + paiement Mobile Money

## 4.0 État actuel : mode MANUEL (transitoire)

Le compte marchand CinetPay n'étant pas encore activé, le produit démarre avec
`PAYMENTS_PROVIDER=manual` (voir `lib/payments/config.ts`). Flow réel utilisé aujourd'hui :

```
Client                         Front (/dashboard/abonnement)      Admin (/admin)
  │ 1. Choisit un plan                 │                               │
  │ 2. Envoie l'argent lui-même        │                               │
  │    (T-Money/Flooz) vers le          │                               │
  │    numéro marchand affiché          │                               │
  │ 3. Remplit le formulaire            │                               │
  │    "Déclarer mon paiement"          │                               │
  │────────────────────────────────────►│ POST /api/payments/manual/submit
  │                                     │  -> payments(status='pending', provider='manual')
  │ 4. (optionnel) envoie une capture   │                               │
  │    WhatsApp pour accélérer          │                               │
  │                                     │                               │ 5. Vérifie le SMS de
  │                                     │                               │    réception réelle sur
  │                                     │                               │    le numéro marchand
  │                                     │                               │ 6. Clique "Valider"
  │                                     │                               │────────────────────►
  │                                     │            POST /api/payments/manual/approve
  │                                     │            -> crée subscriptions(status='active')
  │                                     │            -> payments(status='success')
  │ 7. Abonnement actif                 │◄──────────────────────────────│
```

Avantages de démarrer ainsi : **zéro dépendance externe pour facturer un premier client dès
aujourd'hui** — seul un numéro Mobile Money marchand (compte T-Money/Flooz personnel ou
professionnel) est nécessaire. Limite assumée : validation non instantanée (délai humain, quelques
minutes à quelques heures), volume difficilement scalable au-delà de quelques dizaines de
paiements/jour sans automatisation — d'où le passage prévu à CinetPay dès que possible
(section 4.7).

Le code CinetPay ci-dessous reste entièrement implémenté et prêt : il suffit de positionner
`PAYMENTS_PROVIDER=cinetpay` + les clés d'API pour basculer, sans changement de code.

## 4.1 Vue d'ensemble du flow (mode CinetPay, cible)

```
Utilisateur                Front (Next.js)          API interne              CinetPay              Base de données
    │                            │                        │                      │                       │
    │ 1. Choisit un plan         │                        │                      │                       │
    │───────────────────────────►│                        │                      │                       │
    │ 2. Saisit son numéro       │                        │                      │                       │
    │    Mobile Money             │                        │                      │                       │
    │───────────────────────────►│ POST /api/payments/    │                      │                       │
    │                            │ cinetpay/init           │                      │                       │
    │                            │───────────────────────►│                      │                       │
    │                            │                        │ 3. Vérifie l'utilisateur connecté             │
    │                            │                        │ 4. Récupère le prix DEPUIS LE SERVEUR         │
    │                            │                        │    (PLAN_PRICES_FCFA, jamais depuis le client)│
    │                            │                        │ 5. INSERT payments(status=pending) ──────────►│
    │                            │                        │ 6. POST /v2/payment ────────────────►│        │
    │                            │                        │◄─────────────────────────────────────│        │
    │                            │◄───────────────────────│  payment_url                          │        │
    │ 7. Redirection vers        │                        │                      │                       │
    │    payment_url (CinetPay)  │                        │                      │                       │
    │────────────────────────────┼────────────────────────┼─────────────────────►│                       │
    │ 8. Choisit T-Money ou Flooz, confirme (code USSD /   │                      │                       │
    │    notification push opérateur) directement sur son  │                      │                       │
    │    téléphone                                          │                      │                       │
    │                            │                        │                      │                       │
    │                            │                        │  9. Webhook (server-to-server) ──────────────►│ POST /api/payments/
    │                            │                        │                      │                       │ cinetpay/webhook
    │                            │                        │                      │  10. Le webhook rappelle
    │                            │                        │                      │      /v2/payment/check
    │                            │                        │                      │◄──────────────────────│
    │                            │                        │                      │  statut réel confirmé │
    │                            │                        │                      │                       │
    │                            │                        │                      │ 11. INSERT subscription
    │                            │                        │                      │     (status=active)   │
    │                            │                        │                      │ 12. UPDATE payment
    │                            │                        │                      │     (status=success)  │
    │ 13. Retour sur /dashboard/abonnement?status=retour   │                      │                       │
    │◄───────────────────────────┼────────────────────────┼──────────────────────┼───────────────────────┘
    │ 14. Accède au contenu Premium (dashboard relit le statut d'abonnement à chaque requête)             │
```

## 4.2 Pourquoi ce design est sûr

1. **Le prix ne vient jamais du client.** `PLAN_PRICES_FCFA` (source de vérité) vit uniquement
   côté serveur (`lib/payments/cinetpay.ts`). Le front n'envoie que `planCode`, jamais un montant.
2. **Idempotence.** `payments.provider_transaction_id` est `unique` en base : un webhook rejoué
   deux fois par CinetPay (cas fréquent en cas de timeout réseau) ne crée pas deux abonnements.
3. **Zéro confiance dans le corps du webhook.** Le webhook ne lit que le `transaction_id`, puis
   rappelle systématiquement `POST /v2/payment/check` (API-to-API, authentifiée par clé secrète)
   pour connaître le statut réel. Un attaquant qui forgerait une requête POST vers notre webhook
   avec un faux "succès" ne peut pas activer un abonnement, car la vérification serveur-à-serveur
   ne le confirmera jamais.
4. **Traçabilité totale.** Chaque tentative (même échouée) est enregistrée dans `payments` avec
   la réponse brute de l'agrégateur (`raw_payload`) — indispensable pour le support client
   ("j'ai payé mais mon compte n'est pas activé").

## 4.3 Essai gratuit

- À l'inscription, on peut créer directement une ligne `subscriptions(status='trial', ends_at =
  now() + interval '3 days')` sans passer par CinetPay.
- Un job (ou simplement la vérification à la volée dans `getCurrentUserState()`) considère
  l'essai expiré dès que `ends_at < now()` — pas de tâche de fond obligatoire pour le MVP.
- Objectif recommandé : **3 jours** d'essai (assez court pour pousser à la conversion rapide,
  assez long pour voir plusieurs journées de matchs togolais/africains).

## 4.4 Renouvellement et relance

- v1 (MVP) : **pas de prélèvement automatique** (CinetPay ne supporte pas nativement les
  abonnements récurrents Mobile Money togolais sans démarche client répétée). À l'approche de
  `ends_at` (J-2, J-0), on envoie une alerte WhatsApp/Telegram avec un lien direct vers
  `/dashboard/abonnement?plan=mensuel` pré-rempli.
- v1.1 : proposer un lien de paiement récurrent CinetPay ("recurring payment") si disponible pour
  le Togo au moment de l'implémentation (à vérifier auprès du support CinetPay, la disponibilité
  Mobile Money récurrent varie par pays).

## 4.5 Agrégateurs alternatifs (fallback / comparatif)

| Agrégateur | T-Money | Flooz | Frais indicatifs* | Remarque |
|---|---|---|---|---|
| **CinetPay** | ✅ | ✅ | ~3,5% + activation gratuite | Retenu par défaut : couverture Togo confirmée, doc claire, sandbox disponible. |
| **PayDunya** | ✅ | ✅ | ~3,5-4% | Bonne alternative si CinetPay indisponible, fort ancrage Sénégal/Côte d'Ivoire. |
| **Hub2 / Semoa** | ✅ (agrège plusieurs opérateurs) | ✅ | Variable | Utile si on veut ajouter d'autres pays UEMOA rapidement via une seule intégration. |

\* Les frais réels doivent être confirmés directement avec chaque agrégateur au moment de la
signature du contrat marchand ; ils évoluent régulièrement.

## 4.6 Ce qu'il faut faire administrativement AVANT le lancement

1. Créer un compte marchand CinetPay (ou équivalent) avec les documents d'entreprise togolaise
   (ou statut d'auto-entrepreneur/entreprise individuelle selon la structure choisie).
2. Passer du mode **sandbox** (tests) au mode **production** une fois les webhooks validés
   bout-en-bout (voir section 9 sur le cadre juridique — déclarer l'activité comme "service
   d'information/analyse sportive par abonnement", pas comme "jeu d'argent").
3. Vérifier les plafonds Mobile Money par transaction chez Togocom (T-Money) et Moov Africa
   (Flooz) — certains comptes particuliers ont des limites journalières qui peuvent bloquer un
   abonnement annuel payé en une fois (25 000 FCFA reste généralement sous les plafonds standards).

## 4.7 Migration du mode manuel vers CinetPay

1. Créer et valider le compte marchand CinetPay (section 4.6).
2. Renseigner `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` dans les variables d'environnement
   (Vercel + `.env.local`).
3. Positionner `PAYMENTS_PROVIDER=cinetpay`.
4. Redéployer : `/dashboard/abonnement` bascule automatiquement sur `PaymentPanel`
   (paiement CinetPay) au lieu de `ManualPaymentPanel` — aucune autre modification de code requise.
5. Garder le mode manuel disponible en secours (on peut repasser `PAYMENTS_PROVIDER=manual` à tout
   moment, par exemple en cas d'incident CinetPay) : les deux flux écrivent dans la même table
   `payments`, avec `provider` = `'manual'` ou `'cinetpay'` pour les distinguer.
