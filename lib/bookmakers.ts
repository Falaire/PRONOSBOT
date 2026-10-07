/**
 * Informations minimales nécessaires pour composer le résumé copié dans le presse-papier avant
 * d'ouvrir un bookmaker — volontairement plus large que DemoFixture pour pouvoir être réutilisé
 * depuis le carnet personnel (components/SavePickButton.tsx, app/dashboard/carnet) qui ne dispose
 * pas forcément de toutes les colonnes d'un DemoFixture complet (score exact, explication...).
 */
export type BetSlipInfo = {
  home: string;
  away: string;
  league: string;
  kickoff: string;
  prediction: string;
  confidence: number;
  odds?: { home: number; draw: number; away: number };
};

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
  /**
   * Nom de paquet Android (ex: "org.xbet.client1") permettant de tenter d'ouvrir directement
   * l'application si elle est déjà installée sur le téléphone, au lieu du site web — voir
   * getBookmakerDeepLink() ci-dessous. Renseigné seulement quand on a pu vérifier la valeur sur
   * plusieurs sources indépendantes (voir commentaire plus bas) : laissé vide sinon plutôt que de
   * deviner, pour ne jamais risquer d'envoyer quelqu'un vers la mauvaise application.
   * Important à savoir : plusieurs de ces bookmakers (SportyBet Nigeria, Bet9ja...) ne sont PAS
   * distribués sur le Play Store dans certains pays (règles de Google sur les jeux d'argent) —
   * l'app y est installée via APK direct, ce qui marche quand même avec ce mécanisme tant que le
   * nom de paquet est le bon, mais on ne peut pas le vérifier aussi facilement que sur le Store.
   * Peut être surchargé/ajouté via les variables NEXT_PUBLIC_BOOKMAKER_<ID>_ANDROID_PKG.
   */
  androidPackage?: string;
};

export const BOOKMAKERS: Bookmaker[] = [
  { id: "1xbet", name: "1xBet", color: "#1565c0", defaultUrl: "https://1xbet.com/en/line/football", androidPackage: "org.xbet.client1" },
  { id: "betwinner", name: "Betwinner", color: "#0ea5e9", defaultUrl: "https://betwinner.com/en/line/football", androidPackage: "org.betwinner.client" },
  { id: "melbet", name: "Melbet", color: "#f59e0b", defaultUrl: "https://melbet.com/en/line/football", androidPackage: "org.melbet.client" },
  { id: "sportybet", name: "SportyBet", color: "#e11d48", defaultUrl: "https://www.sportybet.com/ng/sport/football" },
  { id: "premierbet", name: "Premier Bet", color: "#16a34a", defaultUrl: "https://www.premierbet.com/" },
  { id: "22bet", name: "22Bet", color: "#334155", defaultUrl: "https://22bet.com/line/football" },
  { id: "parimatch", name: "Parimatch", color: "#dc2626", defaultUrl: "https://parimatch.com/en/sport/football" },
  { id: "linebet", name: "LineBet", color: "#7c3aed", defaultUrl: "https://linebet.com/en/line/football" },
  { id: "mozzart", name: "Mozzart Bet", color: "#ea580c", defaultUrl: "https://mozzartbet.com/en/betting", androidPackage: "com.mozzartbet" },
  { id: "bet9ja", name: "Bet9ja", color: "#065f46", defaultUrl: "https://web.bet9ja.com/Sport/Default.aspx" },
];

/** Surcharge/ajout du nom de paquet Android par bookmaker si tu as vérifié la bonne valeur pour
 * le marché que tu cibles (ex: variante spécifique à un pays). Vide = utilise la valeur par
 * défaut ci-dessus (ou aucune tentative d'ouverture d'app si elle est aussi vide). */
