import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { selectFixturesToSync } from "@/lib/fixture-selection";
import {
  OPENFOOTBALL_LEAGUES,
  openfootballSeasonUrl,
  parseOpenfootball,
  seasonFor,
  seasonsToSync,
  toSyncItem,
  type OfMatch,
} from "@/lib/data/openfootball";
import { headToHead, leaguePositions, stakesNote, type KnownResult } from "@/lib/data/match-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Compétitions à afficher en priorité (plus petit = en premier). Les noms correspondent à ceux
 * de OPENFOOTBALL_LEAGUES ; les autres ligues reçoivent la priorité par défaut (100).
 */
const PRIORITY_LEAGUES: Record<string, number> = {
  "premier league": 11,
  "la liga": 12,
  "serie a": 13,
  bundesliga: 14,
  "ligue 1": 15,
};

/** Nombre maximum de matchs NON terminés conservés par exécution (les plus proches d'abord). */
const MAX_FIXTURES = Number(process.env.SYNC_MAX_FIXTURES ?? 500);
/** Nombre maximum de matchs TERMINÉS conservés (les plus récents d'abord), pour update-ratings. */
const MAX_FINISHED_FIXTURES = Number(process.env.SYNC_MAX_FINISHED ?? 2000);
/** Nombre maximum de matchs à venir pour lesquels on calcule H2H et enjeu (écritures une à une). */
const MAX_ENRICHED_FIXTURES = Number(process.env.SYNC_MAX_ENRICHED ?? 200);

