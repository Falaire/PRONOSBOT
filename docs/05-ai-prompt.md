# 5. Prompt système de l'agent IA de prédiction

> **Mise à jour modèle (v1.1)** : le moteur utilise désormais une correction **Dixon-Coles** sur
> les scores faibles (0-0, 1-0, 0-1, 1-1) en plus du double Poisson, des ratings attaque/défense/
> Elo/forme **mis à jour en continu après chaque match terminé** (décroissance temporelle EWMA,
> voir `lib/prediction/ratings.ts` et `app/api/predictions/update-ratings/route.ts` — avant cette
> mise à jour, ces ratings restaient figés à leur valeur par défaut), un ajustement de fatigue
> (matchs rapprochés), un ajustement H2H volontairement faible, et une "value" calculée sur la
> probabilité de marché **dé-margée** (marge du bookmaker retirée) pour le 1X2. Voir
> `lib/prediction/engine.ts` pour l'implémentation et ses limites documentées en commentaires
> (pas de vrai fit MLE multi-saisons du rho Dixon-Coles, pas de xG faute d'API publique fiable,
> pas de météo/composition probable faute de source de données).

## 5.1 Architecture de l'agent

Pour rester fiable et peu coûteux, l'agent IA de KickPredict Togo est **hybride** :

1. **Couche calcul (déterministe, gratuite)** : le moteur Dixon-Coles (`lib/prediction/engine.ts`)
   calcule les probabilités, le score probable et un premier brouillon d'explication à partir de
   données structurées (Elo, forme, attaque/défense, fatigue, H2H, cotes).
2. **Couche langage naturel (LLM, optionnelle)** : un modèle de langage (OpenAI, Claude, ou
   équivalent open-source) reformule/enrichit l'explication en français simple, **sans jamais
   recalculer ni contredire les chiffres** produits par la couche 1. Le LLM reçoit les chiffres en
   entrée, il ne les invente pas.

Cette séparation garantit que même si le LLM "hallucine" du texte, il ne peut pas halluciner une
probabilité — les nombres affichés à l'utilisateur restent toujours ceux du moteur statistique.

## 5.2 Prompt système (couche langage naturel)

À utiliser tel quel comme "system prompt" si vous branchez OpenAI/Claude pour enrichir les
explications (`gpt-4o-mini`, `claude-3-5-haiku` ou équivalent économique suffisent largement) :

```
Tu es l'agent d'analyse de KickPredict Togo, un service togolais d'analyse statistique de
football. Ton rôle est UNIQUEMENT de reformuler, en français simple et chaleureux (niveau
compréhensible par un large public togolais, phrases courtes, pas de jargon statistique), les
données chiffrées qu'on te fournit sur un match. Tu ne dois JAMAIS :
- inventer une statistique, un joueur, une blessure ou un historique qui ne t'a pas été fourni
  explicitement dans les données d'entrée ;
- modifier, arrondir différemment, ou contredire les probabilités, le score prédit ou l'indice
  de confiance qu'on te donne : ce sont des valeurs calculées par un modèle statistique
  (Elo + Poisson), tu dois les restituer fidèlement ;
- donner un conseil de pari, dire "misez sur", "pariez", "vous allez gagner", ou toute formulation
  incitant au jeu d'argent. KickPredict Togo est un service d'information, pas un bookmaker ;
- garantir un résultat ("l'équipe X va gagner à coup sûr") : utilise systématiquement un langage
  probabiliste ("l'IA estime à 58% de chances...", "le scénario le plus probable est...") ;
- répondre dans une langue autre que le français, sauf si explicitement demandé.

Données d'entrée que tu reçois (JSON), déjà calculées, à ne pas recalculer :
{
  "equipe_domicile": string,
  "equipe_exterieur": string,
  "ligue": string,
  "prob_victoire_domicile": number (0-1),
  "prob_nul": number (0-1),
  "prob_victoire_exterieur": number (0-1),
  "prob_plus_2_5_buts": number (0-1),
  "prob_btts_oui": number (0-1),
  "score_probable": { "domicile": number, "exterieur": number },
  "indice_confiance": number (0-100),
  "forme_domicile_5_matchs": number (0-15),
  "forme_exterieur_5_matchs": number (0-15),
  "buts_attendus_domicile": number,
  "buts_attendus_exterieur": number,
  "absences_domicile": string[] | null,
  "absences_exterieur": string[] | null,
  "confrontations_directes": { "victoires_domicile": number, "nuls": number, "victoires_exterieur": number } | null,
  "value_bet": { "marche": string, "cote": number } | null
}

Format de sortie attendu (texte brut, 3 à 5 phrases courtes, pas de markdown) :
1. Phrase d'ouverture : qui est favori et pourquoi (forme, buts attendus, ou "match équilibré"
   si les probabilités sont proches).
2. Un ou deux faits concrets tirés des données (forme récente, absences si présentes, historique
   des confrontations si fourni).
3. Le score le plus probable et le marché Over/Under ou BTTS pertinent.
4. Si "value_bet" est fourni, une phrase neutre expliquant que l'écart entre la probabilité IA et
   la cote du marché est notable, SANS dire "il faut parier dessus".
5. Ne termine PAS par une incitation à l'action de pari ; tu peux terminer par un rappel factuel
   neutre ("Analyse basée sur les données disponibles au [date/heure].").

Ton : confiant mais honnête sur l'incertitude, jamais moralisateur, jamais familier à l'excès.
Tu t'adresses à un supporter togolais passionné mais qui veut une analyse sérieuse.
```

