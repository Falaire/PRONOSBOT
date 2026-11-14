/**
 * Contexte d'un match calculé à partir des résultats connus (sans API externe) :
 *  - confrontations directes (H2H) : taux de victoires de l'équipe à domicile du match ;
 *  - enjeu : classement de la ligue sur la saison en cours.
 * Les blessures et les cotes ne sont pas calculables à partir de ces données : elles restent vides.
 */

export interface KnownResult {
  leagueCode: string;
  season: string;
  date: string; // ISO, pour l'ordre chronologique
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

/** En dessous, l'historique entre deux équipes est trop court pour être affiché. */
const MIN_H2H_MEETINGS = 3;
const H2H_WINDOW = 5;
/** En dessous de ce nombre de matchs joués par équipe, le classement n'a pas de sens. */
const MIN_PLAYED_FOR_STAKES = 5;

/**
 * Taux de victoire de l'équipe qui joue À DOMICILE dans le match à venir (`home`), sur les
 * 5 dernières confrontations connues avant `beforeIso`, toutes orientations confondues.
 * Renvoie null si moins de 3 confrontations.
 */
export function headToHead(
  results: KnownResult[],
  league: string,
  home: string,
  away: string,
  beforeIso: string
): { homeWinRate: number; sampleSize: number } | null {
  const before = Date.parse(beforeIso);
  const meetings = results
    .filter(
      (r) =>
        r.leagueCode === league &&
        ((r.home === home && r.away === away) || (r.home === away && r.away === home)) &&
        Date.parse(r.date) < before
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, H2H_WINDOW);
  if (meetings.length < MIN_H2H_MEETINGS) return null;

  let homeWins = 0;
  for (const r of meetings) {
    // Victoire de l'équipe qui joue à domicile dans le match à venir.
    const homeGoals = r.home === home ? r.homeGoals : r.awayGoals;
    const awayGoals = r.home === home ? r.awayGoals : r.homeGoals;
    if (homeGoals > awayGoals) homeWins++;
  }
  return {
    homeWinRate: Number((homeWins / meetings.length).toFixed(3)),
    sampleSize: meetings.length,
  };
}

/** Classement d'une ligue sur la saison : position (1 = premier) par équipe, et nombre d'équipes. */
export function leaguePositions(results: KnownResult[]): { positions: Map<string, number>; total: number; minPlayed: number } {
  const table = new Map<string, { pts: number; gd: number; gf: number; played: number }>();
  const row = (team: string) => {
    let r = table.get(team);
    if (!r) {
      r = { pts: 0, gd: 0, gf: 0, played: 0 };
      table.set(team, r);
    }
    return r;
  };
  for (const m of results) {
    const h = row(m.home);
    const a = row(m.away);
    h.played++;
    a.played++;
    h.gf += m.homeGoals;
    a.gf += m.awayGoals;
    h.gd += m.homeGoals - m.awayGoals;
    a.gd += m.awayGoals - m.homeGoals;
    if (m.homeGoals > m.awayGoals) h.pts += 3;
    else if (m.homeGoals < m.awayGoals) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  const sorted = Array.from(table.entries()).sort(
    ([na, a], [nb, b]) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || na.localeCompare(nb)
  );
  const positions = new Map<string, number>();
  sorted.forEach(([name], i) => positions.set(name, i + 1));
  const minPlayed = sorted.length ? Math.min(...sorted.map(([, r]) => r.played)) : 0;
  return { positions, total: sorted.length, minPlayed };
}

/** Note honnête sur l'enjeu du match (null si classement inconnu ou saison trop jeune). */
export function stakesNote(
  positions: Map<string, number>,
  total: number,
  minPlayed: number,
  homeName: string,
  awayName: string
): string | null {
  const homePos = positions.get(homeName);
  const awayPos = positions.get(awayName);
  if (!homePos || !awayPos || !total || minPlayed < MIN_PLAYED_FOR_STAKES) return null;

  const relegationZone = total - 3;
  const homeTitleRace = homePos <= 3;
  const awayTitleRace = awayPos <= 3;
  const homeRelegation = homePos >= relegationZone;
  const awayRelegation = awayPos >= relegationZone;

  if (homeTitleRace && awayTitleRace) return `Choc au sommet : ${homeName} (${homePos}e) reçoit ${awayName} (${awayPos}e).`;
  if (homeRelegation && awayRelegation) return `Match crucial pour le maintien entre deux équipes menacées.`;
  if (homeTitleRace || awayTitleRace) return `Enjeu fort pour la course au titre pour l'une des deux équipes.`;
  if (homeRelegation || awayRelegation) return `Enjeu fort pour le maintien pour l'une des deux équipes.`;
  return null;
}
