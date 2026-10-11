import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { applyMatchResult, type RatingUpdateInput } from "@/lib/prediction/ratings";
import { HOME_ADVANTAGE } from "@/lib/prediction/types";
import { sanitizeLeagueAvg } from "@/lib/prediction/league-average";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien (~06h15 Africa/Lome, juste après sync-fixtures et avant predictions/generate) :
 * applique le résultat de chaque match terminé pas encore traité aux ratings (elo, force
 * d'attaque, force défensive, forme) des deux équipes, par décroissance temporelle (EWMA) — voir
 * lib/prediction/ratings.ts pour la justification. C'est ce qui fait que "les matchs récents
 * comptent plus que les anciens" concrètement, plutôt qu'un rating figé pour toujours.
 *
 * Traite les matchs dans l'ordre chronologique (important : une équipe peut jouer deux fois dans
 * le lot du jour) et n'écrit en base qu'à la toute fin, par lot, pour rester rapide même avec
 * plusieurs centaines de matchs terminés.
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const supabase = createAdminClient();

  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      `id, kickoff_at, home_score, away_score,
       league:leagues(avg_goals_per_match),
       home_team_id, away_team_id,
       home:teams!fixtures_home_team_id_fkey(id, elo, attack_rating, defense_rating, form_points_5),
       away:teams!fixtures_away_team_id_fkey(id, elo, attack_rating, defense_rating, form_points_5)`
    )
    .eq("status", "finished")
    .eq("ratings_applied", false)
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .order("kickoff_at", { ascending: true })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, teamsUpdated: 0 });
  }

  // État en mémoire des ratings, initialisé depuis la base puis mis à jour match après match
  // dans l'ordre chronologique (une équipe peut apparaître plusieurs fois dans ce lot).
  const ratingsByTeam = new Map<string, RatingUpdateInput>();
  const errors: string[] = [];
  const processedIds: string[] = [];

  for (const fx of fixtures) {
    try {
      const league = Array.isArray(fx.league) ? fx.league[0] : (fx.league as any);
      const fxHome = Array.isArray(fx.home) ? fx.home[0] : (fx.home as any);
      const fxAway = Array.isArray(fx.away) ? fx.away[0] : (fx.away as any);
      if (!fxHome || !fxAway || fx.home_score === null || fx.away_score === null) continue;

      if (!ratingsByTeam.has(fxHome.id)) {
        ratingsByTeam.set(fxHome.id, {
          attack: Number(fxHome.attack_rating),
          defense: Number(fxHome.defense_rating),
          elo: Number(fxHome.elo),
          formPoints5: Number(fxHome.form_points_5),
        });
      }
      if (!ratingsByTeam.has(fxAway.id)) {
        ratingsByTeam.set(fxAway.id, {
          attack: Number(fxAway.attack_rating),
          defense: Number(fxAway.defense_rating),
          elo: Number(fxAway.elo),
          formPoints5: Number(fxAway.form_points_5),
        });
      }

      const homeRatings = ratingsByTeam.get(fxHome.id)!;
      const awayRatings = ratingsByTeam.get(fxAway.id)!;

      const updated = applyMatchResult(homeRatings, awayRatings, fx.home_score, fx.away_score, {
        leagueAvgGoals: sanitizeLeagueAvg(league?.avg_goals_per_match),
        homeAdvantage: HOME_ADVANTAGE,
      });

      ratingsByTeam.set(fxHome.id, updated.home);
      ratingsByTeam.set(fxAway.id, updated.away);
      processedIds.push(fx.id);
    } catch (e: any) {
      errors.push(`Fixture ${fx.id}: ${e.message}`);
    }
  }

  // Écriture par lot : un seul upsert pour toutes les équipes affectées, une seule mise à jour
  // pour tous les matchs traités.
  let teamsUpdated = 0;
  if (ratingsByTeam.size > 0) {
    const teamsPayload = Array.from(ratingsByTeam.entries()).map(([id, r]) => ({
      id,
      attack_rating: round3(r.attack),
      defense_rating: round3(r.defense),
      elo: round2(r.elo),
      form_points_5: Math.round(r.formPoints5),
      updated_at: new Date().toISOString(),
    }));
    const { error: teamsError } = await supabase.from("teams").upsert(teamsPayload, { onConflict: "id" });
    if (teamsError) {
      errors.push(`Upsert équipes: ${teamsError.message}`);
    } else {
      teamsUpdated = teamsPayload.length;
    }
  }

  if (processedIds.length > 0) {
    const { error: fxError } = await supabase.from("fixtures").update({ ratings_applied: true }).in("id", processedIds);
    if (fxError) errors.push(`Marquage matchs traités: ${fxError.message}`);
  }

  return NextResponse.json({ ok: true, processed: processedIds.length, teamsUpdated, errors });
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export const GET = handler;
export const POST = handler;
