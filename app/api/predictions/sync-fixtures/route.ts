import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdminOrCron } from "@/lib/api-auth";
import { selectFixturesToSync } from "@/lib/fixture-selection";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

/** Bookmaker API-Football à privilégier pour les cotes — cohérent avec ce que l'utilisateur voit sur 1xBet. */
const PREFERRED_BOOKMAKER = "1xBet";

/**
 * Compétitions à afficher en priorité (plus petit = en premier). Tout le reste (littéralement
 * toutes les autres ligues renvoyées par API-Football, ~1200 au total) reçoit la priorité par
 * défaut de la base (100) — elles restent synchronisées et visibles, simplement pas mises en
 * avant en premier si un tri par priorité est utilisé quelque part dans l'UI.
 */
const PRIORITY_LEAGUES: Record<string, number> = {
  "championnat national": 1, // Ligue 1 Togo
  "caf champions league": 2,
  "africa cup of nations": 3,
  "uefa champions league": 10,
  "premier league": 11,
  "la liga": 12,
  "serie a": 13,
  bundesliga: 14,
  "ligue 1": 15,
};

/** Évite de remplir la base avec des compétitions académie/réserve, peu voire jamais proposées
 * par les bookmakers grand public (1xBet, Betwinner...). Tout le reste (y compris les très
 * petites ligues nationales) est conservé : c'est justement l'objectif de cette synchronisation
 * "toutes ligues" plutôt que la précédente liste de ~11 championnats codés en dur. */
const EXCLUDED_LEAGUE_PATTERN = /\b(u1[5-9]|u2[0-3]|youth|reserve|réserve)\b/i;

/**
 * Nombre maximum de matchs NON terminés conservés par exécution (les plus proches de maintenant
 * d'abord), pour garder la synchronisation et l'affichage raisonnables même les jours chargés
 * (plusieurs milliers de matchs dans le monde un même week-end). Augmente
 * API_FOOTBALL_MAX_FIXTURES si tu veux garder davantage de matchs à venir.
 */
const MAX_FIXTURES = Number(process.env.API_FOOTBALL_MAX_FIXTURES ?? 500);

/**
 * Nombre maximum de matchs TERMINÉS conservés par exécution (les plus récents d'abord), pour
 * alimenter update-ratings. Quota distinct de MAX_FIXTURES : les matchs à venir ne peuvent plus
 * évincer les résultats, et inversement. Par défaut 1000, soit la limite de traitement d'un
 * passage de update-ratings.
 */
const MAX_FINISHED_FIXTURES = Number(process.env.API_FOOTBALL_MAX_FINISHED ?? 1000);

/**
 * Nombre maximum de matchs enrichis en détail (1 appel /odds + 1 appel /fixtures/headtohead +
 * 1 appel /injuries PAR MATCH, donc 3 appels), parmi les plus proches. Le plan API-Football
 * gratuit ne donne que 100 requêtes/jour tous endpoints confondus — avec 3 appels "fixtures"
 * (hier/aujourd'hui/demain) + jusqu'à ~15 appels /standings (1 par ligue concernée) + 3×N pour
 * l'enrichissement, on reste dans ce budget avec N=20 par défaut. Augmente
 * API_FOOTBALL_MAX_ENRICHED si ton plan le permet (plus de requêtes/jour).
 */
const MAX_ENRICHED_FIXTURES = Number(process.env.API_FOOTBALL_MAX_ENRICHED ?? 20);

type RawFixture = any;

