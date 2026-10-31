/**
 * Calibration de sortie du moteur de pronostics.
 *
 * Le moteur produit un bon CLASSEMENT de favoris (argmax 49.05 % sur 999 matchs de test — mieux
 * qu'un double Poisson ajusté statique, qui plafonne à 46.0 %) mais des PROBABILITES trop
 * assurees : log-loss 1X2 de 1.04635 la ou le marche ferme est a 0.99776. Un modele bien classe
 * mais mal calibre est exactement le cas ou un drapeau « value bet » s'allume trop souvent.
 *
 * Deux scalaires ferment l'essentiel de l'ecart. Aucun n'est regle a la main : tous deux sont
 * ajustes sur le split TRAIN (16 981 matchs) et evalues sur le split TEST (999 matchs), avec le
 * moteur corrige (total de buts conserve, voir lib/prediction/engine.ts) :
 *
 *   temperature  T = 1.30          log-loss test 1.04635 -> 1.03102
 *   + marche     w = 0.50          log-loss test 1.03102 -> 1.00670, argmax 49.05 -> 50.45 %
 *   (marche seul : 0.99776 / 51.15 %)
 *
 * w est le POIDS DU MODELE : w = 1 -> modele seul (aucune cote n'est utilisee), w = 0 -> marche seul.
 * Quand une cote manque (match amical, feed muet, cote incoherente), on NE remplace PAS le modele
 * par une probabilite inventee : la temperature s'applique, le retractation vers le marche saute,
 * et `blended` signale le cas pour que la fiche puisse l'afficher.
 *
 * Mesures et reproductibilite : 19 980 matchs (E0, E1, SP1, D1, I1 ; 2016-2026), scripts
 * `fit_blend.py` / `engine_combo.py`, details dans REVUE-DEPOT-PRONOSBOT.md.
 */

export const TEMPERATURE = 1.30;

/** Poids du modele dans le melange modele / marche, pour le 1X2. */
export const MARKET_WEIGHT_1X2 = 0.50;

/**
 * Poids du modele pour le marche Over/Under 2.5.
 * Brier 0.24458 au melange w=0.5, contre 0.24956 pour le modele seul et 0.24499 pour la cote
 * brute — attention, cette derniere N'EST PAS demi-margee (une seule cote est stockee), donc le
 * gain reel du melange est legerement sous-estime ici.
 */
export const MARKET_WEIGHT_OVER25 = 0.50;

/**
 * BTTS : aucune cote des deux cotes n'est stockee et aucune mesure exploitable n'existe dans nos
 * donnees -> pas de melange. 1.0 = modele seul.
 */
export const MARKET_WEIGHT_BTTS = 1.0;

const EPS = 1e-6;

export type Probs1x2 = { home: number; draw: number; away: number };

function renorm(p: Probs1x2): Probs1x2 {
  const s = p.home + p.draw + p.away;
  if (s <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return { home: p.home / s, draw: p.draw / s, away: p.away / s };
}

/** Adoucit (T > 1) ou durcit (T < 1) la certitude du modele, sans jamais changer son favori. */
export function temperatureScale1x2(p: Probs1x2, t: number = TEMPERATURE): Probs1x2 {
  const T = t > 0 ? t : 1;
  const logits = [Math.log(Math.max(p.home, EPS)), Math.log(Math.max(p.draw, EPS)), Math.log(Math.max(p.away, EPS))].map(
    (x) => x / T
  );
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return { home: exps[0] / sum, draw: exps[1] / sum, away: exps[2] / sum };
}

/** Melange lineaire modele / marche, avec normalisation du marche si necessaire (garde-fou). */
export function blend1x2(model: Probs1x2, market: Probs1x2 | null, w: number = MARKET_WEIGHT_1X2): Probs1x2 & { blended: boolean } {
  const scaled = temperatureScale1x2(model, TEMPERATURE);
  if (!market || w >= 1) return { ...scaled, blended: false };
  const m = renorm(market);
  const wc = Math.min(1, Math.max(0, w));
  return {
    home: wc * scaled.home + (1 - wc) * m.home,
    draw: wc * scaled.draw + (1 - wc) * m.draw,
    away: wc * scaled.away + (1 - wc) * m.away,
    blended: true,
  };
}

/** Idem pour un marche binaire (Over 2.5, BTTS). `marketProb` nulle = pas de cote exploitable. */
export function blendBinary(
  modelProb: number,
  marketProb: number | null,
  w: number
): { prob: number; blended: boolean } {
  if (marketProb === null || marketProb <= 0 || marketProb >= 1 || w >= 1) return { prob: modelProb, blended: false };
  const wc = Math.min(1, Math.max(0, w));
  return { prob: wc * modelProb + (1 - wc) * marketProb, blended: true };
}
