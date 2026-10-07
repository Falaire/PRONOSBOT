import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

/** Bookmaker API-Football à privilégier pour les cotes — cohérent avec ce que l'utilisateur voit sur 1xBet. */
const PREFERRED_BOOKMAKER = "1xBet";

/**
 * Compétitions à afficher en priorité (plus petit = en premier). Tout le reste (littéralement
 * toutes les autres ligues renvoyées par API-Football, ~1200 au total) reçoit la priorité par
 * défaut de la base (100) — elles restent synchronisées et visibles, simplement pas mises en
 * avant en premier si un tri par priorité est utilisé quelque part dans l'UI.
 */
const PRIORITY_LEAGUES: Record<string, number> = {
  "championnat national": 1, // Ligue 1 Togo
  "caf champions league": 2,
  "africa cup of nations": 3,
  "uefa champions league": 10,
  "premier league": 11,
  "la liga": 12,
  "serie a": 13,
  bundesliga: 14,
  "ligue 1": 15,
};

/** Évite de remplir la base avec des compétitions académie/réserve, peu voire jamais proposées
 * par les bookmakers grand public (1xBet, Betwinner...). Tout le reste (y compris les très
 * petites ligues nationales) est conservé : c'est justement l'objectif de cette synchronisation
 * "toutes ligues" plutôt que la précédente liste de ~11 championnats codés en dur. */
const EXCLUDED_LEAGUE_PATTERN = /\b(u1[5-9]|u2[0-3]|youth|reserve|réserve)\b/i;

/**
 * Nombre maximum de matchs conservés par exécution (triés par coup d'envoi le plus proche),
 * pour garder la synchronisation et l'affichage raisonnables même les jours chargés (plusieurs
 * milliers de matchs dans le monde un même week-end). Augmente API_FOOTBALL_MAX_FIXTURES si tu
 * veux littéralement tout garder et que ton plan API-Football / ta base le permettent.
 */
const MAX_FIXTURES = Number(process.env.API_FOOTBALL_MAX_FIXTURES ?? 500);

/**
 * Nombre maximum de matchs pour lesquels on va chercher les cotes réelles (1 appel API par
 * match). Les cotes sont secondaires à l'affichage (le champ `odds` est optionnel côté UI) donc
 * on les limite pour rester dans le quota de la clé API-Football utilisée (le plan gratuit ne
 * donne que 100 appels/jour au total, tous endpoints confondus). Augmente
 * API_FOOTBALL_MAX_ODDS si ton plan le permet.
 */
const MAX_ODDS_FIXTURES = Number(process.env.API_FOOTBALL_MAX_ODDS ?? 30);

type RawFixture = any;

