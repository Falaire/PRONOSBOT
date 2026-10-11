/**
 * Moyenne de buts par ÉQUIPE et par match dans une ligue (paramètre leagueAvgGoals du moteur).
 *
 * Correctif : la valeur par défaut historique (2,50) était un total de buts par match, pas une
 * moyenne par équipe. Avec 2,50 le moteur surestimait fortement les buts (plus de 2,5 buts
 * à 91 % sur des équipes neutres). Une moyenne par équipe se situe en pratique autour de 1,3-1,5.
 */

/** Valeur de repli quand la ligue n'a pas assez de matchs terminés pour être mesurée. */
export const DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM = 1.35;

/** En dessous de ce nombre de matchs terminés, la moyenne mesurée est trop bruitée. */
export const MIN_MATCHES_FOR_LEAGUE_AVG = 30;

/** Bornes plausibles pour une moyenne par équipe. Hors de ces bornes, la valeur est suspecte. */
const MIN_PLAUSIBLE = 0.8;
const MAX_PLAUSIBLE = 2.0;

/**
 * Lit la valeur stockée en base et la rend utilisable. Une valeur absente ou hors bornes
 * (par exemple l'ancien 2,50 par défaut) retombe sur la valeur de repli.
 */
export function sanitizeLeagueAvg(stored: unknown): number {
  const n = Number(stored);
  if (!Number.isFinite(n) || n < MIN_PLAUSIBLE || n > MAX_PLAUSIBLE) {
    return DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM;
  }
  return n;
}

/**
 * Calcule la moyenne par équipe à partir des matchs terminés d'une ligue :
 * total des buts / (2 × nombre de matchs), car chaque match compte deux équipes.
 */
export function computeLeagueAvgGoalsPerTeam(
  matches: { home_score: number; away_score: number }[]
): number {
  if (matches.length < MIN_MATCHES_FOR_LEAGUE_AVG) return DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM;
  const totalGoals = matches.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
  const avg = totalGoals / (2 * matches.length);
  const clamped = Math.min(MAX_PLAUSIBLE, Math.max(MIN_PLAUSIBLE, avg));
  return Math.round(clamped * 100) / 100;
}