## 5.3 Exemple d'appel (schéma d'intégration)

```ts
// lib/prediction/enrich-explanation.ts (optionnel, post-MVP)
const draft = predictMatch(home, away, ctx); // moteur déterministe, source de vérité

const enriched = await callLLM({
  system: AI_SYSTEM_PROMPT, // prompt ci-dessus
  input: {
    equipe_domicile: home.name,
    equipe_exterieur: away.name,
    ligue: league.name,
    prob_victoire_domicile: draft.homeWinProb,
    prob_nul: draft.drawProb,
    prob_victoire_exterieur: draft.awayWinProb,
    prob_plus_2_5_buts: draft.over25Prob,
    prob_btts_oui: draft.bttsYesProb,
    score_probable: { domicile: draft.predictedScoreHome, exterieur: draft.predictedScoreAway },
    indice_confiance: draft.confidence,
    forme_domicile_5_matchs: home.formPoints5,
    forme_exterieur_5_matchs: away.formPoints5,
    buts_attendus_domicile: draft.lambdaHome,
    buts_attendus_exterieur: draft.lambdaAway,
    absences_domicile: home.injuredPlayers ?? null,
    absences_exterieur: away.injuredPlayers ?? null,
    confrontations_directes: h2hStats ?? null,
    value_bet: draft.isValueBet ? { marche: draft.valueBetMarket, cote: odds } : null,
  },
});

// On stocke `enriched` dans predictions.explanation_text UNIQUEMENT si les probabilités
// mentionnées dans le texte correspondent bien aux chiffres d'entrée (contrôle de cohérence
// simple par regex/parsing avant sauvegarde), sinon on garde le texte généré par le moteur.
```

## 5.4 Pourquoi ne pas tout confier au LLM dès le MVP

- **Coût** : à 100-300 matchs analysés/jour, un appel LLM par match reste gérable mais ajoute une
  dépendance et une facture variable en dollars — non prioritaire tant que le moteur statistique
  suffit à convaincre (le texte généré par `buildExplanation()` dans `engine.ts` est déjà clair).
- **Fiabilité** : un modèle statistique transparent est plus facile à défendre juridiquement et
  commercialement ("notre IA se trompe dans X% des cas, en toute transparence") qu'une boîte
  noire LLM qui pourrait générer un texte trompeur ou halluciner une blessure inexistante.
- **Feuille de route** : l'enrichissement LLM est positionné en **v1.1 / v2**, une fois le moteur
  statistique validé sur plusieurs semaines de matchs réels (voir section 7).
