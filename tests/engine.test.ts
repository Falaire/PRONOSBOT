import test from "node:test";
import assert from "node:assert/strict";
import {
  poissonPmf,
  formFactor,
  fatigueFactor,
  updateElo,
  impliedProbability,
  devigProbabilities1x2,
  isValueBet,
  dixonColesTau,
  scoreMatrix,
  predictMatch,
} from "../lib/prediction/engine";
import { applyMatchResult, updateFormPoints } from "../lib/prediction/ratings";
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

test("fatigueFactor: 2 matchs ou moins en 10 jours -> neutre", () => {
  assert.equal(fatigueFactor(0), 1);
  assert.equal(fatigueFactor(2), 1);
});

test("fatigueFactor: enchaînement réduit le facteur, borné à 0.85", () => {
  assert.ok(fatigueFactor(4) < 1);
  assert.equal(fatigueFactor(10), 0.85);
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

test("devigProbabilities1x2: les 3 probabilités dé-margées somment exactement à 1", () => {
  const result = devigProbabilities1x2(2.0, 3.4, 3.8);
  assert.ok(result !== null);
  const sum = result!.home + result!.draw + result!.away;
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(result!.overround > 1, "la marge brute du bookmaker doit être > 1 (overround)");
});

test("devigProbabilities1x2: cote manquante/invalide -> null", () => {
  assert.equal(devigProbabilities1x2(0, 3.4, 3.8), null);
  assert.equal(devigProbabilities1x2(1, 3.4, 3.8), null);
});

test("isValueBet: proba modèle nettement supérieure à la proba marché -> true", () => {
  assert.equal(isValueBet(0.6, 0.455, 0.05), true);
});

test("isValueBet: proba modèle proche de la proba marché -> false", () => {
  assert.equal(isValueBet(0.5, 0.5, 0.05), false);
});

test("dixonColesTau: rho=0 neutralise la correction (tau=1 partout)", () => {
  assert.equal(dixonColesTau(0, 0, 1.4, 1.1, 0), 1);
  assert.equal(dixonColesTau(1, 0, 1.4, 1.1, 0), 1);
  assert.equal(dixonColesTau(0, 1, 1.4, 1.1, 0), 1);
  assert.equal(dixonColesTau(1, 1, 1.4, 1.1, 0), 1);
});

test("dixonColesTau: hors scores faibles -> toujours 1", () => {
  assert.equal(dixonColesTau(2, 3, 1.4, 1.1, -0.13), 1);
});

test("scoreMatrix: somme totale reste ~1 après correction Dixon-Coles et renormalisation", () => {
  const matrix = scoreMatrix(1.6, 1.2, -0.13);
  let total = 0;
  for (const row of matrix) for (const p of row) total += p;
  assert.ok(Math.abs(total - 1) < 1e-6);
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

test("predictMatch: signale les données manquantes (H2H, blessures, calendrier) sans rien inventer", () => {
  const home: TeamInput = { id: "1", name: "A", elo: 1500, attackRating: 1, defenseRating: 1, formPoints5: 7 };
  const away: TeamInput = { id: "2", name: "B", elo: 1500, attackRating: 1, defenseRating: 1, formPoints5: 7 };
  const result = predictMatch(home, away, { leagueAvgGoals: 2.5 });
  assert.ok(result.dataGaps.length > 0);
  assert.ok(result.explanation.includes("Données manquantes"));
});

test("predictMatch: H2H ignoré si échantillon < 3 (pas d'extrapolation sur peu de matchs)", () => {
  const home: TeamInput = { id: "1", name: "A", elo: 1500, attackRating: 1, defenseRating: 1, formPoints5: 7 };
  const away: TeamInput = { id: "2", name: "B", elo: 1500, attackRating: 1, defenseRating: 1, formPoints5: 7 };
  const withTinySample = predictMatch(home, away, { leagueAvgGoals: 2.5, h2hHomeWinRate: 1, h2hSampleSize: 2 });
  const withoutH2h = predictMatch(home, away, { leagueAvgGoals: 2.5 });
  assert.equal(withTinySample.homeWinProb, withoutH2h.homeWinProb);
});

// --- Pipeline de mise à jour des ratings (lib/prediction/ratings.ts) ---

test("updateFormPoints: série de victoires converge vers 15 (asymptote correcte)", () => {
  let form = 7.5;
  for (let i = 0; i < 50; i++) form = updateFormPoints(form, 3);
  assert.ok(Math.abs(form - 15) < 0.01);
});

test("updateFormPoints: série de défaites converge vers 0", () => {
  let form = 7.5;
  for (let i = 0; i < 50; i++) form = updateFormPoints(form, 0);
  assert.ok(Math.abs(form - 0) < 0.01);
});

test("updateFormPoints: série de nuls converge vers 5", () => {
  let form = 7.5;
  for (let i = 0; i < 50; i++) form = updateFormPoints(form, 1);
  assert.ok(Math.abs(form - 5) < 0.01);
});

test("applyMatchResult: une victoire surprise à l'extérieur améliore l'attaque visiteuse et dégrade la défense à domicile", () => {
  const home = { attack: 1.0, defense: 1.0, elo: 1500, formPoints5: 7 };
  const away = { attack: 1.0, defense: 1.0, elo: 1500, formPoints5: 7 };
  const result = applyMatchResult(home, away, 0, 3, { leagueAvgGoals: 2.5, homeAdvantage: 1.25 });
  assert.ok(result.away.attack > away.attack, "l'attaque de l'équipe qui marque 3 buts doit s'améliorer");
  assert.ok(result.home.defense > home.defense, "la défense qui encaisse 3 buts doit se dégrader (valeur plus haute = pire)");
  assert.ok(result.away.elo > away.elo, "l'équipe qui gagne à l'extérieur gagne des points Elo");
  assert.equal(result.home.formPoints5, updateFormPoints(7, 0));
  assert.equal(result.away.formPoints5, updateFormPoints(7, 3));
});

test("applyMatchResult: un résultat extrême ne fait pas diverger les ratings (ratio borné)", () => {
  const home = { attack: 1.0, defense: 1.0, elo: 1500, formPoints5: 7 };
  const away = { attack: 1.0, defense: 1.0, elo: 1500, formPoints5: 7 };
  const result = applyMatchResult(home, away, 9, 0, { leagueAvgGoals: 2.5, homeAdvantage: 1.25 });
  assert.ok(result.home.attack <= 2.2 && result.home.attack >= 0.4);
  assert.ok(result.away.defense <= 2.2 && result.away.defense >= 0.4);
});
