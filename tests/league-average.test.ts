import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLeagueAvgGoalsPerTeam,
  sanitizeLeagueAvg,
  DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM,
  MIN_MATCHES_FOR_LEAGUE_AVG,
} from "../lib/prediction/league-average";

function matches(n: number, goalsPerMatch: number) {
  // Répartition simple : chaque match totalise goalsPerMatch buts.
  const half = goalsPerMatch / 2;
  return Array.from({ length: n }, () => ({ home_score: half, away_score: half }));
}

test("ancien 2,50 stocké en base est remplacé par la valeur de repli", () => {
  assert.equal(sanitizeLeagueAvg(2.5), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
  assert.equal(sanitizeLeagueAvg("2.50"), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
});

test("valeur plausible stockée est conservée, valeur absente ou non numérique donne la repli", () => {
  assert.equal(sanitizeLeagueAvg(1.42), 1.42);
  assert.equal(sanitizeLeagueAvg(null), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
  assert.equal(sanitizeLeagueAvg(undefined), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
  assert.equal(sanitizeLeagueAvg("abc"), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
});

test("petit échantillon : repli, pas de moyenne bruitée", () => {
  const few = matches(MIN_MATCHES_FOR_LEAGUE_AVG - 1, 3);
  assert.equal(computeLeagueAvgGoalsPerTeam(few), DEFAULT_LEAGUE_AVG_GOALS_PER_TEAM);
});

test("moyenne par équipe = total / (2 × matchs)", () => {
  // 40 matchs à 2,8 buts au total : moyenne par équipe = 2,8 / 2 = 1,40
  assert.equal(computeLeagueAvgGoalsPerTeam(matches(40, 2.8)), 1.4);
});

test("la moyenne calculée est bornée à des valeurs plausibles", () => {
  // Données aberrantes : 10 buts par match -> borne haute 2,00, pas 5,00
  assert.equal(computeLeagueAvgGoalsPerTeam(matches(40, 10)), 2);
  // Matchs sans but : borne basse 0,80
  assert.equal(computeLeagueAvgGoalsPerTeam(matches(40, 0)), 0.8);
});
