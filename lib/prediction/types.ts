export type TeamInput = {
  id: string;
  name: string;
  elo: number;
  /** Force offensive relative (1.0 = moyenne de la ligue), mise à jour après chaque match joué (voir update-ratings). */
  attackRating: number;
  /** Force défensive relative (1.0 = moyenne, plus bas = meilleure défense), mise à jour après chaque match joué. */
  defenseRating: number;
  /** Indicateur de forme récente façon "points sur les 5 derniers matchs" (0-15), lissé par décroissance temporelle (EWMA) plutôt qu'une vraie fenêtre glissante de 5 matchs stricte — voir lib/prediction/ratings.ts. */
  formPoints5: number;
  /** Impact des blessures/suspensions sur le potentiel offensif, 0 (aucun) à 0.15 (fort) — alimenté par /injuries quand disponible (voir sync-fixtures), sinon 0 par défaut (pas d'invention de données). */
  injuriesImpact?: number;
  /** Nombre de matchs joués dans les 10 derniers jours (fatigue/enchaînement) — 0 si inconnu. */
  matchesLast10Days?: number;
};

export type MatchContext = {
  leagueAvgGoals: number; // buts moyens marqués par équipe et par match dans la ligue
  /** Taux de victoire à domicile sur les confrontations directes récentes (0-1), pondéré FAIBLEMENT dans le modèle (petit ajustement, jamais déterminant) — undefined si aucune donnée H2H fiable. */
  h2hHomeWinRate?: number;
  /** Nombre de confrontations directes utilisées pour h2hHomeWinRate — en dessous de 3, le H2H est ignoré (échantillon trop petit pour être fiable). */
  h2hSampleSize?: number;
  neutralVenue?: boolean;
};

export type PredictionOutput = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  over25Prob: number;
  under25Prob: number;
  bttsYesProb: number;
  bttsNoProb: number;
  predictedScoreHome: number;
  predictedScoreAway: number;
  lambdaHome: number;
  lambdaAway: number;
  confidence: number; // 0-100
  explanation: string;
  /** Signale que l'explication mentionne un manque de données (H2H, blessures...) plutôt que d'avoir inventé une estimation. */
  dataGaps: string[];
};

export const HOME_ADVANTAGE = 1.25;
export const ELO_K_FACTOR = 20;

/**
 * Paramètre rho du modèle Dixon-Coles (corrélation entre les scores faibles, voir Dixon & Coles
 * 1997 "Modelling Association Football Scores and Inefficiencies in the Betting Market").
 * Valeur empirique typique en football pro : entre -0.08 et -0.20 selon les ligues/saisons.
 * On utilise ici une valeur fixe raisonnable (-0.13) plutôt qu'un ajustement ajusté par maximum
 * de vraisemblance par ligue : un vrai fit MLE demanderait un historique de plusieurs saisons de
 * résultats par ligue, qu'on ne conserve pas encore (voir limites documentées dans le code de
 * sync-fixtures / docs/05-ai-prompt.md). C'est honnêtement une approximation, pas un ajustement
 * statistique complet.
 */
export const DIXON_COLES_RHO = -0.13;

/** Vitesse de décroissance (EWMA) de la mise à jour des ratings attaque/défense après un match :
 * plus proche de 1 = oublie vite les anciens matchs, plus proche de 0 = mémoire longue. */
export const RATING_DECAY_ALPHA = 0.12;
