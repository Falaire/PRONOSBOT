/** Données de seed — ligues prioritaires + équipes de départ (Togo, Afrique, Top 5 Europe) */

/**
 * UNITE DE avg_goals_per_match : buts par EQUIPE et par match (moyenne de ligue), PAS le total
 * des deux équipes. Le moteur applique HOME_ADVANTAGE en plus (lib/prediction/engine.ts), donc un
 * total inscrit ici double mecaniquement le nombre de buts attendus : avec 2.50, un match entre deux
 * equipes moyennes sortait a 5.53 buts attends et un « +2,5 buts » a 91 % (frequence reelle : 52 %).
 * sanitizeLeagueAvg rejette toute valeur hors [0.8 ; 2.0] et retombe sur 1.35 : une valeur au
 * format "total" etait donc silencieusement remplacee par un repli unique pour TOUTES les ligues
 * (11/11 dans ce fichier), ce qui effacait la difference Bundesliga / Ligue 1 togolaise.
 * Valeurs ci-dessous = totaux observes / 2. A remplacer des que possible par le résultat de
 * /api/predictions/recalc-league-averages (qui mesure, lui, sur les matchs rejoues).
 */

export const SEED_LEAGUES = [
  { code: "TG1", name: "Ligue 1 Togo", country: "Togo", priority_order: 1, avg_goals_per_match: 1.15 },
  { code: "CAF_CL", name: "Ligue des Champions CAF", country: "Afrique", priority_order: 2, avg_goals_per_match: 1.1 },
  { code: "CAN", name: "Coupe d'Afrique des Nations", country: "Afrique", priority_order: 3, avg_goals_per_match: 1.2 },
  { code: "CIV1", name: "Ligue 1 Côte d'Ivoire", country: "Côte d'Ivoire", priority_order: 4, avg_goals_per_match: 1.15 },
  { code: "SEN1", name: "Ligue 1 Sénégal", country: "Sénégal", priority_order: 5, avg_goals_per_match: 1.1 },
  { code: "UCL", name: "Ligue des Champions UEFA", country: "Europe", priority_order: 10, avg_goals_per_match: 1.4 },
  { code: "EPL", name: "Premier League", country: "Angleterre", priority_order: 11, avg_goals_per_match: 1.43 },
  { code: "LIGA", name: "LaLiga", country: "Espagne", priority_order: 12, avg_goals_per_match: 1.3 },
  { code: "SERIEA", name: "Serie A", country: "Italie", priority_order: 13, avg_goals_per_match: 1.35 },
  { code: "BUNDES", name: "Bundesliga", country: "Allemagne", priority_order: 14, avg_goals_per_match: 1.55 },
  { code: "LIGUE1", name: "Ligue 1", country: "France", priority_order: 15, avg_goals_per_match: 1.3 },
];

export const SEED_TEAMS = [
  // Europe (top 5 championnats)
  { name: "Manchester City", league: "EPL", elo: 2040, attack: 1.55, defense: 0.62, form: 12 },
  { name: "Real Madrid", league: "LIGA", elo: 2030, attack: 1.5, defense: 0.65, form: 13 },
  { name: "Bayern Munich", league: "BUNDES", elo: 1990, attack: 1.6, defense: 0.75, form: 11 },
  { name: "Arsenal", league: "EPL", elo: 1970, attack: 1.4, defense: 0.7, form: 12 },
  { name: "PSG", league: "LIGUE1", elo: 1960, attack: 1.5, defense: 0.75, form: 10 },
  { name: "Liverpool", league: "EPL", elo: 1960, attack: 1.45, defense: 0.72, form: 11 },
  { name: "Inter Milan", league: "SERIEA", elo: 1950, attack: 1.3, defense: 0.6, form: 12 },
  { name: "Barcelone", league: "LIGA", elo: 1940, attack: 1.4, defense: 0.78, form: 9 },
  { name: "Atletico Madrid", league: "LIGA", elo: 1900, attack: 1.2, defense: 0.68, form: 10 },
  { name: "Napoli", league: "SERIEA", elo: 1870, attack: 1.15, defense: 0.85, form: 8 },
  { name: "Juventus", league: "SERIEA", elo: 1860, attack: 1.1, defense: 0.7, form: 9 },
  { name: "Dortmund", league: "BUNDES", elo: 1880, attack: 1.3, defense: 0.95, form: 8 },
  { name: "Chelsea", league: "EPL", elo: 1830, attack: 1.2, defense: 0.95, form: 8 },
  { name: "Man United", league: "EPL", elo: 1810, attack: 1.1, defense: 1.0, form: 7 },
  // Togo — Ligue 1
  { name: "ASKO Kara", league: "TG1", elo: 1420, attack: 1.1, defense: 0.9, form: 10 },
  { name: "AC Semassi", league: "TG1", elo: 1400, attack: 1.0, defense: 1.0, form: 8 },
  { name: "Maranatha FC", league: "TG1", elo: 1380, attack: 0.95, defense: 1.05, form: 7 },
  { name: "AS OTR", league: "TG1", elo: 1360, attack: 0.9, defense: 1.1, form: 6 },
  { name: "Dynamic Togolais", league: "TG1", elo: 1350, attack: 0.9, defense: 1.05, form: 7 },
  { name: "Gbohloe-su", league: "TG1", elo: 1340, attack: 0.85, defense: 1.1, form: 6 },
  { name: "Unisport Sokodé", league: "TG1", elo: 1330, attack: 0.85, defense: 1.1, form: 6 },
  { name: "Anges de Notsé", league: "TG1", elo: 1320, attack: 0.8, defense: 1.15, form: 5 },
  { name: "Sara Sport Bafilo", league: "TG1", elo: 1310, attack: 0.8, defense: 1.15, form: 5 },
  { name: "Oti-Sport Atakpamé", league: "TG1", elo: 1300, attack: 0.78, defense: 1.2, form: 5 },
];
