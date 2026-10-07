import { createClient } from "@/lib/supabase/server";
import { DEMO_FIXTURES, type DemoFixture } from "@/lib/demo-data";
import { getFreeLimit } from "@/lib/subscription";

/**
 * Récupère les vrais matchs du jour (fixtures + pronostics générés par le moteur Elo/Poisson)
 * directement depuis Supabase, dans le même format que DEMO_FIXTURES pour que <MatchCard />
 * n'ait rien à changer. Si aucun match réel n'est encore disponible (pipeline pas encore
 * synchronisé, ou Supabase non configuré), on retombe sur les données de démonstration plutôt
 * que d'afficher une page vide.
 */
export async function getTodayFixtures(): Promise<DemoFixture[]> {
  try {
    const supabase = await createClient();

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

    const { data, error } = await supabase
      .from("fixtures")
      .select(
        `
        id,
        kickoff_at,
        odds_home,
        odds_draw,
        odds_away,
        league:leagues ( name, priority_order ),
        home_team:teams!fixtures_home_team_id_fkey ( name, logo_url ),
        away_team:teams!fixtures_away_team_id_fkey ( name, logo_url ),
        predictions!inner (
          confidence,
          prob_home,
          prob_draw,
          prob_away,
          prob_over25,
          prob_btts_yes,
          predicted_score_home,
          predicted_score_away,
          explanation_text,
          is_value_bet
        )
      `
      )
      .eq("status", "scheduled")
      .gte("kickoff_at", now.toISOString())
      .lte("kickoff_at", in48h.toISOString())
      .order("kickoff_at", { ascending: true })
      // Plafond large : la synchronisation couvre désormais toutes les compétitions
      // disponibles (voir app/api/predictions/sync-fixtures/route.ts), pas seulement une
      // poignée de championnats — la recherche (components/MatchSearch.tsx) permet de
      // retrouver un match précis dans ce volume plus large.
      .limit(300);

    if (error || !data || data.length === 0) {
      return DEMO_FIXTURES;
    }

    const freeLimit = getFreeLimit();

    const mapped: DemoFixture[] = data.map((row: any, index: number) => {
      const prediction = Array.isArray(row.predictions) ? row.predictions[0] : row.predictions;
      const league = Array.isArray(row.league) ? row.league[0] : row.league;
      const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
      const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;

      const probHome = Number(prediction?.prob_home ?? 0);
      const probDraw = Number(prediction?.prob_draw ?? 0);
      const probAway = Number(prediction?.prob_away ?? 0);

      const predictionLabel =
        probHome >= probDraw && probHome >= probAway
          ? `Victoire ${home?.name ?? "domicile"}`
          : probAway >= probHome && probAway >= probDraw
            ? `Victoire ${away?.name ?? "extérieur"}`
            : "Match nul probable";

      return {
        id: row.id,
        league: league?.name ?? "Football",
        home: home?.name ?? "Équipe A",
        away: away?.name ?? "Équipe B",
        homeLogo: home?.logo_url ?? undefined,
        awayLogo: away?.logo_url ?? undefined,
        kickoff: row.kickoff_at,
        confidence: Number(prediction?.confidence ?? 50),
        prediction: predictionLabel,
        probHome,
        probDraw,
        probAway,
        probOver25: Number(prediction?.prob_over25 ?? 0),
        probBtts: Number(prediction?.prob_btts_yes ?? 0),
        scoreHome: Number(prediction?.predicted_score_home ?? 1),
        scoreAway: Number(prediction?.predicted_score_away ?? 1),
        explanation: prediction?.explanation_text ?? "Analyse en cours.",
        isValueBet: !!prediction?.is_value_bet,
        // Cotes réelles issues des bookmakers (1xBet en priorité) quand disponibles.
        odds:
          row.odds_home && row.odds_draw && row.odds_away
            ? { home: Number(row.odds_home), draw: Number(row.odds_draw), away: Number(row.odds_away) }
            : undefined,
        free: index < freeLimit,
      };
    });

    return mapped;
  } catch {
    return DEMO_FIXTURES;
  }
}

/** Retrouve un match précis (réel ou démo) par id, dans la même liste que celle affichée sur /dashboard. */
export async function getFixtureById(id: string): Promise<DemoFixture | undefined> {
  const fixtures = await getTodayFixtures();
  return fixtures.find((f) => f.id === id);
}
