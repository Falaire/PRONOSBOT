import type { DemoFixture } from "@/lib/demo-data";

/**
 * Bookmakers populaires et actifs dans la majorité des pays africains (Afrique de l'Ouest,
 * Centrale, et au-delà). Important à savoir, honnêtement : aucun de ces bookmakers n'expose
 * d'API publique permettant de créer un coupon de pari pré-rempli automatiquement avec le
 * match et la cote choisis — ça nécessiterait un accord API/partenaire officiel avec chacun
 * d'eux, ce que nous n'avons pas. On fait donc le maximum possible sans ça :
 *   1. on copie automatiquement le résumé du pronostic (match, marché, cote) dans le
 *      presse-papier de l'utilisateur,
 *   2. on l'envoie directement sur le site du bookmaker choisi (son lien d'affiliation si
 *      configuré, sinon sa page d'accueil/sport),
 *   3. il lui suffit de coller/rechercher le match en 1-2 clics pour retrouver le pari exact.
 *
 * Pour configurer un lien d'affiliation personnel par bookmaker (recommandé pour générer un
 * revenu complémentaire), renseigne la variable d'environnement correspondante — voir
 * .env.example. Sans configuration, le lien pointe simplement vers le site public du
 * bookmaker.
 *
 * Note technique : les variables d'environnement NEXT_PUBLIC_* doivent être référencées de
 * façon LITTÉRALE (process.env.NEXT_PUBLIC_X) pour que Next.js puisse les intégrer au bundle
 * envoyé au navigateur — un accès dynamique par variable ne fonctionnerait pas côté client.
 * D'où la table explicite ci-dessous plutôt qu'une boucle générique.
 */
export type Bookmaker = {
  id: string;
  name: string;
  /** Couleur de marque approximative, pour l'affichage (pastille). */
  color: string;
  /** URL publique par défaut (page d'accueil ou section sport). */
  defaultUrl: string;
};

export const BOOKMAKERS: Bookmaker[] = [
  { id: "1xbet", name: "1xBet", color: "#1565c0", defaultUrl: "https://1xbet.com/en/line/football" },
  { id: "betwinner", name: "Betwinner", color: "#0ea5e9", defaultUrl: "https://betwinner.com/en/line/football" },
  { id: "melbet", name: "Melbet", color: "#f59e0b", defaultUrl: "https://melbet.com/en/line/football" },
  { id: "sportybet", name: "SportyBet", color: "#e11d48", defaultUrl: "https://www.sportybet.com/ng/sport/football" },
  { id: "premierbet", name: "Premier Bet", color: "#16a34a", defaultUrl: "https://www.premierbet.com/" },
  { id: "22bet", name: "22Bet", color: "#334155", defaultUrl: "https://22bet.com/line/football" },
  { id: "parimatch", name: "Parimatch", color: "#dc2626", defaultUrl: "https://parimatch.com/en/sport/football" },
  { id: "linebet", name: "LineBet", color: "#7c3aed", defaultUrl: "https://linebet.com/en/line/football" },
  { id: "mozzart", name: "Mozzart Bet", color: "#ea580c", defaultUrl: "https://mozzartbet.com/en/betting" },
  { id: "bet9ja", name: "Bet9ja", color: "#065f46", defaultUrl: "https://web.bet9ja.com/Sport/Default.aspx" },
];

/** Liens d'affiliation facultatifs (un par bookmaker), référencés littéralement pour que Next.js
 * puisse les inliner côté client. Laisse vide dans .env pour utiliser l'URL publique par défaut. */
const AFFILIATE_OVERRIDES: Record<string, string | undefined> = {
  "1xbet": process.env.NEXT_PUBLIC_BOOKMAKER_1XBET_URL,
  betwinner: process.env.NEXT_PUBLIC_BOOKMAKER_BETWINNER_URL,
  melbet: process.env.NEXT_PUBLIC_BOOKMAKER_MELBET_URL,
  sportybet: process.env.NEXT_PUBLIC_BOOKMAKER_SPORTYBET_URL,
  premierbet: process.env.NEXT_PUBLIC_BOOKMAKER_PREMIERBET_URL,
  "22bet": process.env.NEXT_PUBLIC_BOOKMAKER_22BET_URL,
  parimatch: process.env.NEXT_PUBLIC_BOOKMAKER_PARIMATCH_URL,
  linebet: process.env.NEXT_PUBLIC_BOOKMAKER_LINEBET_URL,
  mozzart: process.env.NEXT_PUBLIC_BOOKMAKER_MOZZART_URL,
  bet9ja: process.env.NEXT_PUBLIC_BOOKMAKER_BET9JA_URL,
};

/** Résout l'URL à utiliser pour un bookmaker : son lien d'affiliation si configuré, sinon l'URL publique par défaut. */
export function getBookmakerUrl(bookmaker: Bookmaker): string {
  const override = AFFILIATE_OVERRIDES[bookmaker.id];
  return override && override.trim().length > 0 ? override : bookmaker.defaultUrl;
}

/** Construit le texte copiable résumant le pronostic, pour que l'utilisateur le colle/recherche rapidement côté bookmaker. */
export function buildBetSlipText(fixture: DemoFixture): string {
  const date = new Date(fixture.kickoff).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Lome",
  });
  const lines = [
    `⚽ ${fixture.home} vs ${fixture.away} (${fixture.league})`,
    `📅 ${date}`,
    `🎯 Pronostic IA : ${fixture.prediction} (${Math.round(fixture.confidence)}% confiance)`,
  ];
  if (fixture.odds) {
    lines.push(
      `💰 Cotes référence : 1 · ${fixture.odds.home.toFixed(2)}  X · ${fixture.odds.draw.toFixed(2)}  2 · ${fixture.odds.away.toFixed(2)}`
    );
  }
  return lines.join("\n");
}