/**
 * Cron quotidien (~06h00 Africa/Lome) : récupère TOUS les matchs programmés sur les prochaines
 * 48h (plus hier, pour capter les scores finaux des matchs qui viennent de se terminer),
 * toutes compétitions confondues (~1200 ligues/coupes couvertes par API-Football — le même
 * univers de matchs que l'on retrouve chez les bookmakers africains comme 1xBet, Betwinner,
 * SportyBet...), au lieu de se limiter à une liste figée de championnats.
 *
 * Pour les matchs les plus proches (plafonnés par MAX_ENRICHED_FIXTURES), on va aussi chercher :
 * cotes réelles 1X2 + Over/Under 2.5 + BTTS (1xBet en priorité), confrontations directes (H2H,
 * pondérées faiblement dans le modèle), blessures/absences connues, et l'enjeu du match via le
 * classement de sa ligue. Tout ça est écrit en base PAR LOTS (pas une requête par match) pour
 * rester rapide même avec plusieurs centaines de matchs.
 *
 * Nécessite la env var API_FOOTBALL_KEY. Si absente, renvoie une erreur explicite plutôt
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
  const errors: string[] = [];

  // 1. Récupère TOUS les matchs (toutes ligues) pour hier, aujourd'hui et demain — hier sert
  //    uniquement à capter les scores finaux des matchs qui se sont terminés tard (pour le
  //    pipeline de mise à jour des ratings, voir update-ratings). 3 requêtes API au total.
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const dates = [yesterday, today, tomorrow].map((d) => d.toISOString().slice(0, 10));

  const allRaw: RawFixture[] = [];
  for (const date of dates) {
    try {
      const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?date=${date}`, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 0 },
      });
      const json = await res.json();
      if (json.errors && Object.keys(json.errors).length > 0) {
        errors.push(`Fixtures ${date} : ${JSON.stringify(json.errors)}`);
        continue;
      }
      allRaw.push(...(json.response ?? []));
    } catch (e: any) {
      errors.push(`Fixtures ${date} : ${e.message}`);
    }
  }

  // 2. Filtre le bruit académie/réserve, puis sélectionne avec deux quotas indépendants :
  //    matchs non terminés les plus proches (MAX_FIXTURES) et matchs terminés les plus récents
  //    (MAX_FINISHED_FIXTURES). Voir lib/fixture-selection.ts pour le bug corrigé ici.
  const candidates = allRaw.filter((item) => !EXCLUDED_LEAGUE_PATTERN.test(item.league?.name ?? ""));
  const selection = selectFixturesToSync(candidates, Date.now(), {
    maxOpen: MAX_FIXTURES,
    maxFinished: MAX_FINISHED_FIXTURES,
  });
  const filtered: RawFixture[] = selection.selected;

  let fixturesUpserted = 0;
  const fixtureIdByExternal = new Map<string, string>();
  const leagueIdByExternal = new Map<string, string>();

  try {
    // 3. Upsert PAR LOT des ligues distinctes (une seule requête base, peu importe le nombre de matchs).
    const leagueByExternal = new Map<string, any>();
    for (const item of filtered) {
      if (item.league?.id) leagueByExternal.set(String(item.league.id), item.league);
    }
    const leaguesPayload = Array.from(leagueByExternal.entries()).map(([externalId, league]) => ({
      external_api_id: externalId,
      name: league.name,
      country: league.country ?? "Inconnu",
      logo_url: league.logo ?? null,
      priority_order: PRIORITY_LEAGUES[league.name?.toLowerCase()] ?? 100,
      active: true,
    }));
    if (leaguesPayload.length > 0) {
      const { data: leagueRows, error } = await supabase
        .from("leagues")
        .upsert(leaguesPayload, { onConflict: "external_api_id" })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert ligues : ${error.message}`);
      for (const row of leagueRows ?? []) leagueIdByExternal.set(row.external_api_id, row.id);
    }

    // 4. Upsert PAR LOT des équipes distinctes (domicile + extérieur de tous les matchs retenus).
    const teamByExternal = new Map<string, { team: any; leagueExternalId: string }>();
    for (const item of filtered) {
      if (item.teams?.home?.id)
        teamByExternal.set(String(item.teams.home.id), { team: item.teams.home, leagueExternalId: String(item.league.id) });
      if (item.teams?.away?.id)
        teamByExternal.set(String(item.teams.away.id), { team: item.teams.away, leagueExternalId: String(item.league.id) });
    }
    const teamsPayload = Array.from(teamByExternal.entries()).map(([externalId, { team, leagueExternalId }]) => ({
      external_api_id: externalId,
      name: team.name,
      logo_url: team.logo ?? null,
      league_id: leagueIdByExternal.get(leagueExternalId) ?? null,
    }));
    const teamIdByExternal = new Map<string, string>();
    if (teamsPayload.length > 0) {
      const { data: teamRows, error } = await supabase
        .from("teams")
        .upsert(teamsPayload, { onConflict: "external_api_id", ignoreDuplicates: false })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert équipes : ${error.message}`);
      for (const row of teamRows ?? []) teamIdByExternal.set(row.external_api_id, row.id);
    }

    // 5. Upsert PAR LOT des matchs eux-mêmes.
    const fixturesPayload = filtered
      .map((item) => {
        const leagueId = leagueIdByExternal.get(String(item.league.id));
        const homeTeamId = teamIdByExternal.get(String(item.teams.home.id));
        const awayTeamId = teamIdByExternal.get(String(item.teams.away.id));
        if (!leagueId || !homeTeamId || !awayTeamId) return null;
        return {
          external_api_id: String(item.fixture.id),
          league_id: leagueId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff_at: item.fixture.date,
          status: mapStatus(item.fixture.status?.short),
          home_score: item.goals?.home ?? null,
          away_score: item.goals?.away ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (fixturesPayload.length > 0) {
      const { data: fixtureRows, error } = await supabase
        .from("fixtures")
        .upsert(fixturesPayload, { onConflict: "external_api_id" })
        .select("id, external_api_id");
      if (error) throw new Error(`Upsert matchs : ${error.message}`);
      for (const row of fixtureRows ?? []) fixtureIdByExternal.set(row.external_api_id, row.id);
      fixturesUpserted = fixtureRows?.length ?? 0;
    }
  } catch (e: any) {
    errors.push(e.message ?? String(e));
  }

  // 6. Enrichissement détaillé (cotes 1X2 + O/U2.5 + BTTS, H2H, blessures, enjeu) pour les
  //    matchs les plus proches uniquement (pas encore joués), plafonné par MAX_ENRICHED_FIXTURES.
  const now = Date.now();
  const toEnrich = filtered
    .filter((item) => new Date(item.fixture.date).getTime() >= now)
    .filter((item) => fixtureIdByExternal.has(String(item.fixture.id)))
    .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
    .slice(0, MAX_ENRICHED_FIXTURES);

  let oddsUpserted = 0;
  let h2hUpserted = 0;
  let injuriesUpserted = 0;
  const standingsCache = new Map<string, Map<number, number>>(); // leagueExternalId -> teamId -> position

  for (const item of toEnrich) {
    const fixtureId = fixtureIdByExternal.get(String(item.fixture.id))!;
    const updatePatch: Record<string, unknown> = {};

    // --- Cotes réelles (1xBet en priorité), 3 marchés extraits de la même réponse ---
    try {
      const oddsRes = await fetch(`${API_FOOTBALL_BASE}/odds?fixture=${item.fixture.id}`, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 0 },
      });
      const oddsJson = await oddsRes.json();
      const entry = (oddsJson.response ?? [])[0];
      if (entry) {
        const matchWinner = extractOddsMarket(entry.bookmakers, "Match Winner");
        if (matchWinner) {
          const home = matchWinner.find((v) => v.value === "Home")?.odd;
          const draw = matchWinner.find((v) => v.value === "Draw")?.odd;
          const away = matchWinner.find((v) => v.value === "Away")?.odd;
          if (home && draw && away) {
            updatePatch.odds_home = Number(home);
            updatePatch.odds_draw = Number(draw);
            updatePatch.odds_away = Number(away);
            oddsUpserted++;
          }
        }
        const overUnder = extractOddsMarket(entry.bookmakers, "Goals Over/Under");
        const over25 = overUnder?.find((v) => v.value === "Over 2.5")?.odd;
        if (over25) updatePatch.odds_over25 = Number(over25);
        const btts = extractOddsMarket(entry.bookmakers, "Both Teams Score");
        const bttsYes = btts?.find((v) => v.value === "Yes")?.odd;
        if (bttsYes) updatePatch.odds_btts_yes = Number(bttsYes);
      }
    } catch (e: any) {
      errors.push(`Cotes match ${item.fixture.id} : ${e.message}`);
    }

    // --- Confrontations directes (H2H), pondérées faiblement dans le modèle ---
    try {
      const h2hRes = await fetch(
        `${API_FOOTBALL_BASE}/fixtures/headtohead?h2h=${item.teams.home.id}-${item.teams.away.id}&last=5`,
        { headers: { "x-apisports-key": apiKey }, next: { revalidate: 0 } }
      );
      const h2hJson = await h2hRes.json();
      const meetings: any[] = (h2hJson.response ?? []).filter((m: any) => m.fixture?.status?.short === "FT");
      if (meetings.length >= 3) {
        const homeWins = meetings.filter((m: any) => {
          // Victoire de l'équipe qui jouait alors à domicile ACTUELLEMENT (item.teams.home.id).
          const homeWasHome = String(m.teams.home.id) === String(item.teams.home.id);
          const homeGoals = homeWasHome ? m.goals.home : m.goals.away;
          const awayGoals = homeWasHome ? m.goals.away : m.goals.home;
          return homeGoals > awayGoals;
        }).length;
        updatePatch.h2h_home_win_rate = Number((homeWins / meetings.length).toFixed(3));
        updatePatch.h2h_sample_size = meetings.length;
        h2hUpserted++;
      }
    } catch (e: any) {
      errors.push(`H2H match ${item.fixture.id} : ${e.message}`);
    }

    // --- Blessures/absences connues, traduites en impact (0 à 0.15) sur le potentiel offensif ---
    try {
      const injRes = await fetch(`${API_FOOTBALL_BASE}/injuries?fixture=${item.fixture.id}`, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 0 },
      });
      const injJson = await injRes.json();
      const list: any[] = injJson.response ?? [];
      const homeOut = list.filter((i: any) => String(i.team?.id) === String(item.teams.home.id)).length;
      const awayOut = list.filter((i: any) => String(i.team?.id) === String(item.teams.away.id)).length;
      if (list.length > 0) {
        // La présence de données (même "0 blessé") est une info réelle, pas une invention :
        // l'endpoint /injuries a répondu pour ce match, donc homeOut/awayOut reflètent l'état connu.
        await supabase
          .from("teams")
          .update({ injuries_impact: Math.min(0.15, homeOut * 0.03) })
          .eq("external_api_id", String(item.teams.home.id));
        await supabase
          .from("teams")
          .update({ injuries_impact: Math.min(0.15, awayOut * 0.03) })
          .eq("external_api_id", String(item.teams.away.id));
        injuriesUpserted++;
      }
    } catch (e: any) {
      errors.push(`Blessures match ${item.fixture.id} : ${e.message}`);
    }

    // --- Enjeu du match (course au titre / maintien / dead rubber), via le classement de la ligue ---
    try {
      const leagueExternalId = String(item.league.id);
      if (!standingsCache.has(leagueExternalId)) {
        const season = item.league.season ?? new Date().getFullYear();
        const standRes = await fetch(`${API_FOOTBALL_BASE}/standings?league=${leagueExternalId}&season=${season}`, {
          headers: { "x-apisports-key": apiKey },
          next: { revalidate: 0 },
        });
        const standJson = await standRes.json();
        const table: any[] = standJson.response?.[0]?.league?.standings?.[0] ?? [];
        const positions = new Map<number, number>();
        for (const row of table) positions.set(row.team.id, row.rank);
        standingsCache.set(leagueExternalId, positions);
      }
      const positions = standingsCache.get(leagueExternalId);
      const totalTeams = positions?.size ?? 0;
      const homePos = positions?.get(item.teams.home.id);
      const awayPos = positions?.get(item.teams.away.id);
      const note = buildStakesNote(homePos, awayPos, totalTeams, item.teams.home.name, item.teams.away.name);
      if (note) updatePatch.stakes_note = note;
    } catch (e: any) {
      errors.push(`Classement ligue ${item.league.id} : ${e.message}`);
    }

    if (Object.keys(updatePatch).length > 0) {
      const { error: patchError } = await supabase.from("fixtures").update(updatePatch).eq("id", fixtureId);
      if (patchError) errors.push(`Mise à jour enrichissement ${item.fixture.id} : ${patchError.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    fixturesFoundAllLeagues: allRaw.length,
    fixturesConsidered: filtered.length,
    selection: {
      openAvailable: selection.openAvailable,
      openKept: selection.openKept,
      finishedAvailable: selection.finishedAvailable,
      finishedKept: selection.finishedKept,
    },
    fixturesUpserted,
    enrichedFixtures: toEnrich.length,
    oddsUpserted,
    h2hUpserted,
    injuriesUpserted,
    errors,
  });
}

/** Extrait les valeurs d'un marché de pari donné (ex: "Match Winner", "Goals Over/Under") du bookmaker préféré (1xBet), sinon du premier disponible. */
function extractOddsMarket(bookmakers: any[] = [], marketName: string): { value: string; odd: string }[] | null {
  const preferred = bookmakers.find((b) => b.name?.toLowerCase() === PREFERRED_BOOKMAKER.toLowerCase());
  const source = preferred ?? bookmakers[0];
  if (!source) return null;
  const bet = source.bets?.find((b: any) => b.name === marketName);
  return bet?.values ?? null;
}

/** Construit une note courte et honnête sur l'enjeu du match à partir des positions au classement (null si position inconnue ou classement non disponible). */
function buildStakesNote(
  homePos: number | undefined,
  awayPos: number | undefined,
  totalTeams: number,
  homeName: string,
  awayName: string
): string | null {
  if (!homePos || !awayPos || !totalTeams) return null;
  const relegationZone = totalTeams - 3;
  const homeTitleRace = homePos <= 3;
  const awayTitleRace = awayPos <= 3;
  const homeRelegation = homePos >= relegationZone;
  const awayRelegation = awayPos >= relegationZone;

  if (homeTitleRace && awayTitleRace) return `Choc au sommet : ${homeName} (${homePos}e) reçoit ${awayName} (${awayPos}e).`;
  if (homeRelegation && awayRelegation) return `Match crucial pour le maintien entre deux équipes menacées.`;
  if (homeTitleRace || awayTitleRace) return `Enjeu fort pour la course au titre pour l'une des deux équipes.`;
  if (homeRelegation || awayRelegation) return `Enjeu fort pour le maintien pour l'une des deux équipes.`;
  return null;
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
