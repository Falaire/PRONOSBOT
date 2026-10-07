import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { predictMatch, isValueBet, impliedProbability, devigProbabilities1x2 } from "@/lib/prediction/engine";
import type { TeamInput, MatchContext } from "@/lib/prediction/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien (~06h30 Africa/Lome, après update-ratings) : calcule les pronostics (Dixon-Coles
 * + signaux contextuels) pour tous les matchs à venir dans les prochaines 48h.
 *
 * Marché 1X2 : la "value" est calculée en comparant la probabilité du modèle à la probabilité
 * implicite du marché APRÈS retrait de la marge du bookmaker (dé-margeage proportionnel sur les
 * 3 cotes), comme demandé explicitement. Pour Over/Under 2.5 et BTTS, on ne stocke qu'un seul
 * côté de cote (pas les deux), donc on ne peut pas dé-marger proprement ces deux marchés : on
 * utilise alors la probabilité implicite brute (avec marge), explicitement documentée comme
 * telle plutôt que présentée à tort comme "nette".
 *
 * Le calcul est fait en mémoire (rapide), puis écrit en base en UN SEUL upsert par lot.
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
      `id, kickoff_at, odds_home, odds_draw, odds_away, odds_over25, odds_btts_yes,
       h2h_home_win_rate, h2h_sample_size, stakes_note,
       home_team_id, away_team_id,
       league:leagues(avg_goals_per_match),
       home:teams!fixtures_home_team_id_fkey(id, name, elo, attack_rating, defense_rating, form_points_5, injuries_impact),
       away:teams!fixtures_away_team_id_fkey(id, name, elo, attack_rating, defense_rating, form_points_5, injuries_impact)`
    )
    .eq("status", "scheduled")
    .gte("kickoff_at", now.toISOString())
    .lte("kickoff_at", in48h.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];

  // --- Fatigue / enchaînement : une seule requête pour tous les matchs du lot, plutôt qu'une
  // requête par équipe. On compte les matchs (terminés ou programmés) dans les 10 derniers jours
  // pour chaque équipe impliquée dans ce lot. Coût nul en appels API externes (données déjà en base).
  const teamIds = new Set<string>();
  for (const fx of fixtures ?? []) {
    if (fx.home_team_id) teamIds.add(fx.home_team_id as string);
    if (fx.away_team_id) teamIds.add(fx.away_team_id as string);
  }
  const matchCountByTeam = new Map<string, number>();
  if (teamIds.size > 0) {
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
    const idsArray = Array.from(teamIds);
    // Découpé par lots de 100 ids pour éviter une URL de filtre démesurée (GET) si beaucoup de
    // matchs/équipes distinctes sont concernés un même jour (couverture toutes ligues).
    const CHUNK = 100;
    for (let i = 0; i < idsArray.length; i += CHUNK) {
      const chunk = idsArray.slice(i, i + CHUNK);
      const { data: recentFixtures } = await supabase
        .from("fixtures")
        .select("home_team_id, away_team_id")
        .gte("kickoff_at", tenDaysAgo.toISOString())
        .lte("kickoff_at", now.toISOString())
        .or(`home_team_id.in.(${chunk.join(",")}),away_team_id.in.(${chunk.join(",")})`);
      for (const row of recentFixtures ?? []) {
        if (chunk.includes(row.home_team_id)) matchCountByTeam.set(row.home_team_id, (matchCountByTeam.get(row.home_team_id) ?? 0) + 1);
        if (chunk.includes(row.away_team_id)) matchCountByTeam.set(row.away_team_id, (matchCountByTeam.get(row.away_team_id) ?? 0) + 1);
      }
    }
  }

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
        matchesLast10Days: matchCountByTeam.get(fxHome.id) ?? 0,
      };
      const away: TeamInput = {
        id: fxAway.id,
        name: fxAway.name,
        elo: Number(fxAway.elo),
        attackRating: Number(fxAway.attack_rating),
        defenseRating: Number(fxAway.defense_rating),
        formPoints5: fxAway.form_points_5,
        injuriesImpact: Number(fxAway.injuries_impact ?? 0),
        matchesLast10Days: matchCountByTeam.get(fxAway.id) ?? 0,
      };
      const leagueAvgGoals = Number(league?.avg_goals_per_match ?? 2.5);

      const ctx: MatchContext = {
        leagueAvgGoals,
        h2hHomeWinRate: fx.h2h_home_win_rate !== null ? Number(fx.h2h_home_win_rate) : undefined,
        h2hSampleSize: fx.h2h_sample_size ?? undefined,
      };

      const result = predictMatch(home, away, ctx);

      // --- Value bet 1X2, calculée sur la probabilité marché DÉ-MARGÉE (marge bookmaker retirée) ---
      let valueBetMarket: string | null = null;
      let isValue = false;
      let edgeValue: number | null = null;
      let marketProbUsed: number | null = null;

      const devig =
        fx.odds_home && fx.odds_draw && fx.odds_away
          ? devigProbabilities1x2(Number(fx.odds_home), Number(fx.odds_draw), Number(fx.odds_away))
          : null;

      if (devig) {
        const candidates: { market: string; model: number; market_: number }[] = [
          { market: "1", model: result.homeWinProb, market_: devig.home },
          { market: "X", model: result.drawProb, market_: devig.draw },
          { market: "2", model: result.awayWinProb, market_: devig.away },
        ];
        // On retient le marché avec le plus grand écart positif (la "meilleure" value, pas
        // simplement le premier qui dépasse le seuil).
        let best: { market: string; model: number; market_: number; edge: number } | null = null;
        for (const c of candidates) {
          const edge = c.model - c.market_;
          if (isValueBet(c.model, c.market_) && (!best || edge > best.edge)) {
            best = { ...c, edge };
          }
        }
        if (best) {
          valueBetMarket = best.market;
          isValue = true;
          edgeValue = round4(best.edge);
          marketProbUsed = round4(best.market_);
        }
      }

      // --- Over/Under 2.5 et BTTS : pas de dé-margeage possible (un seul côté de cote stocké),
      // on compare donc à la proba implicite BRUTE, uniquement si aucune value 1X2 déjà trouvée
      // (pour ne pas multiplier les "fausses" values moins fiables) et on le documente dans data_gaps.
      const extraDataGaps = [...result.dataGaps];
      if (!isValue && fx.odds_over25) {
        const marketOver = impliedProbability(Number(fx.odds_over25));
        if (isValueBet(result.over25Prob, marketOver, 0.07)) {
          valueBetMarket = "over25";
          isValue = true;
          edgeValue = round4(result.over25Prob - marketOver);
          marketProbUsed = round4(marketOver);
          extraDataGaps.push("value sur Over 2.5 basée sur une cote non dé-margée (marge bookmaker non retirée pour ce marché)");
        }
      } else if (!isValue && fx.odds_btts_yes) {
        const marketBtts = impliedProbability(Number(fx.odds_btts_yes));
        if (isValueBet(result.bttsYesProb, marketBtts, 0.07)) {
          valueBetMarket = "btts_yes";
          isValue = true;
          edgeValue = round4(result.bttsYesProb - marketBtts);
          marketProbUsed = round4(marketBtts);
          extraDataGaps.push("value sur BTTS basée sur une cote non dé-margée (marge bookmaker non retirée pour ce marché)");
        }
      }

      if (!devig && (fx.odds_home || fx.odds_draw || fx.odds_away)) {
        extraDataGaps.push("cotes 1X2 incomplètes, dé-margeage impossible");
      }
      if (fx.stakes_note) {
        // L'enjeu est purement contextuel (affiché), jamais traduit en ajustement numérique de proba.
      }

      rows.push({
        fixture_id: fx.id,
        model_version: "elo-poisson-v1", // identifiant technique interne inchangé, voir commentaire ci-dessus
        prob_home: result.homeWinProb,
        prob_draw: result.drawProb,
        prob_away: result.awayWinProb,
        prob_over25: result.over25Prob,
        prob_btts_yes: result.bttsYesProb,
        predicted_score_home: result.predictedScoreHome,
        predicted_score_away: result.predictedScoreAway,
        confidence: result.confidence,
        explanation_text: fx.stakes_note ? `${result.explanation} Enjeu : ${fx.stakes_note}` : result.explanation,
        is_value_bet: isValue,
        value_bet_market: valueBetMarket,
        edge_value: edgeValue,
        market_prob_used: marketProbUsed,
        data_gaps: extraDataGaps.length > 0 ? extraDataGaps.join(" | ") : null,
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

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export const GET = handler;
export const POST = handler;
