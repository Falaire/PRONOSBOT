/**
 * Source de matchs et de résultats : openfootball/football.json (domaine public, CC0).
 * https://github.com/openfootball/football.json — aucune clé API, aucune limite de quota connue.
 *
 * Format d'un fichier de saison :
 *   { "name": "...", "matches": [ { "round", "date": "2026-08-16", "time"?: "20:00",
 *       "team1", "team2", "score"?: { "ft": [h, a] } } ] }
 * Un match sans `score.ft` est à venir (ou sans résultat connu).
 *
 * Limites connues :
 *  - l'heure `time` n'a pas de fuseau : elle est traitée comme UTC (décalage possible de 1 à 2 h) ;
 *  - les données de la saison en cours sont mises à jour chaque jour depuis la source amont
 *    Football.TXT, qui n'a pas de mise à jour automatique : un score peut arriver avec du retard ;
 *  - seules les ligues listées ci-dessous sont couvertes.
 */

/** Ligues synchronisées. Les codes ont été vérifiés dans le dossier 2026-27 du dépôt. */
export const OPENFOOTBALL_LEAGUES = [
  { code: "en.1", name: "Premier League", country: "Angleterre" },
  { code: "es.1", name: "La Liga", country: "Espagne" },
  { code: "it.1", name: "Serie A", country: "Italie" },
  { code: "de.1", name: "Bundesliga", country: "Allemagne" },
  { code: "fr.1", name: "Ligue 1", country: "France" },
  { code: "nl.1", name: "Eredivisie", country: "Pays-Bas" },
  { code: "pt.1", name: "Primeira Liga", country: "Portugal" },
] as const;

const SEASON_RE = /^\d{4}-\d{2}$/;
const CODE_RE = /^[a-z]{2,3}\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface OfMatch {
  leagueCode: string;
  season: string; // "2026-27"
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM, sans fuseau
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null; // null = pas encore joué
  awayGoals: number | null;
}

/** Code de saison pour une date : juillet à juin, ex. 2026-10-09 -> "2026-27". */
export function seasonFor(date: Date): string {
  const startYear = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Saisons à synchroniser : la précédente (pour l'historique des ratings et H2H) et la courante. */
export function seasonsToSync(now: Date): string[] {
  const current = seasonFor(now);
  const startYear = Number(current.slice(0, 4));
  const previous = `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`;
  return [previous, current];
}

/** URL brute d'un fichier de saison, ex. ("2026-27", "en.1"). */
export function openfootballSeasonUrl(season: string, leagueCode: string): string {
  if (!SEASON_RE.test(season)) throw new Error(`Saison invalide : ${season} (attendu 2026-27)`);
  if (!CODE_RE.test(leagueCode)) throw new Error(`Code ligue invalide : ${leagueCode}`);
  return `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${leagueCode}.json`;
}

/**
 * Lit un fichier de saison. Ignore silencieusement les entrées mal formées (date ou nom absent,
 * score invalide) pour qu'une ligne défectueuse ne bloque pas toute la synchronisation.
 */
export function parseOpenfootball(json: unknown, meta: { leagueCode: string; season: string }): OfMatch[] {
  const matches = (json as { matches?: unknown })?.matches;
  if (!Array.isArray(matches)) return [];

  const out: OfMatch[] = [];
  for (const raw of matches) {
    const m = raw as Record<string, unknown>;
    if (typeof m.date !== "string" || !DATE_RE.test(m.date)) continue;
    if (typeof m.team1 !== "string" || typeof m.team2 !== "string") continue;
    if (!m.team1.trim() || !m.team2.trim()) continue;

    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    const ft = (m.score as { ft?: unknown } | undefined)?.ft;
    if (ft !== undefined) {
      if (!Array.isArray(ft) || ft.length !== 2) continue;
      const [h, a] = ft;
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) continue;
      homeGoals = h as number;
      awayGoals = a as number;
    }

    out.push({
      leagueCode: meta.leagueCode,
      season: meta.season,
      date: m.date,
      time: typeof m.time === "string" && TIME_RE.test(m.time) ? m.time : null,
      homeTeam: m.team1.trim(),
      awayTeam: m.team2.trim(),
      homeGoals,
      awayGoals,
    });
  }
  return out;
}

/** Date de coup d'envoi en ISO. Sans heure connue, on prend midi UTC pour rester le bon jour. */
export function kickoffIso(match: Pick<OfMatch, "date" | "time">): string {
  return `${match.date}T${match.time ?? "12:00"}:00Z`;
}

/** Identifiants stables : une ligue, une équipe et un match ont toujours la même clé. */
export const openfootballIds = {
  league: (code: string) => `of:${code}`,
  team: (code: string, name: string) => `of:${code}:${name}`,
  fixture: (m: OfMatch) => `of:${m.season}:${m.leagueCode}:${m.date}:${m.homeTeam}:${m.awayTeam}`,
};

/**
 * Convertit un match au format attendu par la synchronisation (même forme que l'ancienne
 * réponse API-Football, ce qui évite de réécrire la sélection et l'upsert).
 */
export function toSyncItem(m: OfMatch) {
  const league = OPENFOOTBALL_LEAGUES.find((l) => l.code === m.leagueCode);
  const played = m.homeGoals !== null && m.awayGoals !== null;
  return {
    fixture: {
      id: openfootballIds.fixture(m),
      date: kickoffIso(m),
      status: { short: played ? "FT" : "NS" },
    },
    league: {
      id: openfootballIds.league(m.leagueCode),
      name: league?.name ?? m.leagueCode,
      country: league?.country ?? "Inconnu",
      logo: null,
    },
    teams: {
      home: { id: openfootballIds.team(m.leagueCode, m.homeTeam), name: m.homeTeam, logo: null },
      away: { id: openfootballIds.team(m.leagueCode, m.awayTeam), name: m.awayTeam, logo: null },
    },
    goals: { home: m.homeGoals, away: m.awayGoals },
  };
}
