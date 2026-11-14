import test from "node:test";
import assert from "node:assert/strict";
import { headToHead, leaguePositions, stakesNote, type KnownResult } from "../lib/data/match-context";

function r(home: string, away: string, hg: number, ag: number, date: string, season = "2025-26"): KnownResult {
  return { leagueCode: "en.1", season, date: `${date}T15:00:00Z`, home, away, homeGoals: hg, awayGoals: ag };
}

test("H2H : orientation par rapport au match à venir", () => {
  const results = [
    r("Arsenal", "Chelsea", 2, 0, "2025-01-01"), // Arsenal à domicile, gagne
    r("Chelsea", "Arsenal", 1, 0, "2025-06-01"), // Arsenal à l'extérieur, perd
    r("Arsenal", "Chelsea", 3, 1, "2025-10-01"), // Arsenal à domicile, gagne
  ];
  // Match à venir : Arsenal reçoit Chelsea. 2 victoires à domicile sur 3 -> 0,667
  const h = headToHead(results, "en.1", "Arsenal", "Chelsea", "2026-03-01T15:00:00Z");
  assert.deepEqual(h, { homeWinRate: 0.667, sampleSize: 3 });
});

test("H2H : moins de 3 confrontations ou matchs futurs ignorés", () => {
  const results = [
    r("Arsenal", "Chelsea", 2, 0, "2025-01-01"),
    r("Arsenal", "Chelsea", 2, 0, "2027-01-01"), // après le match : ignoré
  ];
  assert.equal(headToHead(results, "en.1", "Arsenal", "Chelsea", "2026-03-01T15:00:00Z"), null);
});

test("classement : points puis différence de buts", () => {
  const results = [
    r("A", "B", 1, 0, "2026-01-01"), // A 3 pts
    r("B", "C", 2, 2, "2026-01-02"), // B 1, C 1
    r("C", "A", 0, 1, "2026-01-03"), // A 6 pts, C 1
    r("B", "A", 3, 0, "2026-01-04"), // B 4 pts (victoire 3-0 sur A)
  ];
  const { positions, total } = leaguePositions(results);
  assert.equal(total, 3);
  assert.equal(positions.get("A"), 1);
  assert.equal(positions.get("B"), 2);
  assert.equal(positions.get("C"), 3);
});

test("enjeu : rien si saison trop jeune, sinon course au titre", () => {
  const young = leaguePositions([r("A", "B", 1, 0, "2026-01-01")]);
  assert.equal(stakesNote(young.positions, young.total, young.minPlayed, "A", "B"), null);

  const results: KnownResult[] = [];
  const teams = ["A", "B", "C", "D", "E", "F"];
  // Chaque équipe joue 5 matchs : on fabrique un calendrier simple.
  let day = 1;
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) {
      results.push(r(teams[i], teams[j], i === 0 ? 2 : 0, i === 0 ? 0 : 1, `2026-01-${String(day++).padStart(2, "0")}`));
    }
  const table = leaguePositions(results);
  assert.ok(table.minPlayed >= 5);
  const note = stakesNote(table.positions, table.total, table.minPlayed, "A", "B");
  assert.ok(note && note.includes("course au titre"), `note inattendue : ${note}`);
});
