export type TeamInput = {
  id: string;
  name: string;
  elo: number;
  /** Buts marqués / 90min sur les 5-10 derniers matchs, normalisé */
  attackRating: number;
  /** Buts encaissés / 90min sur les 5-10 derniers matchs, normalisé (plus bas = meilleure défense) */
  defenseRating: number;
  /** Points sur les 5 derniers matchs (0-15) */
  formPoints5: number;
  injuriesImpact?: number; // 0 (aucun impact) à 0.15 (impact fort, joueurs clés absents)
};

export type MatchContext = {
  leagueAvgGoals: number; // buts moyens marqués par équipe et par match dans la ligue
  h2hHomeWinRate?: number; // 0-1, optionnel, confrontations directes
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
};

export const HOME_ADVANTAGE = 1.25;
export const ELO_K_FACTOR = 20;
