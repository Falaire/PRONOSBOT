import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import {
  computeLeagueAvgGoalsPerTeam,
  DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM,
  MIN_MATCHES_FOR_LEAGUE_AVG,
} from "@/lib/prediction/league-average";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_SIZE = 1000; // limite par défaut de PostgREST : on lit par pages pour ne rien perdre

/**
 * Recalcule la moyenne de buts par équipe de chaque ligue à partir des matchs terminés, puis la
 * stocke dans leagues.avg_goals_per_match. À lancer manuellement après un import de résultats,
 * ou une fois par semaine. Ne modifie pas les pronostics existants : relancer ensuite
 * /api/predictions/generate pour les matchs à venir.
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Lecture paginée de tous les matchs terminés avec score
  const byLeague = new Map<string, { home_score: number; away_score: number }[]>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("fixtures")
      .select("id, league_id, home_score, away_score")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    for (const row of data) {
      const list = byLeague.get(row.league_id) ?? [];
      list.push({ home_score: Number(row.home_score), away_score: Number(row.away_score) });
      byLeague.set(row.league_id, list);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 2. Calcul et mise à jour ligue par ligue
  const report: {
    league_id: string;
    matches: number;
    avg_goals_per_team: number;
    fallback: boolean;
  }[] = [];
  const errors: string[] = [];

  for (const [leagueId, matches] of byLeague) {
    const avg = computeLeagueAvgGoalsPerTeam(matches);
    const fallback = matches.length < MIN_MATCHES_FOR_LEAGUE_AVG;
    const { error } = await supabase
      .from("leagues")
      .update({ avg_goals_per_match: avg })
      .eq("id", leagueId);
    if (error) errors.push(`Ligue ${leagueId}: ${error.message}`);
    report.push({ league_id: leagueId, matches: matches.length, avg_goals_per_team: avg, fallback });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    fallback_value: DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM,
    min_matches: MIN_MATCHES_FOR_LEAGUE_AVG,
    leagues_updated: report.length - errors.length,
    report,
    errors,
  });
}

export const GET = handler;
export const POST = handler;