const ANDROID_PACKAGE_OVERRIDES: Record<string, string | undefined> = {
  "1xbet": process.env.NEXT_PUBLIC_BOOKMAKER_1XBET_ANDROID_PKG,
  betwinner: process.env.NEXT_PUBLIC_BOOKMAKER_BETWINNER_ANDROID_PKG,
  melbet: process.env.NEXT_PUBLIC_BOOKMAKER_MELBET_ANDROID_PKG,
  sportybet: process.env.NEXT_PUBLIC_BOOKMAKER_SPORTYBET_ANDROID_PKG,
  premierbet: process.env.NEXT_PUBLIC_BOOKMAKER_PREMIERBET_ANDROID_PKG,
  "22bet": process.env.NEXT_PUBLIC_BOOKMAKER_22BET_ANDROID_PKG,
  parimatch: process.env.NEXT_PUBLIC_BOOKMAKER_PARIMATCH_ANDROID_PKG,
  linebet: process.env.NEXT_PUBLIC_BOOKMAKER_LINEBET_ANDROID_PKG,
  mozzart: process.env.NEXT_PUBLIC_BOOKMAKER_MOZZART_ANDROID_PKG,
  bet9ja: process.env.NEXT_PUBLIC_BOOKMAKER_BET9JA_ANDROID_PKG,
};


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

/** Nom de paquet Android effectif pour ce bookmaker (surcharge env sinon valeur par défaut), ou undefined si inconnu. */
export function getBookmakerAndroidPackage(bookmaker: Bookmaker): string | undefined {
  const override = ANDROID_PACKAGE_OVERRIDES[bookmaker.id];
  const pkg = override && override.trim().length > 0 ? override : bookmaker.androidPackage;
  return pkg && pkg.trim().length > 0 ? pkg : undefined;
}

/**
 * Honnêteté importante (voir aussi le commentaire en tête de fichier) : aucun bookmaker africain
 * courant n'offre d'API publique permettant de pré-remplir un coupon de pari avec un match et
 * une cote précis — ça demanderait un partenariat officiel qu'on n'a pas. Ce qu'on PEUT faire de
 * fiable :
 *  - Android (Chrome/WebView) : si on connaît le nom de paquet de l'app, on utilise le mécanisme
 *    officiel "intent://" documenté par Google, qui ouvre directement l'app SI ELLE EST DÉJÀ
 *    INSTALLÉE (peu importe qu'elle vienne du Play Store ou d'un APK téléchargé directement —
 *    ça fonctionne pareil), et retombe automatiquement et silencieusement sur le lien web
 *    (S.browser_fallback_url) si l'app n'est pas trouvée. Zéro risque de casser quoi que ce soit :
 *    dans le pire cas, ça se comporte exactement comme avant (ouverture du site).
 *  - iOS : il n'existe pas d'équivalent générique fiable sans connaître le schéma d'URL privé de
 *    chaque app (non documenté, changeant, risqué à deviner). En revanche, iOS ouvre déjà TOUT
 *    SEUL l'app native au lieu de Safari quand on clique un lien https classique, SI le
 *    bookmaker a configuré les "Universal Links" pour son domaine — ce qui est indépendant de
 *    notre code. On ne fait donc rien de spécial pour iOS, le comportement par défaut du
 *    navigateur te donne déjà ce qu'on peut obtenir sans schéma privé vérifié.
 *  - Dans tous les cas, le résumé du pronostic (match, marché, cote) reste copié dans le
 *    presse-papier AVANT l'ouverture, pour que l'utilisateur puisse le coller/rechercher en un
 *    geste une fois dans l'app ou sur le site — c'est le "coupon" le plus proche qu'on puisse
 *    construire sans accord API officiel avec le bookmaker.
 */
export function getBookmakerDeepLink(bookmaker: Bookmaker): string {
  const fallbackUrl = getBookmakerUrl(bookmaker);
  const pkg = getBookmakerAndroidPackage(bookmaker);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  if (!isAndroid || !pkg) return fallbackUrl;

  const fallbackEncoded = encodeURIComponent(fallbackUrl);
  // Format intent:// officiel Android/Chrome : ouvre l'app par son package si installée, sinon
  // suit S.browser_fallback_url (ici : le lien web du bookmaker).
  return `intent://${fallbackUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${fallbackEncoded};end`;
}

/** Construit le texte copiable résumant le pronostic, pour que l'utilisateur le colle/recherche rapidement côté bookmaker. */
export function buildBetSlipText(fixture: BetSlipInfo): string {
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
