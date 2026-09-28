/**
 * Données de démonstration utilisées quand Supabase n'est pas encore configuré
 * (première visite du repo, preview sans .env). Dès que NEXT_PUBLIC_SUPABASE_URL
 * est renseigné, les pages basculent automatiquement sur les vraies données.
 */
export type DemoFixture = {
  id: string;
  league: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  kickoff: string;
  confidence: number;
  prediction: string;
  probHome: number;
  probDraw: number;
  probAway: number;
  probOver25: number;
  probBtts: number;
  scoreHome: number;
  scoreAway: number;
  explanation: string;
  isValueBet: boolean;
  free: boolean;
  /** Cotes réelles du marché (issues d'un bookmaker comme 1xBet) quand elles sont disponibles. */
  odds?: { home: number; draw: number; away: number };
};

export const DEMO_FIXTURES: DemoFixture[] = [
  {
    id: "demo-1",
    league: "Ligue 1 Togo",
    home: "ASKO Kara",
    away: "AC Semassi",
    kickoff: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    confidence: 78,
    prediction: "Victoire ASKO Kara",
    probHome: 0.58,
    probDraw: 0.24,
    probAway: 0.18,
    probOver25: 0.42,
    probBtts: 0.39,
    scoreHome: 2,
    scoreAway: 1,
    explanation:
      "ASKO Kara est favori avec 58% de chances de gagner. Forme récente : ASKO Kara (10/15 pts) vs AC Semassi (6/15 pts). Score le plus probable : 2-1.",
    isValueBet: true,
    free: true,
  },
  {
    id: "demo-2",
    league: "Premier League",
    home: "Manchester City",
    away: "Arsenal",
    kickoff: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    confidence: 64,
    prediction: "Victoire Manchester City",
    probHome: 0.52,
    probDraw: 0.26,
    probAway: 0.22,
    probOver25: 0.61,
    probBtts: 0.57,
    scoreHome: 2,
    scoreAway: 1,
    explanation:
      "Manchester City est favori avec 52% de chances de gagner à domicile face à un concurrent direct. Plus de 2,5 buts : 61%.",
    isValueBet: false,
    free: true,
  },
  {
    id: "demo-3",
    league: "Ligue des Champions CAF",
    home: "Espérance de Tunis",
    away: "Al Ahly",
    kickoff: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    confidence: 55,
    prediction: "Match nul probable",
    probHome: 0.33,
    probDraw: 0.35,
    probAway: 0.32,
    probOver25: 0.44,
    probBtts: 0.48,
    scoreHome: 1,
    scoreAway: 1,
    explanation:
      "Match très équilibré entre deux cadors africains, le nul est le résultat le plus probable (35%). Historique de confrontations serrées.",
    isValueBet: true,
    free: false,
  },
  {
    id: "demo-4",
    league: "LaLiga",
    home: "Real Madrid",
    away: "Atletico Madrid",
    kickoff: new Date(Date.now() + 30 * 3600 * 1000).toISOString(),
    confidence: 71,
    prediction: "Victoire Real Madrid",
    probHome: 0.6,
    probDraw: 0.22,
    probAway: 0.18,
    probOver25: 0.55,
    probBtts: 0.5,
    scoreHome: 2,
    scoreAway: 0,
    explanation: "Real Madrid en grande forme (13/15 pts) domine le derby madrilène à domicile.",
    isValueBet: false,
    free: false,
  },
  {
    id: "demo-5",
    league: "Ligue 1 Côte d'Ivoire",
    home: "ASEC Mimosas",
    away: "Africa Sports",
    kickoff: new Date(Date.now() + 27 * 3600 * 1000).toISOString(),
    confidence: 60,
    prediction: "Victoire ASEC Mimosas",
    probHome: 0.49,
    probDraw: 0.28,
    probAway: 0.23,
    probOver25: 0.38,
    probBtts: 0.35,
    scoreHome: 1,
    scoreAway: 0,
    explanation: "Derby ivoirien : ASEC Mimosas légèrement favori grâce à sa meilleure forme récente.",
    isValueBet: true,
    free: false,
  },
];

export const DEMO_ACCURACY = {
  last30Days: 0.68,
  totalPredictions: 412,
  correct1x2: 280,
};
