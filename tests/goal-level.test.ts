import test from "node:test";
import assert from "node:assert/strict";
import { computeLambdas, scoreMatrix, predictMatch } from "../lib/prediction/engine";
import type { TeamInput, MatchContext } from "../lib/prediction/types";

/**
 * Tests de NIVEAU (buts), et non seulement de structure.
 * La suite existante verifie que les probas somment a 1, que les bornes sont respectees, que les
 * manques de données sont signales — mais rien ne verifiait que le moteur annonce un nombre de
 * buts plausible, ce qui a laisse vivre l'ambiguite "moyenne de ligue par equipe vs par match".
 */

function team(over: Partial<TeamInput> & { id: string }): TeamInput {
  return { name: over.id, elo: 1500, attackRating: 1, defenseRating: 1, formPoints5: 7.5, ...over };
}

const drawOf = (M: number[][]): number => M.reduce((s, row, h) => s + (row[h] ?? 0), 0);

const NEUTRE: MatchContext = { leagueAvgGoals: 1.35 }; // buts par EQUIPE et par match

test("computeLambdas: deux equipes moyennes ne creent pas de buts supplementaires", () => {
  const { lambdaHome, lambdaAway } = computeLambdas(team({ id: "A" }), team({ id: "B" }), NEUTRE);
  const total = lambdaHome + lambdaAway;
  // L'avantage du terrain repartit les buts, il ne doit pas les doubler.
  assert.ok(total <= 2 * 1.35 + 0.05, `total attendus <= 2.75 pour une ligue a 2.70, recu ${total.toFixed(3)}`);
});

test("computeLambdas: une moyenne de ligue mal saisie est corrigee par le moteur, pas par l'appelant", () => {
  const bien = computeLambdas(team({ id: "A" }), team({ id: "B" }), { leagueAvgGoals: 1.35 });
  const mal = computeLambdas(team({ id: "A" }), team({ id: "B" }), { leagueAvgGoals: 2.5 }); // ancien defaut SQL
  const ecart = Math.abs(bien.lambdaHome + bien.lambdaAway - (mal.lambdaHome + mal.lambdaAway));
  assert.ok(ecart < 0.05, `le moteur devrait neutraliser 2.50 (total ${mal.lambdaHome! + mal.lambdaAway!} vs ${bien.lambdaHome + bien.lambdaAway})`);
});

test("predictMatch: le triple 1X2 stocke somme exactement a 1 (toutes affiches, pas a 1e-3)", () => {
  const paires: [number, number][] = [
    [1, 1], [1.6, 0.6], [0.6, 1.6], [1.2, 1.1], [1.9, 0.8], [0.9, 1.4],
    [1.35, 1.05], [2.2, 0.55], [1.05, 1.3], [1.45, 0.95], [0.8, 1.9], [1.15, 1.15],
  ];
  let pire = 0;
  for (const [att, def] of paires) {
    const r = predictMatch(
      team({ id: "A", attackRating: att, defenseRating: def }),
      team({ id: "B", attackRating: def, defenseRating: att }),
      NEUTRE
    );
    pire = Math.max(pire, Math.abs(r.homeWinProb + r.drawProb + r.awayWinProb - 1));
  }
  assert.ok(pire < 1e-9, `pire ecart a la unite sur 12 affiches : ${pire}`);
});

test("scoreMatrix: rho < 0 AUGMENTE la probabilite de nul (fige le sens, que le commentaire ne doit pas contredire)", () => {
  const sans = drawOf(scoreMatrix(1.5, 1.2, 0));
  const avec = drawOf(scoreMatrix(1.5, 1.2, -0.13));
  assert.ok(avec > sans, `rho=-0.13 devrait monter P(nul) au-dessus de ${sans}, recu ${avec}`);
});

test("scoreMatrix: aucune case negative meme avec un rho de signe inattendu", () => {
  const M = scoreMatrix(4.5, 4.5, 0.05); // lambda*mu*rho = 1.0125 > 1 -> tau(0,0) < 0 sans clamp
  let min = 1;
  for (const row of M) for (const p of row) min = Math.min(min, p);
  assert.ok(min >= 0, `probabilite negative detectee: ${min}`);
});
