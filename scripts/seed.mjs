/**
 * Importe les ligues et équipes de départ dans Supabase.
 * Usage : node scripts/seed.mjs   (nécessite .env.local rempli, chargé via --env-file)
 */
import { createClient } from "@supabase/supabase-js";
import { SEED_LEAGUES, SEED_TEAMS } from "./seed-data.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Variables manquantes. Lance avec : node --env-file=.env.local scripts/seed.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log("→ Import des ligues...");
  const leagueIdByCode = {};

  for (const l of SEED_LEAGUES) {
    const { data, error } = await supabase
      .from("leagues")
      .upsert(
        {
          external_api_id: l.code,
          name: l.name,
          country: l.country,
          priority_order: l.priority_order,
          avg_goals_per_match: l.avg_goals_per_match,
        },
        { onConflict: "external_api_id" }
      )
      .select()
      .single();

    if (error) throw error;
    leagueIdByCode[l.code] = data.id;
    console.log(`  ✓ ${l.name}`);
  }

  console.log("→ Import des équipes...");
  for (const t of SEED_TEAMS) {
    const { error } = await supabase.from("teams").upsert(
      {
        external_api_id: `seed-${t.name}`,
        league_id: leagueIdByCode[t.league],
        name: t.name,
        elo: t.elo,
        attack_rating: t.attack,
        defense_rating: t.defense,
        form_points_5: t.form,
      },
      { onConflict: "external_api_id" }
    );
    if (error) throw error;
    console.log(`  ✓ ${t.name}`);
  }

  console.log("✅ Seed terminé.");
}

main().catch((e) => {
  console.error("❌ Erreur de seed :", e.message);
  process.exit(1);
});
