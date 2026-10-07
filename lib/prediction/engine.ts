import {
  ELO_K_FACTOR,
  HOME_ADVANTAGE,
  DIXON_COLES_RHO,
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
 * Fonction de correction tau du modèle Dixon-Coles : corrige la sous/sur-estimation du Poisson
 * bivarié indépendant sur les scores faibles et corrélés (0-0, 1-0, 0-1, 1-1), qui sont
 * statistiquement un peu plus/moins fréquents en football réel qu'un double Poisson indépendant
 * ne le prédit. rho < 0 (cas général en football) réduit légèrement la probabilité des nuls 0-0
 * et 1-1 par rapport à un double Poisson naïf, et ajuste 1-0/0-1 en conséquence.
 */
export function dixonColesTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/**
 * Facteur de forme basé sur un indicateur "points sur les 5 derniers matchs" (max 15), lui-même
 * maintenu par décroissance temporelle (voir lib/prediction/ratings.ts) plutôt qu'une vraie
 * fenêtre stricte des 5 derniers matchs.
 * Formule : 1 + (points - 7.5) / 30, borné entre 0.80 et 1.20.
 * 7.5 = moyenne "neutre" (~2.5 matchs nuls et demi sur 5 -> ni forme ni contre-forme).
 */
export function formFactor(points5: number): number {
  const raw = 1 + (points5 - 7.5) / 30;
  return Math.min(1.2, Math.max(0.8, raw));
}

/**
 * Facteur de fatigue basé sur le nombre de matchs joués dans les 10 derniers jours
 * (enchaînement championnat + coupes + sélection nationale...). 2 matchs ou moins : neutre.
 * Chaque match supplémentaire au-delà de 2 réduit légèrement le rendement offensif attendu
 * (joueurs plus fatigués, rotations), plafonné à -15%. On ne modélise pas l'effet inverse
 * ("regain" après repos) faute de données fiables là-dessus.
 */
export function fatigueFactor(matchesLast10Days?: number): number {
  if (!matchesLast10Days || matchesLast10Days <= 2) return 1;
  const extra = matchesLast10Days - 2;
  return Math.max(0.85, 1 - extra * 0.04);
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
 * Calcule lambda (buts attendus) pour chaque équipe à partir des forces attaque/défense
 * (mises à jour en continu, voir ratings.ts), de la forme récente, de la fatigue, des blessures
 * connues, d'un léger ajustement Elo, et — très faiblement — de l'historique des confrontations
 * directes (H2H) quand un échantillon suffisant existe.
 */
export function computeLambdas(home: TeamInput, away: TeamInput, ctx: MatchContext) {
  const homeForm = formFactor(home.formPoints5);
  const awayForm = formFactor(away.formPoints5);
  const injuryHome = 1 - (home.injuriesImpact ?? 0);
  const injuryAway = 1 - (away.injuriesImpact ?? 0);
  const fatigueHome = fatigueFactor(home.matchesLast10Days);
  const fatigueAway = fatigueFactor(away.matchesLast10Days);
  const venueBoost = ctx.neutralVenue ? 1 : HOME_ADVANTAGE;

  let lambdaHome =
    ctx.leagueAvgGoals * home.attackRating * away.defenseRating * venueBoost * homeForm * injuryHome * fatigueHome;
  let lambdaAway =
    ctx.leagueAvgGoals * away.attackRating * home.defenseRating * awayForm * injuryAway * fatigueAway;

  // Ajustement léger via l'écart Elo (max +/-15%)
  const eloDiff = home.elo - away.elo;
  const eloAdj = Math.max(-0.15, Math.min(0.15, eloDiff / 4000));
  lambdaHome *= 1 + eloAdj;
  lambdaAway *= 1 - eloAdj;

  // H2H : pondération volontairement faible (+/-4% max), et seulement si échantillon >= 3
  // confrontations — sinon on ignore plutôt que d'extrapoler sur 1-2 matchs non représentatifs.
  if (ctx.h2hHomeWinRate !== undefined && (ctx.h2hSampleSize ?? 0) >= 3) {
    const h2hAdj = Math.max(-0.04, Math.min(0.04, (ctx.h2hHomeWinRate - 0.45) * 0.1));
    lambdaHome *= 1 + h2hAdj;
    lambdaAway *= 1 - h2hAdj;
  }

  // Garde-fous : buts attendus réalistes (0.2 à 4.5)
  lambdaHome = Math.min(4.5, Math.max(0.2, lambdaHome));
  lambdaAway = Math.min(4.5, Math.max(0.2, lambdaAway));

  return { lambdaHome, lambdaAway };
}

const MAX_GOALS = 9; // matrice 0-9 buts comme spécifié dans le README

/**
 * Construit la matrice de probabilités de score : double Poisson indépendant corrigé par le
 * facteur tau de Dixon-Coles sur les scores faibles (0-0, 1-0, 0-1, 1-1), puis renormalisée
 * (la correction tau déplace une petite masse de probabilité, il faut donc re-sommer à 1).
 */
export function scoreMatrix(lambdaHome: number, lambdaAway: number, rho: number = DIXON_COLES_RHO): number[][] {
  const matrix: number[][] = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const row: number[] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const base = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
      const corrected = h <= 1 && a <= 1 ? base * dixonColesTau(h, a, lambdaHome, lambdaAway, rho) : base;
      row.push(corrected);
      total += corrected;
    }
    matrix.push(row);
  }
  // Renormalisation pour que la matrice somme exactement à 1.
  if (total > 0) {
    for (let h = 0; h <= MAX_GOALS; h++) {
      for (let a = 0; a <= MAX_GOALS; a++) {
        matrix[h][a] /= total;
      }
    }
  }
  return matrix;
}

