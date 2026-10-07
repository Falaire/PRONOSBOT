import { RATING_DECAY_ALPHA } from "./types";
import { updateElo } from "./engine";

/**
 * Pipeline de mise à jour des ratings après un match terminé — c'est ce qui rend réelle la
 * consigne "pondère les matchs récents davantage que les anciens (décroissance temporelle)" :
 * sans ça, les ratings attaque/défense restaient figés pour toujours après leur valeur initiale
 * (ce qui était le cas avant cette évolution : updateElo() existait déjà mais n'était jamais
 * appelé en pratique).
 *
 * Plutôt qu'un ajustement par maximum de vraisemblance (MLE) sur plusieurs saisons d'historique
 * (ce qui demanderait de conserver un gros historique de résultats et un solveur dédié — pas en
 * place aujourd'hui), on utilise une moyenne mobile à décroissance exponentielle (EWMA) : chaque
 * nouveau résultat tire le rating vers "ce qui aurait parfaitement prédit ce match", avec un
 * poids RATING_DECAY_ALPHA. Les matchs anciens s'estompent donc progressivement, exactement
 * l'effet recherché, sans historique à conserver.
 */

export type RatingUpdateInput = {
  attack: number;
  defense: number;
  elo: number;
  formPoints5: number;
};

export type RatingUpdateContext = {
  leagueAvgGoals: number;
  homeAdvantage: number; // 1.25 habituellement, 1 si terrain neutre
};

/** Ratio observé/attendu borné pour éviter qu'un résultat extrême (8-0...) ne déstabilise le rating d'un coup. */
function clampRatio(observed: number, expected: number): number {
  const ratio = observed / Math.max(expected, 0.3);
  return Math.min(3, Math.max(0.3, ratio));
}

function ewma(old: number, ratio: number, alpha = RATING_DECAY_ALPHA): number {
  return old * (1 - alpha + alpha * ratio);
}

function clampRating(value: number): number {
  return Math.min(2.2, Math.max(0.4, value));
}

/** Points de résultat pour une équipe (3 victoire / 1 nul / 0 défaite). */
function resultPoints(goalsFor: number, goalsAgainst: number): 0 | 1 | 3 {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

/**
 * Indicateur de forme "points sur 5 matchs" maintenu par décroissance (asymptote correcte : une
 * série de victoires tend vers 15, de nuls vers 5, de défaites vers 0 — comme un vrai cumul sur
 * 5 matchs glissants, mais sans avoir à stocker l'historique match par match).
 */
export function updateFormPoints(oldForm: number, matchPoints: 0 | 1 | 3): number {
  const next = oldForm * 0.8 + matchPoints;
  return Math.min(15, Math.max(0, next));
}

/**
 * Calcule les nouveaux ratings (attaque/défense/elo/forme) des deux équipes après un match
 * terminé. Fonction pure, testable indépendamment de la base de données.
 */
export function applyMatchResult(
  home: RatingUpdateInput,
  away: RatingUpdateInput,
  homeGoals: number,
  awayGoals: number,
  ctx: RatingUpdateContext
) {
  const expectedHomeGoals = ctx.leagueAvgGoals * home.attack * away.defense * ctx.homeAdvantage;
  const expectedAwayGoals = ctx.leagueAvgGoals * away.attack * home.defense;

  const homeAttackRatio = clampRatio(homeGoals, expectedHomeGoals);
  const awayAttackRatio = clampRatio(awayGoals, expectedAwayGoals);
  // Le rating défensif suit la même échelle que les buts encaissés : encaisser plus que prévu
  // (ratio > 1) dégrade la défense (valeur plus haute = pire, convention du schéma existant).
  const homeDefenseRatio = clampRatio(awayGoals, expectedAwayGoals);
  const awayDefenseRatio = clampRatio(homeGoals, expectedHomeGoals);

  const newHomeAttack = clampRating(ewma(home.attack, homeAttackRatio));
  const newAwayAttack = clampRating(ewma(away.attack, awayAttackRatio));
  const newHomeDefense = clampRating(ewma(home.defense, homeDefenseRatio));
  const newAwayDefense = clampRating(ewma(away.defense, awayDefenseRatio));

  const eloResult: 1 | 0.5 | 0 = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const { eloHome, eloAway } = updateElo(home.elo, away.elo, eloResult);

  const homePoints = resultPoints(homeGoals, awayGoals);
  const awayPoints = resultPoints(awayGoals, homeGoals);

  return {
    home: {
      attack: newHomeAttack,
      defense: newHomeDefense,
      elo: eloHome,
      formPoints5: updateFormPoints(home.formPoints5, homePoints),
    },
    away: {
      attack: newAwayAttack,
      defense: newAwayDefense,
      elo: eloAway,
      formPoints5: updateFormPoints(away.formPoints5, awayPoints),
    },
  };
}
