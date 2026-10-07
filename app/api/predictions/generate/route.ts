import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { predictMatch, isValueBet } from "@/lib/prediction/engine";
import type { TeamInput } from "@/lib/prediction/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien (~06h30 Africa/Lome) : calcule les pronostics (Elo + Poisson) pour tous les
 * matchs à venir dans les prochaines 48h qui n'ont pas encore de prédiction "elo-poisson-v1".
 * Le calcul lui-même est fait en mémoire (rapide, pas d'appel réseau), puis écrit en base en
 * UN SEUL upsert par lot (pas une requête par match) : important depuis que la synchronisation
 * couvre toutes les compétitions (voir sync-fixtures) et peut ramener plusieurs centaines de
 * matchs par jour.
 */
async function handler(req: NextRequest) {
  const auth = await assertAdminOrCron(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  const { data: fixtures, error } = await supabase
    .from("fixtures")
    .select(
      `id, kickoff_at, odds_home, odds_draw, odds_away, league:leagues(avg_goals_per_match),
       home:teams!fixtures_home_team_id_fkey(id, name, elo, attack_rating, defense_rating, form_points_5, injuries_impact),
       away:teams!fixtures_away_team_id_fkey(id, name, elo, attack_rating, defense_rating, form_points_5, injuries_impact)`
    )
    .eq("status", "scheduled")
    .gte("kickoff_at", now.toISOString())
    .lte("kickoff_at", in48h.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const fx of fixtures ?? []) {
    try {
      const league = Array.isArray(fx.league) ? fx.league[0] : fx.league;
      const fxHome = Array.isArray(fx.home) ? fx.home[0] : fx.home;
      const fxAway = Array.isArray(fx.away) ? fx.away[0] : fx.away;

      const home: TeamInput = {
        id: fxHome.id,
        name: fxHome.name,
        elo: Number(fxHome.elo),
        attackRating: Number(fxHome.attack_rating),
        defenseRating: Number(fxHome.defense_rating),
        formPoints5: fxHome.form_points_5,
        injuriesImpact: Number(fxHome.injuries_impact ?? 0),
      };
      const away: TeamInput = {
        id: fxAway.id,
        name: fxAway.name,
        elo: Number(fxAway.elo),
        attackRating: Number(fxAway.attack_rating),
        defenseRating: Number(fxAway.defense_rating),
        formPoints5: fxAway.form_points_5,
        injuriesImpact: Number(fxAway.injuries_impact ?? 0),
      };
      const leagueAvgGoals = Number(league?.avg_goals_per_match ?? 2.5);

      const result = predictMatch(home, away, { leagueAvgGoals });

      let valueBetMarket: string | null = null;
      let isValue = false;
      if (fx.odds_home && isValueBet(result.homeWinProb, Number(fx.odds_home))) {
        valueBetMarket = "1";
        isValue = true;
      } else if (fx.odds_away && isValueBet(result.awayWinProb, Number(fx.odds_away))) {
        valueBetMarket = "2";
        isValue = true;
      } else if (fx.odds_draw && isValueBet(result.drawProb, Number(fx.odds_draw))) {
        valueBetMarket = "X";
        isValue = true;
      }

      rows.push({
        fixture_id: fx.id,
        model_version: "elo-poisson-v1",
        prob_home: result.homeWinProb,
        prob_draw: result.drawProb,
        prob_away: result.awayWinProb,
        prob_over25: result.over25Prob,
        prob_btts_yes: result.bttsYesProb,
        predicted_score_home: result.predictedScoreHome,
        predicted_score_away: result.predictedScoreAway,
        confidence: result.confidence,
        explanation_text: result.explanation,
        is_value_bet: isValue,
        value_bet_market: valueBetMarket,
        updated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      errors.push(`Fixture ${fx.id}: ${e.message}`);
    }
  }

  let generated = 0;
  // Supabase/PostgREST plafonne généralement un upsert par lot à ~1000 lignes ; on découpe par
  // sécurité même si le nombre de matchs sur 48h reste en pratique bien en-dessous.
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: upsertError } = await supabase
      .from("predictions")
      .upsert(batch, { onConflict: "fixture_id,model_version" });
    if (upsertError) {
      errors.push(`Lot ${i}-${i + batch.length}: ${upsertError.message}`);
      continue;
    }
    generated += batch.length;
  }

  return NextResponse.json({ ok: true, generated, errors });
}

export const GET = handler;
export const POST = handler;