/**
 * Cron quotidien : télécharge, pour chaque ligue suivie, les saisons précédente et courante
 * depuis openfootball (aucune clé API), puis :
 *  1. sélectionne les matchs (voir lib/fixture-selection.ts) et les upserte par lot
 *     (ligues, équipes, matchs) ;
 *  2. calcule, pour les matchs à venir, les confrontations directes et l'enjeu à partir des
 *     résultats déjà connus (lib/data/match-context.ts).
 *
 * Les cotes et les blessures ne sont plus synchronisées : openfootball ne les fournit pas. Leurs
 * champs restent vides, et le moteur de pronostics les ignore quand elles manquent.
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. Téléchargement des saisons (une requête par ligue et par saison).
  const parsed: OfMatch[] = [];
  for (const season of seasonsToSync(new Date())) {
    for (const league of OPENFOOTBALL_LEAGUES) {
      try {
        const res = await fetch(openfootballSeasonUrl(season, league.code), { next: { revalidate: 0 } });
        if (!res.ok) {
          errors.push(`${league.code} ${season} : HTTP ${res.status}`);
          continue;
        }
        parsed.push(...parseOpenfootball(await res.json(), { leagueCode: league.code, season }));
      } catch (e: any) {
        errors.push(`${league.code} ${season} : ${e.message}`);
      }
    }
  }

  // 2. Sélection avec deux quotas indépendants (matchs à venir / matchs terminés).
  const allItems = parsed.map(toSyncItem);
  const selection = selectFixturesToSync(allItems, Date.now(), {
    maxOpen: MAX_FIXTURES,
    maxFinished: MAX_FINISHED_FIXTURES,
  });
  const filtered = selection.selected;

  let fixturesUpserted = 0;
  const fixtureIdByExternal = new Map<string, string>();
  const leagueIdByExternal = new Map<string, string>();

  try {
    // 3. Ligues (un lot).
    const leagueByExternal = new Map<string, (typeof filtered)[number]["league"]>();
    for (const item of filtered) leagueByExternal.set(String(item.league.id), item.league);
    const leaguesPayload = Array.from(leagueByExternal.entries()).map(([externalId, league]) => ({
      external_api_id: externalId,
      name: league.name,
      country: league.country,
      logo_url: null,
      priority_order: PRIORITY_LEAGUES[league.name.toLowerCase()] ?? 100,
      active: true,
    }));
    if (leaguesPayload.length > 0) {
      const { data: leagueRows, error } = await supabase
        .from("leagues")
        .upsert(leaguesPayload, { onConflict: "external_api_id" })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert ligues : ${error.message}`);
      for (const row of leagueRows ?? []) leagueIdByExternal.set(row.external_api_id, row.id);
    }

    // 4. Équipes (un lot).
    const teamByExternal = new Map<string, { name: string; leagueExternalId: string }>();
    for (const item of filtered) {
      teamByExternal.set(String(item.teams.home.id), { name: item.teams.home.name, leagueExternalId: String(item.league.id) });
      teamByExternal.set(String(item.teams.away.id), { name: item.teams.away.name, leagueExternalId: String(item.league.id) });
    }
    const teamsPayload = Array.from(teamByExternal.entries()).map(([externalId, team]) => ({
      external_api_id: externalId,
      name: team.name,
      logo_url: null,
      league_id: leagueIdByExternal.get(team.leagueExternalId) ?? null,
    }));
    const teamIdByExternal = new Map<string, string>();
    if (teamsPayload.length > 0) {
      const { data: teamRows, error } = await supabase
        .from("teams")
        .upsert(teamsPayload, { onConflict: "external_api_id", ignoreDuplicates: false })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert équipes : ${error.message}`);
      for (const row of teamRows ?? []) teamIdByExternal.set(row.external_api_id, row.id);
    }

    // 5. Matchs (un lot).
    const fixturesPayload = filtered
      .map((item) => {
        const leagueId = leagueIdByExternal.get(String(item.league.id));
        const homeTeamId = teamIdByExternal.get(String(item.teams.home.id));
        const awayTeamId = teamIdByExternal.get(String(item.teams.away.id));
        if (!leagueId || !homeTeamId || !awayTeamId) return null;
        return {
          external_api_id: String(item.fixture.id),
          league_id: leagueId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff_at: item.fixture.date,
          status: item.fixture.status.short === "FT" ? "finished" : "scheduled",
          home_score: item.goals.home,
          away_score: item.goals.away,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (fixturesPayload.length > 0) {
      const { data: fixtureRows, error } = await supabase
        .from("fixtures")
        .upsert(fixturesPayload, { onConflict: "external_api_id" })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert matchs : ${error.message}`);
      for (const row of fixtureRows ?? []) fixtureIdByExternal.set(row.external_api_id, row.id);
      fixturesUpserted = fixtureRows?.length ?? 0;
    }
  } catch (e: any) {
    errors.push(e.message ?? String(e));
  }

  // 6. Contexte des matchs à venir : H2H et enjeu, calculés sur les résultats déjà connus.
  const knownResults: KnownResult[] = parsed
    .filter((m) => m.homeGoals !== null && m.awayGoals !== null)
    .map((m) => ({
      leagueCode: m.leagueCode,
      season: m.season,
      date: `${m.date}T${m.time ?? "12:00"}:00Z`,
      home: m.homeTeam,
      away: m.awayTeam,
      homeGoals: m.homeGoals as number,
      awayGoals: m.awayGoals as number,
    }));

  const now = Date.now();
  const toEnrich = filtered
    .filter((item) => item.fixture.status.short !== "FT" && new Date(item.fixture.date).getTime() >= now)
    .filter((item) => fixtureIdByExternal.has(String(item.fixture.id)))
    .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
    .slice(0, MAX_ENRICHED_FIXTURES);

  let h2hUpserted = 0;
  let stakesUpserted = 0;
  const standingsCache = new Map<string, ReturnType<typeof leaguePositions>>();

  for (const item of toEnrich) {
    const fixtureId = fixtureIdByExternal.get(String(item.fixture.id))!;
    const leagueCode = String(item.league.id).replace(/^of:/, "");
    const season = seasonFor(new Date(item.fixture.date));
    const patch: Record<string, unknown> = {};

    const h2h = headToHead(knownResults, leagueCode, item.teams.home.name, item.teams.away.name, item.fixture.date);
    if (h2h) {
      patch.h2h_home_win_rate = h2h.homeWinRate;
      patch.h2h_sample_size = h2h.sampleSize;
      h2hUpserted++;
    }

    const key = `${leagueCode}|${season}`;
    if (!standingsCache.has(key)) {
      const seasonResults = knownResults.filter((r) => r.leagueCode === leagueCode && r.season === season);
      standingsCache.set(key, leaguePositions(seasonResults));
    }
    const table = standingsCache.get(key)!;
    const note = stakesNote(table.positions, table.total, table.minPlayed, item.teams.home.name, item.teams.away.name);
    if (note) {
      patch.stakes_note = note;
      stakesUpserted++;
    }

    if (Object.keys(patch).length > 0) {
      const { error: patchError } = await supabase.from("fixtures").update(patch).eq("id", fixtureId);
      if (patchError) errors.push(`Contexte match ${item.fixture.id} : ${patchError.message}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    source: "openfootball",
    fixturesFoundAllLeagues: parsed.length,
    fixturesConsidered: filtered.length,
    selection: {
      openAvailable: selection.openAvailable,
      openKept: selection.openKept,
      finishedAvailable: selection.finishedAvailable,
      finishedKept: selection.finishedKept,
    },
    fixturesUpserted,
    enrichedFixtures: toEnrich.length,
    h2hUpserted,
    stakesUpserted,
    errors,
  });
}

export const GET = handler;
export const POST = handler;
