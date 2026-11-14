import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENFOOTBALL_LEAGUES,
  kickoffIso,
  openfootballSeasonUrl,
  parseOpenfootball,
  seasonFor,
  seasonsToSync,
  toSyncItem,
} from "../lib/data/openfootball";

// Extrait réel de openfootball/football.json, 2024-25/en.1.json (3 premiers matchs)
const REAL_SNIPPET = {
  name: "English Premier League 2024/25",
  matches: [
    { round: "Matchday 1", date: "2024-08-16", time: "20:00", team1: "Manchester United FC", team2: "Fulham FC",
      score: { ht: [0, 0], ft: [1, 0] } },
    { round: "Matchday 1", date: "2024-08-17", time: "12:30", team1: "Ipswich Town FC", team2: "Liverpool FC",
      score: { ht: [0, 0], ft: [0, 2] } },
    { round: "Matchday 1", date: "2024-08-17", time: "15:00", team1: "Arsenal FC", team2: "Wolverhampton Wanderers FC",
      score: { ht: [1, 0], ft: [2, 0] } },
  ],
};
const META = { leagueCode: "en.1", season: "2024-25" };

test("saison : juillet à juin", () => {
  assert.equal(seasonFor(new Date("2026-10-09T00:00:00Z")), "2026-27");
  assert.equal(seasonFor(new Date("2026-06-30T23:00:00Z")), "2025-26");
  assert.equal(seasonFor(new Date("2026-07-01T00:00:00Z")), "2026-27");
  assert.deepEqual(seasonsToSync(new Date("2026-10-09T00:00:00Z")), ["2025-26", "2026-27"]);
  assert.deepEqual(seasonsToSync(new Date("2027-01-15T00:00:00Z")), ["2025-26", "2026-27"]);
});

test("URL openfootball : saison et code ligue", () => {
  assert.equal(
    openfootballSeasonUrl("2024-25", "en.1"),
    "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/en.1.json"
  );
  assert.throws(() => openfootballSeasonUrl("2024", "en.1"));
  assert.throws(() => openfootballSeasonUrl("2024-25", "../x"));
});

test("toutes les ligues suivies ont un code au bon format", () => {
  for (const l of OPENFOOTBALL_LEAGUES) assert.match(l.code, /^[a-z]{2,3}\.\d+$/);
});

test("parse : extrait les scores du fichier réel", () => {
  const m = parseOpenfootball(REAL_SNIPPET, META);
  assert.equal(m.length, 3);
  assert.deepEqual(m[0], {
    leagueCode: "en.1",
    season: "2024-25",
    date: "2024-08-16",
    time: "20:00",
    homeTeam: "Manchester United FC",
    awayTeam: "Fulham FC",
    homeGoals: 1,
    awayGoals: 0,
  });
});

test("parse : match à venir sans score gardé avec buts null", () => {
  const data = { matches: [{ date: "2026-11-01", team1: "A", team2: "B" }] };
  const m = parseOpenfootball(data, META);
  assert.equal(m.length, 1);
  assert.equal(m[0].homeGoals, null);
  assert.equal(m[0].awayGoals, null);
  assert.equal(m[0].time, null);
});

test("parse : ignore les entrées mal formées", () => {
  const data = {
    matches: [
      { date: "2025-05-01", team1: "A", team2: "B", score: { ft: [null, null] } },
      { date: "2025-05-01", team1: "A", team2: "B", score: { ft: [-1, 0] } },
      { date: "2025-05-01", team1: "A", team2: "B", score: { ft: [1.5, 0] } },
      { date: "2025/05/01", team1: "A", team2: "B", score: { ft: [1, 0] } },
      { team1: "A", team2: "B", score: { ft: [1, 0] } },
      { date: "2025-05-02", team1: "", team2: "D", score: { ft: [1, 0] } },
      { date: "2025-05-03", team1: "C", team2: "D", score: { ft: [2, 2] } },
    ],
  };
  const m = parseOpenfootball(data, META);
  assert.equal(m.length, 1);
  assert.equal(m[0].homeTeam, "C");
  assert.deepEqual(parseOpenfootball(null, META), []);
  assert.deepEqual(parseOpenfootball({}, META), []);
});

test("date de coup d'envoi : heure connue ou midi UTC par défaut", () => {
  assert.equal(kickoffIso({ date: "2026-08-16", time: "20:00" }), "2026-08-16T20:00:00Z");
  assert.equal(kickoffIso({ date: "2026-08-16", time: null }), "2026-08-16T12:00:00Z");
});

test("conversion : match joué = FT, match à venir = NS, identifiants stables", () => {
  const [played] = parseOpenfootball(REAL_SNIPPET, META);
  const item = toSyncItem(played);
  assert.equal(item.fixture.status.short, "FT");
  assert.equal(item.goals.home, 1);
  assert.equal(item.league.name, "Premier League");
  assert.equal(item.league.id, "of:en.1");
  assert.equal(item.teams.home.id, "of:en.1:Manchester United FC");
  assert.equal(item.fixture.id, "of:2024-25:en.1:2024-08-16:Manchester United FC:Fulham FC");

  const [future] = parseOpenfootball({ matches: [{ date: "2026-11-01", team1: "A", team2: "B" }] }, META);
  assert.equal(toSyncItem(future).fixture.status.short, "NS");
  assert.equal(toSyncItem(future).goals.home, null);
});