function confidenceFromProbs(top: number, second: number, sampleQuality = 1): number {
  // Plus l'écart entre le résultat le + probable et le 2e est grand, plus la confiance est haute.
  const gap = top - second;
  const base = 50 + gap * 100; // gap max théorique ~1 -> jusqu'à 150 (borné après)
  return Math.round(Math.min(97, Math.max(35, base * sampleQuality)));
}

export function predictMatch(home: TeamInput, away: TeamInput, ctx: MatchContext): PredictionOutput {
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

  const dataGaps: string[] = [];
  if (ctx.h2hHomeWinRate === undefined) dataGaps.push("confrontations directes (H2H) non disponibles");
  if (!home.injuriesImpact && !away.injuriesImpact) dataGaps.push("effectifs/blessures non confirmés");
  if (!home.matchesLast10Days && !away.matchesLast10Days) dataGaps.push("calendrier récent non confirmé");

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
    dataGaps,
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
    dataGaps,
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
  dataGaps: string[];
}): string {
  const { home, away, lambdaHome, lambdaAway, homeWinProb, drawProb, awayWinProb, over25Prob, bttsYesProb, bestScore, dataGaps } =
    args;

  const favorite =
    homeWinProb > awayWinProb && homeWinProb > drawProb
      ? home.name
      : awayWinProb > homeWinProb && awayWinProb > drawProb
      ? away.name
      : null;

  const parts: string[] = [];

  if (favorite) {
    const favProb = favorite === home.name ? homeWinProb : awayWinProb;
    parts.push(`${favorite} est favori avec ${pct(favProb)} de chances de gagner (modèle Dixon-Coles).`);
  } else {
    parts.push(`Match équilibré : le nul est le résultat le plus probable (${pct(drawProb)}).`);
  }

  parts.push(
    `Forme récente (pondérée, plus proche = plus de poids) : ${home.name} (${Math.round(home.formPoints5)}/15) vs ${away.name} (${Math.round(away.formPoints5)}/15).`
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

  if ((home.matchesLast10Days ?? 0) > 2) {
    parts.push(`${home.name} enchaîne les matchs (${home.matchesLast10Days} en 10 jours) : légère fatigue prise en compte.`);
  }
  if ((away.matchesLast10Days ?? 0) > 2) {
    parts.push(`${away.name} enchaîne les matchs (${away.matchesLast10Days} en 10 jours) : légère fatigue prise en compte.`);
  }

  parts.push(`Score le plus probable : ${bestScore.h}-${bestScore.a}.`);
  parts.push(`Plus de 2,5 buts : ${pct(over25Prob)}. Les deux équipes marquent : ${pct(bttsYesProb)}.`);

  if (dataGaps.length > 0) {
    parts.push(`Données manquantes pour ce match (non devinées) : ${dataGaps.join(", ")}.`);
  }

  return parts.join(" ");
}

/**
 * Probabilité implicite "brute" d'une cote (inclut la marge du bookmaker). À utiliser seulement
 * quand on n'a pas les cotes des 3 issues pour dé-marger correctement (ex: marché Over/Under ou
 * BTTS où l'on ne stocke qu'un seul côté) — voir devigProbabilities1x2 pour le 1X2.
 */
export function impliedProbability(decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

/**
 * Retire la marge du bookmaker (overround) sur un marché 1X2 complet : on normalise les 3
 * probabilités implicites brutes pour qu'elles somment exactement à 1, comme demandé
 * ("probabilité implicite de la cote, marge du bookmaker retirée"). C'est la méthode standard
 * de "dé-marginalisation" proportionnelle (il en existe d'autres, plus complexes, mais celle-ci
 * est la plus largement utilisée et suffisante ici).
 */
export function devigProbabilities1x2(
  oddsHome: number,
  oddsDraw: number,
  oddsAway: number
): { home: number; draw: number; away: number; overround: number } | null {
  if (!oddsHome || !oddsDraw || !oddsAway || oddsHome <= 1 || oddsDraw <= 1 || oddsAway <= 1) return null;
  const rawHome = 1 / oddsHome;
  const rawDraw = 1 / oddsDraw;
  const rawAway = 1 / oddsAway;
  const overround = rawHome + rawDraw + rawAway; // > 1 en pratique (marge du bookmaker)
  return {
    home: rawHome / overround,
    draw: rawDraw / overround,
    away: rawAway / overround,
    overround,
  };
}

/** Détermine si un pari a de la "valeur" : proba du modèle nettement supérieure à la proba implicite dé-margée du marché. */
export function isValueBet(modelProb: number, marketProb: number, edgeThreshold = 0.05): boolean {
  if (!marketProb || marketProb <= 0) return false;
  return modelProb - marketProb >= edgeThreshold;
}