/**
 * Cron quotidien (~06h00 Africa/Lome) : récupère TOUS les matchs programmés sur les prochaines
 * 48h, toutes compétitions confondues (~1200 ligues/coupes couvertes par API-Football — le même
 * univers de matchs que l'on retrouve chez les bookmakers africains comme 1xBet, Betwinner,
 * SportyBet...), au lieu de se limiter à une liste figée de championnats. Récupère ensuite les
 * cotes réelles (1xBet en priorité) pour les matchs les plus proches, et upsert les lignes
 * leagues/teams/fixtures correspondantes en base — en traitant les écritures PAR LOTS (pas une
 * requête base par match) pour rester rapide même avec plusieurs centaines de matchs.
 *
 * Nécessite la env var API_FOOTBALL_KEY. Si absente, renvoie une erreur explicite plutôt
 * que de planter silencieusement (utile en environnement de démo sans clé payante).
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API_FOOTBALL_KEY manquante — synchronisation ignorée (mode démo)." },
      { status: 200 }
    );
  }

  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. Récupère TOUS les matchs (toutes ligues) pour aujourd'hui et demain — une seule requête
  //    API par jour suffit (pas de boucle par ligue), ce qui reste économe en quota même sur le
  //    plan gratuit API-Football (100 requêtes/jour).
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const dates = [today, tomorrow].map((d) => d.toISOString().slice(0, 10));

  const allRaw: RawFixture[] = [];
  for (const date of dates) {
    try {
      const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?date=${date}`, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 0 },
      });
      const json = await res.json();
      if (json.errors && Object.keys(json.errors).length > 0) {
        errors.push(`Fixtures ${date} : ${JSON.stringify(json.errors)}`);
        continue;
      }
      allRaw.push(...(json.response ?? []));
    } catch (e: any) {
      errors.push(`Fixtures ${date} : ${e.message}`);
    }
  }

  // 2. Filtre le bruit académie/réserve, garde uniquement les matchs pas encore joués, trie par
  //    coup d'envoi le plus proche, et plafonne à MAX_FIXTURES pour rester raisonnable.
  const now = Date.now();
  const filtered: RawFixture[] = allRaw
    .filter((item) => !EXCLUDED_LEAGUE_PATTERN.test(item.league?.name ?? ""))
    .filter((item) => new Date(item.fixture?.date).getTime() >= now - 3 * 3600 * 1000)
    .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
    .slice(0, MAX_FIXTURES);

  let fixturesUpserted = 0;
  let oddsUpserted = 0;
  const fixtureIdByExternal = new Map<string, string>();

  try {
    // 3. Upsert PAR LOT des ligues distinctes (une seule requête base, peu importe le nombre de matchs).
    const leagueByExternal = new Map<string, any>();
    for (const item of filtered) {
      if (item.league?.id) leagueByExternal.set(String(item.league.id), item.league);
    }
    const leaguesPayload = Array.from(leagueByExternal.entries()).map(([externalId, league]) => ({
      external_api_id: externalId,
      name: league.name,
      country: league.country ?? "Inconnu",
      logo_url: league.logo ?? null,
      priority_order: PRIORITY_LEAGUES[league.name?.toLowerCase()] ?? 100,
      active: true,
    }));
    const leagueIdByExternal = new Map<string, string>();
    if (leaguesPayload.length > 0) {
      const { data: leagueRows, error } = await supabase
        .from("leagues")
        .upsert(leaguesPayload, { onConflict: "external_api_id" })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert ligues : ${error.message}`);
      for (const row of leagueRows ?? []) leagueIdByExternal.set(row.external_api_id, row.id);
    }

    // 4. Upsert PAR LOT des équipes distinctes (domicile + extérieur de tous les matchs retenus).
    const teamByExternal = new Map<string, { team: any; leagueExternalId: string }>();
    for (const item of filtered) {
      if (item.teams?.home?.id) teamByExternal.set(String(item.teams.home.id), { team: item.teams.home, leagueExternalId: String(item.league.id) });
      if (item.teams?.away?.id) teamByExternal.set(String(item.teams.away.id), { team: item.teams.away, leagueExternalId: String(item.league.id) });
    }
    const teamsPayload = Array.from(teamByExternal.entries()).map(([externalId, { team, leagueExternalId }]) => ({
      external_api_id: externalId,
      name: team.name,
      logo_url: team.logo ?? null,
      league_id: leagueIdByExternal.get(leagueExternalId) ?? null,
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

    // 5. Upsert PAR LOT des matchs eux-mêmes.
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
          status: mapStatus(item.fixture.status?.short),
          home_score: item.goals?.home ?? null,
          away_score: item.goals?.away ?? null,
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

  // 6. Cotes réelles (1xBet en priorité) pour les matchs les plus proches uniquement (1 appel API
  //    par match, plafonné par MAX_ODDS_FIXTURES) — le reste des matchs reste affiché sans cote
  //    de référence (champ `odds` optionnel côté UI, voir lib/demo-data.ts / MatchCard.tsx).
  const nearestExternalIds = filtered
    .map((item) => String(item.fixture.id))
    .filter((id) => fixtureIdByExternal.has(id))
    .slice(0, MAX_ODDS_FIXTURES);

  for (const externalId of nearestExternalIds) {
    try {
      const oddsRes = await fetch(`${API_FOOTBALL_BASE}/odds?fixture=${externalId}`, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 0 },
      });
      const oddsJson = await oddsRes.json();
      const entry = (oddsJson.response ?? [])[0];
      if (!entry) continue;

      const odds = extractMatchWinnerOdds(entry.bookmakers);
      if (!odds) continue;

      await supabase
        .from("fixtures")
        .update({ odds_home: odds.home, odds_draw: odds.draw, odds_away: odds.away })
        .eq("id", fixtureIdByExternal.get(externalId));
      oddsUpserted++;
    } catch (e: any) {
      errors.push(`Cotes match ${externalId} : ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    fixturesFoundAllLeagues: allRaw.length,
    fixturesConsidered: filtered.length,
    fixturesUpserted,
    oddsUpserted,
    errors,
  });
}

/** Cote 1X2 ("Match Winner") du bookmaker préféré (1xBet), sinon celles du premier bookmaker disponible. */
function extractMatchWinnerOdds(bookmakers: any[] = []): { home: number; draw: number; away: number } | null {
  const preferred = bookmakers.find((b) => b.name?.toLowerCase() === PREFERRED_BOOKMAKER.toLowerCase());
  const source = preferred ?? bookmakers[0];
  if (!source) return null;

  const matchWinnerBet = source.bets?.find((b: any) => b.name === "Match Winner");
  if (!matchWinnerBet) return null;

  const home = matchWinnerBet.values?.find((v: any) => v.value === "Home")?.odd;
  const draw = matchWinnerBet.values?.find((v: any) => v.value === "Draw")?.odd;
  const away = matchWinnerBet.values?.find((v: any) => v.value === "Away")?.odd;
  if (!home || !draw || !away) return null;

  return { home: Number(home), draw: Number(draw), away: Number(away) };
}

function mapStatus(short?: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  if (!short) return "scheduled";
  if (["1H", "2H", "HT", "ET", "P", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST"].includes(short)) return "postponed";
  if (["CANC", "ABD"].includes(short)) return "cancelled";
  return "scheduled";
}

export const GET = handler;
export const POST = handler;
