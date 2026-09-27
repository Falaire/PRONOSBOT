import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

/**
 * Cron quotidien (~06h00 Africa/Lome) : récupère les matchs du jour pour chaque ligue suivie
 * depuis API-Football, et upsert les lignes fixtures/teams correspondantes en base.
 *
 * Nécessite les env vars API_FOOTBALL_KEY. Si absente, renvoie une erreur explicite plutôt
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
    .select("id, external_api_id")
    .eq("active", true)
    .not("external_api_id", "is", null);

  if (leaguesError) return NextResponse.json({ error: leaguesError.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  let fixturesUpserted = 0;
  const errors: string[] = [];

  for (const league of leagues ?? []) {
    try {
      const res = await fetch(
        `${API_FOOTBALL_BASE}/fixtures?league=${league.external_api_id}&season=${new Date().getFullYear()}&date=${today}`,
        { headers: { "x-apisports-key": apiKey }, next: { revalidate: 0 } }
      );
      const json = await res.json();

      for (const item of json.response ?? []) {
        const homeTeamId = await upsertTeam(supabase, item.teams.home, league.id);
        const awayTeamId = await upsertTeam(supabase, item.teams.away, league.id);

        await supabase.from("fixtures").upsert(
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
        );
        fixturesUpserted++;
      }
    } catch (e: any) {
      errors.push(`Ligue ${league.external_api_id}: ${e.message}`);
    }
  }

  return NextResponse.json({ ok: true, fixturesUpserted, errors });
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
