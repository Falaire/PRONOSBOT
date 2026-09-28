import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

/**
 * Termes de recherche API-Football pour chaque ligue suivie, indexés par notre code interne
 * (colonne leagues.external_api_id AVANT résolution — voir resolveLeagueId). On ne connaît pas
 * à l'avance l'identifiant numérique réel de chaque compétition sur API-Football (ces IDs ne
 * sont pas documentés publiquement pour toutes les ligues africaines) : on les résout donc
 * dynamiquement via /leagues?search=..., une seule fois, puis on met en cache le résultat en
 * base (external_api_id devient l'identifiant numérique réel pour tous les appels suivants).
 */
const LEAGUE_SEARCH: Record<string, { search: string; country?: string }> = {
  TG1: { search: "Championnat National", country: "Togo" },
  CAF_CL: { search: "CAF Champions League" },
  CAN: { search: "Africa Cup of Nations" },
  CIV1: { search: "Ligue 1", country: "Ivory Coast" },
  SEN1: { search: "Ligue 1", country: "Senegal" },
  UCL: { search: "UEFA Champions League" },
  EPL: { search: "Premier League", country: "England" },
  LIGA: { search: "La Liga", country: "Spain" },
  SERIEA: { search: "Serie A", country: "Italy" },
  BUNDES: { search: "Bundesliga", country: "Germany" },
  LIGUE1: { search: "Ligue 1", country: "France" },
};

/** Bookmaker API-Football à privilégier pour les cotes — cohérent avec ce que l'utilisateur voit sur 1xBet. */
const PREFERRED_BOOKMAKER = "1xBet";

/**
 * Cron quotidien (~06h00 Africa/Lome) : résout les vrais identifiants de ligue API-Football si
 * besoin, récupère les matchs du jour + les cotes réelles (1xBet en priorité) pour chaque ligue
 * suivie, et upsert les lignes fixtures/teams correspondantes en base.
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
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("id, external_api_id, name, country")
    .eq("active", true)
    .not("external_api_id", "is", null);

  if (leaguesError) return NextResponse.json({ error: leaguesError.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const season = new Date().getFullYear();
  let fixturesUpserted = 0;
  let oddsUpserted = 0;
  const errors: string[] = [];
  const resolved: string[] = [];

  for (const league of leagues ?? []) {
    try {
      // 1. Résout l'identifiant API-Football réel si on a encore notre code interne (non numérique).
      let apiLeagueId = league.external_api_id as string;
      if (!/^\d+$/.test(apiLeagueId)) {
        const hint = LEAGUE_SEARCH[apiLeagueId];
        const newId = await resolveLeagueId(apiKey, hint?.search ?? league.name, hint?.country ?? league.country);
        if (!newId) {
          errors.push(`${league.name} : impossible de résoudre l'identifiant API-Football (compétition introuvable).`);
          continue;
        }
        apiLeagueId = newId;
        await supabase.from("leagues").update({ external_api_id: apiLeagueId }).eq("id", league.id);
        resolved.push(`${league.name} → ${apiLeagueId}`);
      }

      // 2. Récupère les matchs du jour pour cette ligue.
      const res = await fetch(
        `${API_FOOTBALL_BASE}/fixtures?league=${apiLeagueId}&season=${season}&date=${today}`,
        { headers: { "x-apisports-key": apiKey }, next: { revalidate: 0 } }
      );
      const json = await res.json();
      const fixtureRows: { id: string; externalId: string }[] = [];

      for (const item of json.response ?? []) {
        const homeTeamId = await upsertTeam(supabase, item.teams.home, league.id);
        const awayTeamId = await upsertTeam(supabase, item.teams.away, league.id);

        const { data: fx } = await supabase
          .from("fixtures")
          .upsert(
            {
              external_api_id: String(item.fixture.id),
              league_id: league.id,
              home_team_id: homeTeamId,
              away_team_id: awayTeamId,
              kickoff_at: item.fixture.date,
              status: mapStatus(item.fixture.status?.short),
              home_score: item.goals?.home,
              away_score: item.goals?.away,
            },
            { onConflict: "external_api_id" }
          )
          .select("id")
          .single();

        if (fx) fixtureRows.push({ id: fx.id, externalId: String(item.fixture.id) });
        fixturesUpserted++;
      }

      // 3. Récupère les cotes réelles du jour pour cette ligue (1xBet en priorité), best-effort :
      //    certains plans API-Football ne couvrent pas les cotes pour toutes les compétitions.
      if (fixtureRows.length > 0) {
        try {
          const oddsRes = await fetch(
            `${API_FOOTBALL_BASE}/odds?league=${apiLeagueId}&season=${season}&date=${today}`,
            { headers: { "x-apisports-key": apiKey }, next: { revalidate: 0 } }
          );
          const oddsJson = await oddsRes.json();

          for (const entry of oddsJson.response ?? []) {
            const match = fixtureRows.find((f) => f.externalId === String(entry.fixture?.id));
            if (!match) continue;

            const odds = extractMatchWinnerOdds(entry.bookmakers);
            if (!odds) continue;

            await supabase
              .from("fixtures")
              .update({ odds_home: odds.home, odds_draw: odds.draw, odds_away: odds.away })
              .eq("id", match.id);
            oddsUpserted++;
          }
        } catch (e: any) {
          errors.push(`Cotes ${league.name} : ${e.message}`);
        }
      }
    } catch (e: any) {
      errors.push(`Ligue ${league.name} : ${e.message}`);
    }
  }

  return NextResponse.json({ ok: true, fixturesUpserted, oddsUpserted, resolved, errors });
}

/** Résout l'identifiant numérique réel d'une compétition via /leagues?search=... */
async function resolveLeagueId(apiKey: string, search: string, country?: string): Promise<string | null> {
  const res = await fetch(`${API_FOOTBALL_BASE}/leagues?search=${encodeURIComponent(search)}`, {
    headers: { "x-apisports-key": apiKey },
  });
  const json = await res.json();
  const candidates: any[] = json.response ?? [];
  if (candidates.length === 0) return null;

  const normalizedCountry = country?.toLowerCase();
  const match =
    (normalizedCountry && candidates.find((c) => c.country?.name?.toLowerCase() === normalizedCountry)) ||
    candidates[0];

  return match?.league?.id ? String(match.league.id) : null;
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

async function upsertTeam(supabase: any, team: { id: number; name: string; logo: string }, leagueId: string) {
  const { data, error } = await supabase
    .from("teams")
    .upsert(
      { external_api_id: String(team.id), name: team.name, logo_url: team.logo, league_id: leagueId },
      { onConflict: "external_api_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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
