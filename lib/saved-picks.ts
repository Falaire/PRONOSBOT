import { createClient } from "@/lib/supabase/server";

export type SavedPick = {
  id: string;
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  chosenMarket: string | null;
  bookmakerId: string | null;
  note: string | null;
  status: "pending" | "won" | "lost" | "void";
  predictionLabel: string | null;
  confidence: number | null;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  createdAt: string;
};

/**
 * Liste des ids de matchs déjà enregistrés par l'utilisateur dans son carnet — utilisé pour
 * afficher l'icône "déjà enregistré" sur /dashboard sans recharger toute la fiche à chaque match.
 * Renvoie un tableau vide si non connecté, si Supabase n'est pas configuré, ou si la migration
 * du carnet n'a pas encore été appliquée (tolérant, comme le reste de lib/fixtures.ts).
 */
export async function getSavedFixtureIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("saved_picks").select("fixture_id").eq("user_id", userId);
    if (error || !data) return [];
    return data.map((row: { fixture_id: string }) => row.fixture_id);
  } catch {
    return [];
  }
}

/** Récupère l'enregistrement du carnet pour un match précis (pour pré-remplir le formulaire sur la page de détail). */
export async function getSavedPickForFixture(
  userId: string | null,
  fixtureId: string
): Promise<{ saved: boolean; chosenMarket: string | null; note: string | null }> {
  if (!userId) return { saved: false, chosenMarket: null, note: null };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("saved_picks")
      .select("chosen_market, note")
      .eq("user_id", userId)
      .eq("fixture_id", fixtureId)
      .maybeSingle();
    if (!data) return { saved: false, chosenMarket: null, note: null };
    return { saved: true, chosenMarket: data.chosen_market, note: data.note };
  } catch {
    return { saved: false, chosenMarket: null, note: null };
  }
}

/** Carnet complet de l'utilisateur, avec les infos du match et du pronostic pour affichage. */
export async function getSavedPicks(userId: string | null): Promise<SavedPick[]> {
  if (!userId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_picks")
      .select(
        `id, fixture_id, chosen_market, bookmaker_id, note, status, created_at,
         fixture:fixtures (
           kickoff_at, odds_home, odds_draw, odds_away,
           league:leagues ( name ),
           home_team:teams!fixtures_home_team_id_fkey ( name ),
           away_team:teams!fixtures_away_team_id_fkey ( name ),
           predictions ( confidence, prob_home, prob_draw, prob_away )
         )`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row: any): SavedPick => {
      const fixture = Array.isArray(row.fixture) ? row.fixture[0] : row.fixture;
      const league = Array.isArray(fixture?.league) ? fixture.league[0] : fixture?.league;
      const home = Array.isArray(fixture?.home_team) ? fixture.home_team[0] : fixture?.home_team;
      const away = Array.isArray(fixture?.away_team) ? fixture.away_team[0] : fixture?.away_team;
      const prediction = Array.isArray(fixture?.predictions) ? fixture.predictions[0] : fixture?.predictions;

      let predictionLabel: string | null = null;
      if (prediction) {
        const probHome = Number(prediction.prob_home ?? 0);
        const probDraw = Number(prediction.prob_draw ?? 0);
        const probAway = Number(prediction.prob_away ?? 0);
        predictionLabel =
          probHome >= probDraw && probHome >= probAway
            ? `Victoire ${home?.name ?? "domicile"}`
            : probAway >= probHome && probAway >= probDraw
              ? `Victoire ${away?.name ?? "extérieur"}`
              : "Match nul probable";
      }

      return {
        id: row.id,
        fixtureId: row.fixture_id,
        league: league?.name ?? "Football",
        home: home?.name ?? "Équipe A",
        away: away?.name ?? "Équipe B",
        kickoff: fixture?.kickoff_at ?? new Date().toISOString(),
        chosenMarket: row.chosen_market,
        bookmakerId: row.bookmaker_id,
        note: row.note,
        status: row.status,
        predictionLabel,
        confidence: prediction?.confidence ?? null,
        oddsHome: fixture?.odds_home !== undefined && fixture?.odds_home !== null ? Number(fixture.odds_home) : null,
        oddsDraw: fixture?.odds_draw !== undefined && fixture?.odds_draw !== null ? Number(fixture.odds_draw) : null,
        oddsAway: fixture?.odds_away !== undefined && fixture?.odds_away !== null ? Number(fixture.odds_away) : null,
        createdAt: row.created_at,
      };
    });
  } catch {
    return [];
  }
}
