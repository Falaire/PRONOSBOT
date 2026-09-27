import {
  ELO_K_FACTOR,
  HOME_ADVANTAGE,
  type MatchContext,
  type PredictionOutput,
  type TeamInput,
} from "./types";

/** Factorielle (mémoïsée pour n <= 20, largement suffisant pour du football) */
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Probabilité de Poisson P(X = k) pour un lambda donné */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Facteur de forme basé sur les points pris sur les 5 derniers matchs (max 15).
 * Formule : 1 + (points - 7.5) / 30, borné entre 0.80 et 1.20.
 * 7.5 = moyenne "neutre" (~2.5 matchs nuls et demi sur 5 -> ni forme ni contre-forme).
 */
export function formFactor(points5: number): number {
  const raw = 1 + (points5 - 7.5) / 30;
  return Math.min(1.2, Math.max(0.8, raw));
}

/**
 * Mise à jour du classement Elo après un match.
 * result : 1 = victoire home, 0.5 = nul, 0 = victoire away
 */
export function updateElo(
  eloHome: number,
  eloAway: number,
  result: 1 | 0.5 | 0,
  k: number = ELO_K_FACTOR
): { eloHome: number; eloAway: number } {
  const expectedHome = 1 / (1 + Math.pow(10, (eloAway - eloHome) / 400));
  const expectedAway = 1 - expectedHome;
  const newEloHome = eloHome + k * (result - expectedHome);
  const newEloAway = eloAway + k * (1 - result - expectedAway);
  return { eloHome: newEloHome, eloAway: newEloAway };
}

/**
 * Calcule lambda (buts attendus) pour chaque équipe.
 * lambda_dom = buts_moyens_ligue x attaque_dom x defense_ext x 1.25 x forme_dom
 * lambda_ext = buts_moyens_ligue x attaque_ext x defense_dom x forme_ext
 */
export function computeLambdas(
  home: TeamInput,
  away: TeamInput,
  ctx: MatchContext
) {
  const homeForm = formFactor(home.formPoints5);
  const awayForm = formFactor(away.formPoints5);
  const injuryHome = 1 - (home.injuriesImpact ?? 0);
  const injuryAway = 1 - (away.injuriesImpact ?? 0);
  const venueBoost = ctx.neutralVenue ? 1 : HOME_ADVANTAGE;

  let lambdaHome =
    ctx.leagueAvgGoals * home.attackRating * away.defenseRating * venueBoost * homeForm * injuryHome;
  let lambdaAway =
    ctx.leagueAvgGoals * away.attackRating * home.defenseRating * awayForm * injuryAway;

  // Ajustement léger via l'écart Elo (max +/-15%)
  const eloDiff = home.elo - away.elo;
  const eloAdj = Math.max(-0.15, Math.min(0.15, eloDiff / 4000));
  lambdaHome *= 1 + eloAdj;
  lambdaAway *= 1 - eloAdj;

  // Garde-fous : buts attendus réalistes (0.2 à 4.5)
  lambdaHome = Math.min(4.5, Math.max(0.2, lambdaHome));
  lambdaAway = Math.min(4.5, Math.max(0.2, lambdaAway));

  return { lambdaHome, lambdaAway };
}

const MAX_GOALS = 9; // matrice 0-9 buts comme spécifié dans le README

/** Construit la matrice de probabilités de score (Poisson bivarié indépendant) */
export function scoreMatrix(lambdaHome: number, lambdaAway: number): number[][] {
  const matrix: number[][] = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    const row: number[] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      row.push(poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a));
    }
    matrix.push(row);
  }
  return matrix;
}

function confidenceFromProbs(top: number, second: number, sampleQuality = 1): number {
  // Plus l'écart entre le résultat le + probable et le 2e est grand, plus la confiance est haute.
  const gap = top - second;
  const base = 50 + gap * 100; // gap max théorique ~1 -> jusqu'à 150 (borné après)
  return Math.round(Math.min(97, Math.max(35, base * sampleQuality)));
}

