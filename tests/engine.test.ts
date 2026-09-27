import test from "node:test";
import assert from "node:assert/strict";
import {
  poissonPmf,
  formFactor,
  updateElo,
  impliedProbability,
  isValueBet,
  predictMatch,
} from "../lib/prediction/engine";
import type { TeamInput, MatchContext } from "../lib/prediction/types";

test("poissonPmf: somme des probabilités proche de 1 pour k=0..30", () => {
  const lambda = 1.4;
  let sum = 0;
  for (let k = 0; k <= 30; k++) sum += poissonPmf(lambda, k);
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

test("poissonPmf: P(X=0) = e^-lambda", () => {
  assert.ok(Math.abs(poissonPmf(2, 0) - Math.exp(-2)) < 1e-9);
});

test("formFactor: 7.5 points -> facteur neutre 1.0", () => {
  assert.equal(formFactor(7.5), 1);
});

test("formFactor: borné à 1.20 pour 15/15", () => {
  assert.equal(formFactor(15), 1.2);
});

test("formFactor: borné à 0.80 pour 0/15", () => {
  assert.equal(formFactor(0), 0.8);
});

test("updateElo: équipe favorite qui gagne prend peu de points", () => {
  const { eloHome, eloAway } = updateElo(2000, 1500, 1);
  assert.ok(eloHome - 2000 < 5, "gain faible attendu pour un favori qui gagne");
  assert.ok(eloAway < 1500, "l'outsider perd des points");
});

test("updateElo: outsider qui gagne prend beaucoup de points", () => {
  const { eloHome, eloAway } = updateElo(2000, 1500, 0);
  assert.ok(eloAway - 1500 > 15, "gain fort attendu pour un outsider qui gagne");
  assert.ok(eloHome < 2000);
});

test("updateElo: match nul entre égaux ne change rien", () => {
  const { eloHome, eloAway } = updateElo(1800, 1800, 0.5);
  assert.ok(Math.abs(eloHome - 1800) < 1e-9);
  assert.ok(Math.abs(eloAway - 1800) < 1e-9);
});

test("impliedProbability: cote 2.00 -> 50%", () => {
  assert.equal(impliedProbability(2), 0.5);
});

test("impliedProbability: cote invalide -> 0", () => {
  assert.equal(impliedProbability(0), 0);
  assert.equal(impliedProbability(1), 0);
});

test("isValueBet: proba IA nettement supérieure à la cote -> true", () => {
  assert.equal(isValueBet(0.6, 2.2, 0.05), true); // implied ~45.5%
});

test("isValueBet: proba IA proche de la cote -> false", () => {
  assert.equal(isValueBet(0.5, 2.0, 0.05), false); // implied 50%
});

test("predictMatch: les probabilités 1X2 somment à 1", () => {
  const home: TeamInput = {
    id: "1",
    name: "ASKO Kara",
    elo: 1420,
    attackRating: 1.1,
    defenseRating: 0.95,
    formPoints5: 10,
  };
  const away: TeamInput = {
    id: "2",
    name: "AC Semassi",
    elo: 1400,
    attackRating: 1.0,
    defenseRating: 1.0,
    formPoints5: 6,
  };
  const ctx: MatchContext = { leagueAvgGoals: 2.5 };
  const result = predictMatch(home, away, ctx);
  const sum = result.homeWinProb + result.drawProb + result.awayWinProb;
  assert.ok(Math.abs(sum - 1) < 1e-3);
  assert.ok(result.confidence >= 35 && result.confidence <= 97);
  assert.ok(result.explanation.length > 20);
});

test("predictMatch: une équipe largement supérieure est favorite", () => {
  const home: TeamInput = {
    id: "1",
    name: "Manchester City",
    elo: 2040,
    attackRating: 1.6,
    defenseRating: 0.6,
    formPoints5: 13,
  };
  const away: TeamInput = {
    id: "2",
    name: "Petit Club",
    elo: 1300,
    attackRating: 0.6,
    defenseRating: 1.6,
    formPoints5: 4,
  };
  const ctx: MatchContext = { leagueAvgGoals: 2.5 };
  const result = predictMatch(home, away, ctx);
  assert.ok(result.homeWinProb > 0.7, `homeWinProb=${result.homeWinProb}`);
});
