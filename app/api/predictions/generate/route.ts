import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { predictMatch, isValueBet, impliedProbability, devigProbabilities1x2 } from "@/lib/prediction/engine";
import type { TeamInput, MatchContext } from "@/lib/prediction/types";
import { sanitizeLeagueAvg } from "@/lib/prediction/league-average";
import {
  blend1x2,
  blendBinary,
  MARKET_WEIGHT_1X2,
  MARKET_WEIGHT_OVER25,
  MARKET_WEIGHT_BTTS,
} from "@/lib/prediction/calibration";

export const dynamic = "force-dynamic";

/** Version du modele. Changer cette chaine cree un carnet parallele (unique fixture_id+model_version) :
 * c'est ce qui permet de comparer elo-poisson-v1 (avant correctifs) et v2 (apres) sur les memes matchs. */
const MODEL_VERSION = "elo-poisson-v2";
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
  const oddsByFixture = new Map<string, Record<string, unknown>>();

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
      const leagueAvgGoals = sanitizeLeagueAvg(league?.avg_goals_per_match);

      const ctx: MatchContext = {
        leagueAvgGoals,
        h2hHomeWinRate: fx.h2h_home_win_rate !== null ? Number(fx.h2h_home_win_rate) : undefined,
        h2hSampleSize: fx.h2h_sample_size ?? undefined,
      };

      const result = predictMatch(home, away, ctx);

      const devig =
        fx.odds_home && fx.odds_draw && fx.odds_away
          ? devigProbabilities1x2(Number(fx.odds_home), Number(fx.odds_draw), Number(fx.odds_away))
          : null;

      // --- Calibration de sortie (temperature + retractation vers le marche) ---
      // Le moteur classe bien les favoris mais est trop sur de lui : ces deux scalaires, ajustes sur
      // train et valides sur 999 matchs de test, font passer le log-loss 1X2 de 1.04635 a 1.00670
      // (marche seul : 0.99776) et remontent l'argmax de 49.05 % a 50.45 %. Voir lib/prediction/calibration.ts.
      const probs = blend1x2(
        { home: result.homeWinProb, draw: result.drawProb, away: result.awayWinProb },
        devig ? { home: devig.home, draw: devig.draw, away: devig.away } : null,
        MARKET_WEIGHT_1X2
      );
      const over25 = blendBinary(
        result.over25Prob,
        fx.odds_over25 ? impliedProbability(Number(fx.odds_over25)) : null,
        MARKET_WEIGHT_OVER25
      );
      const btts = blendBinary(
        result.bttsYesProb,
        fx.odds_btts_yes ? impliedProbability(Number(fx.odds_btts_yes)) : null,
        MARKET_WEIGHT_BTTS
      );

      // --- Value bet 1X2, calculée sur la probabilité marché DÉ-MARGÉE (marge bookmaker retirée) ---
      // La value est evaluee APRES calibration, donc sur la probabilite reellement publiee : un
      // signal qui ne survit pas au retractation vers le marche n'est pas une value, c'est le bruit
      // du modele. Consequence attendue et souhaitee : moins de drapeaux « value », mais defensables.
      let valueBetMarket: string | null = null;
      let isValue = false;
      let edgeValue: number | null = null;
      let marketProbUsed: number | null = null;

      if (devig) {
        const candidates: { market: string; model: number; market_: number }[] = [
          { market: "1", model: probs.home, market_: devig.home },
          { market: "X", model: probs.draw, market_: devig.draw },
          { market: "2", model: probs.away, market_: devig.away },
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
        if (isValueBet(over25.prob, marketOver, 0.07)) {
          valueBetMarket = "over25";
          isValue = true;
          edgeValue = round4(over25.prob - marketOver);
          marketProbUsed = round4(marketOver);
          extraDataGaps.push("value sur Over 2.5 basée sur une cote non dé-margée (marge bookmaker non retirée pour ce marché)");
        }
      } else if (!isValue && fx.odds_btts_yes) {
        const marketBtts = impliedProbability(Number(fx.odds_btts_yes));
        if (isValueBet(btts.prob, marketBtts, 0.07)) {
          valueBetMarket = "btts_yes";
          isValue = true;
          edgeValue = round4(btts.prob - marketBtts);
          marketProbUsed = round4(marketBtts);
          extraDataGaps.push("value sur BTTS basée sur une cote non dé-margée (marge bookmaker non retirée pour ce marché)");
        }
      }

      if (!devig && (fx.odds_home || fx.odds_draw || fx.odds_away)) {
        extraDataGaps.push("cotes 1X2 incomplètes, dé-margeage impossible");
      }
      if (!probs.blended) {
        // Sans marche, le pronostic reste celui du modele (non retracte) : a afficher comme tel,
        // parce qu'un 1X2 non confronte au marche n'a pas la meme valeur de confiance.
        extraDataGaps.push("pronostic non calibre sur le marche (cotes indisponibles)");
      }
      if (fx.stakes_note) {
        // L'enjeu est purement contextuel (affiché), jamais traduit en ajustement numérique de proba.
      }

      // La confiance publiee se lit sur les probabilites PUBLIEES (melangees), pas sur celles du
      // modele nu : sinon la barre « confiance » et le « vainqueur a x % » cessent de parler la meme
      // langue — c'etait exactement l'ecart 78 % / 58 % constate sur les fiches.
      const pubSorted = [probs.home, probs.draw, probs.away].sort((a, b) => b - a);
      const quality = 1 - Math.min(0.25, extraDataGaps.length * 0.08);
      const confidence = Math.round(Math.min(97, Math.max(35, pubSorted[0] * 100 * quality)));

      rows.push({
        fixture_id: fx.id,
        model_version: MODEL_VERSION, // v2 = total de buts conserve + calibration (le carnet garde v1 separement)
        prob_home: round4(probs.home),
        prob_draw: round4(probs.draw),
        prob_away: round4(1 - round4(probs.home) - round4(probs.draw)), // 3e branche deduite : somme = 1
        prob_over25: round4(over25.prob),
        prob_btts_yes: round4(btts.prob),
        predicted_score_home: result.predictedScoreHome,
        predicted_score_away: result.predictedScoreAway,
        confidence,
        explanation_text: fx.stakes_note ? `${result.explanation} Enjeu : ${fx.stakes_note}` : result.explanation,
        is_value_bet: isValue,
        value_bet_market: valueBetMarket,
        edge_value: edgeValue,
        market_prob_used: marketProbUsed,
        data_gaps: extraDataGaps.length > 0 ? extraDataGaps.join(" | ") : null,
        updated_at: new Date().toISOString(),
      });

      // Snapshot des cotes AU MOMENT DE L'EMISSION : fixtures.odds_* est reecrit par le cron de
      // synchro, donc sans cette ligne le CLV (et le bien-fonde d'un « value bet ») est
      // incalculable des le lendemain. Table creee par la migration 0006.
      oddsByFixture.set(fx.id as string, {
        odds_home: fx.odds_home ?? null,
        odds_draw: fx.odds_draw ?? null,
        odds_away: fx.odds_away ?? null,
        devig_home: devig ? round4(devig.home) : null,
        devig_draw: devig ? round4(devig.draw) : null,
        devig_away: devig ? round4(devig.away) : null,
        overround: devig ? round4(devig.overround) : null,
        odds_over25: fx.odds_over25 ?? null,
        odds_btts_yes: fx.odds_btts_yes ?? null,
        provider: "fixtures_row",
        captured_at: new Date().toISOString(),
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
    const { data: upserted, error: upsertError } = await supabase
      .from("predictions")
      .upsert(batch, { onConflict: "fixture_id,model_version" })
      .select("id, fixture_id");
    if (!upsertError && upserted) {
      const oddsRows = upserted
        .map((row: { id: string; fixture_id: string }) => ({
          prediction_id: row.id,
          ...(oddsByFixture.get(row.fixture_id) ?? {}),
        }))
        .filter((o: Record<string, unknown>) => o.prediction_id);
      if (oddsRows.length > 0) {
        const { error: oddsError } = await supabase
          .from("prediction_odds")
          .upsert(oddsRows, { onConflict: "prediction_id" });
        if (oddsError) errors.push(`Snapshot cotes: ${oddsError.message}`);
      }
    }
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
