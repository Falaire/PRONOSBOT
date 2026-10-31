import test from "node:test";
import assert from "node:assert/strict";
import {
  temperatureScale1x2,
  blend1x2,
  blendBinary,
  TEMPERATURE,
  MARKET_WEIGHT_1X2,
  MARKET_WEIGHT_OVER25,
} from "../lib/prediction/calibration";

const P = { home: 0.58, draw: 0.24, away: 0.18 };
const M = { home: 0.5, draw: 0.27, away: 0.23 };
const somme = (p: { home: number; draw: number; away: number }) => p.home + p.draw + p.away;

test("calibration: la temperature ne change jamais le favori et rend une somme exacte", () => {
  const t = temperatureScale1x2(P);
  assert.equal(t.home > t.draw && t.draw > t.away, true, "l'ordre des probabilites est preserve");
  assert.ok(Math.abs(somme(t) - 1) < 1e-12, `somme ${somme(t)}`);
});

test("calibration: T > 1 rapproche du hasard, T < 1 eloigne (et T = 1 est neutre)", () => {
  assert.ok(Math.abs(temperatureScale1x2(P, 1).home - P.home) < 1e-12, "T = 1 doit etre l'identite");
  assert.ok(temperatureScale1x2(P, 1.4).home < P.home, "adoucir doit reduire la certitude");
  assert.ok(temperatureScale1x2(P, 0.8).home > P.home, "durcir doit l'augmenter");
  assert.ok(TEMPERATURE > 1, `la temperature ajustee sur train doit etre > 1, recue ${TEMPERATURE}`);
});

test("calibration: w = 1 laisse le modele seul, w = 0 laisse le marche seul", () => {
  const modeleSeul = blend1x2(P, M, 1);
  assert.ok(Math.abs(modeleSeul.home - temperatureScale1x2(P).home) < 1e-12);
  assert.equal(modeleSeul.blended, false, "sans marche utilise, blended doit etre faux");

  const marcheSeul = blend1x2(P, M, 0);
  assert.ok(Math.abs(marcheSeul.home - M.home) < 1e-12, `recu ${marcheSeul.home}`);
  assert.equal(marcheSeul.blended, true);
});

test("calibration: marche manquant = pronostic du modele, jamais une probabilite inventee", () => {
  const r = blend1x2(P, null);
  assert.equal(r.blended, false);
  assert.ok(Math.abs(r.home - temperatureScale1x2(P).home) < 1e-12);
});

test("calibration: un marche qui ne somme pas a 1 est normalise avant melange", () => {
  const surMarge = { home: 0.55, draw: 0.3, away: 0.25 }; // 1.10 : marge non retiree
  const r = blend1x2(P, surMarge, 0.5);
  assert.ok(Math.abs(somme(r) - 1) < 1e-12, `somme ${somme(r)}`);
  assert.ok(r.home < 0.55, "le marche sur-marge ne doit pas gonfler le favori au-dela de sa cote");
});

test("calibration: le melange reduit mecaniquement les ecarts, donc le nombre de value bets", () => {
  // Doc vivante du choix fait dans generate/route.ts : evaluer la value APRES retractation vers le
  // marche divise l'edge par w. Un modele a 0.62 contre un marche a 0.50 garde un edge, mais un
  // modele a 0.55 contre 0.50 ne survit plus au seuil de 0.05.
  const brut = { home: 0.55, draw: 0.27, away: 0.18 };
  const melange = blend1x2(brut, M, MARKET_WEIGHT_1X2);
  assert.ok(melange.home - M.home < 0.55 - M.home, "l'edge doit se reducir, pas grandir");
  assert.ok(melange.home - M.home < 0.05, "et donc passer sous le seuil de value par defaut");
});

test("calibration: blendBinary ignore une cote absente, nulle ou impossible", () => {
  for (const m of [null, 0, 1, 1.2, -0.3]) {
    const r = blendBinary(0.6, m, MARKET_WEIGHT_OVER25);
    assert.equal(r.prob, 0.6, `cote ${m} ne doit rien changer`);
    assert.equal(r.blended, false);
  }
  const r = blendBinary(0.6, 0.5, 0.5);
  assert.ok(Math.abs(r.prob - 0.55) < 1e-12, `recu ${r.prob}`);
  assert.equal(r.blended, true);
});

test("calibration: les poids mesures sont dans l'intervalle [0 ; 1]", () => {
  for (const w of [MARKET_WEIGHT_1X2, MARKET_WEIGHT_OVER25]) {
    assert.ok(w >= 0 && w <= 1, `poids hors bornes : ${w}`);
  }
});