export function predictMatch(
  home: TeamInput,
  away: TeamInput,
  ctx: MatchContext
): PredictionOutput {
  const { lambdaHome, lambdaAway } = computeLambdas(home, away, ctx);
  const matrix = scoreMatrix(lambdaHome, lambdaAway);

  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let over25Prob = 0;
  let bttsYesProb = 0;
  let bestScore = { h: 0, a: 0, p: -1 };

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = matrix[h][a];
      if (h > a) homeWinProb += p;
      else if (h === a) drawProb += p;
      else awayWinProb += p;

      if (h + a > 2.5) over25Prob += p;
      if (h > 0 && a > 0) bttsYesProb += p;

      if (p > bestScore.p) bestScore = { h, a, p };
    }
  }

  // Normalisation (au cas où la troncature à 9 buts laisse un résidu)
  const total1x2 = homeWinProb + drawProb + awayWinProb;
  homeWinProb /= total1x2;
  drawProb /= total1x2;
  awayWinProb /= total1x2;

  const sorted = [homeWinProb, drawProb, awayWinProb].sort((a, b) => b - a);
  const confidence = confidenceFromProbs(sorted[0], sorted[1]);

  const explanation = buildExplanation({
    home,
    away,
    lambdaHome,
    lambdaAway,
    homeWinProb,
    drawProb,
    awayWinProb,
    over25Prob,
    bttsYesProb,
    bestScore,
  });

  return {
    homeWinProb: round2(homeWinProb),
    drawProb: round2(drawProb),
    awayWinProb: round2(awayWinProb),
    over25Prob: round2(over25Prob),
    under25Prob: round2(1 - over25Prob),
    bttsYesProb: round2(bttsYesProb),
    bttsNoProb: round2(1 - bttsYesProb),
    predictedScoreHome: bestScore.h,
    predictedScoreAway: bestScore.a,
    lambdaHome: round2(lambdaHome),
    lambdaAway: round2(lambdaAway),
    confidence,
    explanation,
  };
}

function round2(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function buildExplanation(args: {
  home: TeamInput;
  away: TeamInput;
  lambdaHome: number;
  lambdaAway: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  over25Prob: number;
  bttsYesProb: number;
  bestScore: { h: number; a: number; p: number };
}): string {
  const { home, away, lambdaHome, lambdaAway, homeWinProb, drawProb, awayWinProb, over25Prob, bttsYesProb, bestScore } = args;

  const favorite =
    homeWinProb > awayWinProb && homeWinProb > drawProb
      ? home.name
      : awayWinProb > homeWinProb && awayWinProb > drawProb
      ? away.name
      : null;

  const parts: string[] = [];

  if (favorite) {
    const favProb = favorite === home.name ? homeWinProb : awayWinProb;
    parts.push(`${favorite} est favori avec ${pct(favProb)} de chances de gagner.`);
  } else {
    parts.push(`Match équilibré : le nul est le résultat le plus probable (${pct(drawProb)}).`);
  }

  parts.push(
    `Forme récente : ${home.name} (${home.formPoints5}/15 pts) vs ${away.name} (${away.formPoints5}/15 pts).`
  );

  parts.push(
    `Buts attendus : ${lambdaHome.toFixed(2)} pour ${home.name} contre ${lambdaAway.toFixed(2)} pour ${away.name}, avantage du terrain inclus.`
  );

  if (home.injuriesImpact && home.injuriesImpact > 0.05) {
    parts.push(`Attention : ${home.name} joue avec des absences notables qui réduisent son potentiel offensif.`);
  }
  if (away.injuriesImpact && away.injuriesImpact > 0.05) {
    parts.push(`Attention : ${away.name} joue avec des absences notables qui réduisent son potentiel offensif.`);
  }

  parts.push(`Score le plus probable : ${bestScore.h}-${bestScore.a}.`);
  parts.push(
    `Plus de 2,5 buts : ${pct(over25Prob)}. Les deux équipes marquent : ${pct(bttsYesProb)}.`
  );

  return parts.join(" ");
}

/** Détermine si un pari a de la "valeur" : proba IA nettement supérieure à la proba implicite de la cote */
export function isValueBet(aiProb: number, decimalOdds: number, marginThreshold = 0.05): boolean {
  if (!decimalOdds || decimalOdds <= 1) return false;
  const impliedProb = 1 / decimalOdds;
  return aiProb - impliedProb >= marginThreshold;
}

export function impliedProbability(decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}
