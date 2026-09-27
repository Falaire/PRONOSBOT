import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { predictMatch, isValueBet } from "@/lib/prediction/engine";
import type { TeamInput } from "@/lib/prediction/types";

export const dynamic = "force-dynamic";

/**
 * Cron quotidien (~06h30 Africa/Lome) : calcule les pronostics (Elo + Poisson) pour tous les
 * matchs à venir dans les prochaines 48h qui n'ont pas encore de prédiction "elo-poisson-v1".
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

  let generated = 0;
  const errors: string[] = [];

  for (const fx of fixtures ?? []) {
    try {
      const home: TeamInput = {
        id: fx.home.id,
        name: fx.home.name,
        elo: Number(fx.home.elo),
        attackRating: Number(fx.home.attack_rating),
        defenseRating: Number(fx.home.defense_rating),
        formPoints5: fx.home.form_points_5,
        injuriesImpact: Number(fx.home.injuries_impact ?? 0),
      };
      const away: TeamInput = {
        id: fx.away.id,
        name: fx.away.name,
        elo: Number(fx.away.elo),
        attackRating: Number(fx.away.attack_rating),
        defenseRating: Number(fx.away.defense_rating),
        formPoints5: fx.away.form_points_5,
        injuriesImpact: Number(fx.away.injuries_impact ?? 0),
      };
      const leagueAvgGoals = Number(fx.league?.avg_goals_per_match ?? 2.5);

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

      const { error: upsertError } = await supabase.from("predictions").upsert(
        {
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
        },
        { onConflict: "fixture_id,model_version" }
      );
      if (upsertError) throw upsertError;
      generated++;
    } catch (e: any) {
      errors.push(`Fixture ${fx.id}: ${e.message}`);
    }
  }

  return NextResponse.json({ ok: true, generated, errors });
}

export const GET = handler;
export const POST = handler;
