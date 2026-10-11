/**
 * Sélection des matchs à retenir lors de la synchronisation API-Football (sync-fixtures).
 *
 * Bug corrigé : auparavant, les matchs étaient triés par date croissante puis coupés à
 * MAX_FIXTURES. Avec ~2 000 matchs sur hier/aujourd'hui/demain, on gardait donc les 500 PLUS
 * ANCIENS (les matchs d'hier, déjà terminés) et les matchs à venir disparaissaient : aucun
 * pronostic ne pouvait être généré, et les ratings ne voyaient que des matchs déjà traités.
 *
 * Règle désormais :
 *  - les matchs TERMINÉS (FT/AET/PEN) sont retenus du plus récent au plus ancien, dans leur
 *    propre quota (`maxFinished`), pour alimenter update-ratings ;
 *  - les AUTRES matchs (à venir, en direct, reportés...) sont retenus par proximité avec
 *    maintenant (le plus proche d'abord), dans leur propre quota (`maxOpen`), pour alimenter
 *    generate et l'enrichissement.
 * Les deux quotas sont indépendants : un afflux de matchs à venir ne peut plus évincer les
 * matchs terminés, et inversement.
 */

export type SelectableFixture = {
  fixture: { date: string; status?: { short?: string } };
};

const FINISHED_SHORT_CODES = ["FT", "AET", "PEN"];

export function isFinishedShortCode(short?: string): boolean {
  return FINISHED_SHORT_CODES.includes(short ?? "");
}

export type FixtureSelectionOptions = {
  maxOpen: number;
  maxFinished: number;
};

export type FixtureSelectionResult<T> = {
  selected: T[];
  /** Nombre de matchs non terminés disponibles avant plafonnement. */
  openAvailable: number;
  /** Nombre de matchs terminés disponibles avant plafonnement. */
  finishedAvailable: number;
  openKept: number;
  finishedKept: number;
};

export function selectFixturesToSync<T extends SelectableFixture>(
  items: T[],
  nowMs: number,
  opts: FixtureSelectionOptions
): FixtureSelectionResult<T> {
  const finished: T[] = [];
  const open: T[] = [];
  for (const item of items) {
    if (isFinishedShortCode(item.fixture.status?.short)) finished.push(item);
    else open.push(item);
  }

  const timeOf = (item: T) => new Date(item.fixture.date).getTime();

  // Terminés : les plus récents d'abord.
  finished.sort((a, b) => timeOf(b) - timeOf(a));
  // Autres : les plus proches de maintenant d'abord (passé ou futur).
  open.sort((a, b) => Math.abs(timeOf(a) - nowMs) - Math.abs(timeOf(b) - nowMs));

  const keptOpen = open.slice(0, Math.max(0, opts.maxOpen));
  const keptFinished = finished.slice(0, Math.max(0, opts.maxFinished));

  return {
    selected: [...keptOpen, ...keptFinished],
    openAvailable: open.length,
    finishedAvailable: finished.length,
    openKept: keptOpen.length,
    finishedKept: keptFinished.length,
  };
}
