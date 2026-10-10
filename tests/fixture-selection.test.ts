import test from "node:test";
import assert from "node:assert/strict";
import { selectFixturesToSync, type SelectableFixture } from "../lib/fixture-selection";

const H = 3600e3;
const NOW = Date.parse("2026-10-10T10:00:00Z");

function fx(id: string, offsetHours: number, short: string): SelectableFixture & { id: string } {
  return { id, fixture: { date: new Date(NOW + offsetHours * H).toISOString(), status: { short } } };
}

/** Scénario réaliste : 900 matchs terminés d'hier, 120 terminés d'aujourd'hui, 980 à venir sur 48 h. */
function buildDay(): (SelectableFixture & { id: string })[] {
  const items: (SelectableFixture & { id: string })[] = [];
  for (let i = 0; i < 900; i++) items.push(fx(`y${i}`, -24 + (i / 900) * 20, "FT"));
  for (let i = 0; i < 120; i++) items.push(fx(`t${i}`, -10 + (i / 120) * 9, "FT"));
  for (let i = 0; i < 980; i++) items.push(fx(`u${i}`, 1 + (i / 980) * 47, "NS"));
  return items;
}

test("un afflux de matchs terminés n'évince plus les matchs à venir", () => {
  const result = selectFixturesToSync(buildDay(), NOW, { maxOpen: 500, maxFinished: 1000 });
  const upcoming = result.selected.filter((x) => x.fixture.status?.short === "NS");
  assert.equal(upcoming.length, 500, "le quota de matchs à venir doit être rempli");
});

test("les matchs à venir retenus sont les plus proches de maintenant", () => {
  const result = selectFixturesToSync(buildDay(), NOW, { maxOpen: 500, maxFinished: 1000 });
  const upcomingDates = result.selected
    .filter((x) => x.fixture.status?.short === "NS")
    .map((x) => new Date(x.fixture.date).getTime());
  const maxKept = Math.max(...upcomingDates);
  // Les 500 plus proches sur 1..48 h couvrent jusqu'à environ 1 + 47 * 500/980 ≈ 25 h.
  assert.ok(maxKept <= NOW + 25.1 * H, "aucun match éloigné ne doit passer avant un match proche");
});

test("les matchs terminés retenus sont les plus récents", () => {
  const result = selectFixturesToSync(buildDay(), NOW, { maxOpen: 500, maxFinished: 300 });
  const finished = result.selected.filter((x) => x.fixture.status?.short === "FT");
  assert.equal(finished.length, 300);
  // Invariant : chaque match terminé retenu est plus récent que chaque match terminé écarté.
  const allFinished = buildDay().filter((x) => x.fixture.status?.short === "FT");
  const keptIds = new Set(finished.map((x) => x.id));
  const oldestKept = Math.min(...finished.map((x) => new Date(x.fixture.date).getTime()));
  const newestDropped = Math.max(
    ...allFinished.filter((x) => !keptIds.has(x.id)).map((x) => new Date(x.fixture.date).getTime())
  );
  assert.ok(oldestKept >= newestDropped, "les matchs terminés retenus doivent être les plus récents");
});

test("les compteurs de disponibilité et de conservation sont cohérents", () => {
  const result = selectFixturesToSync(buildDay(), NOW, { maxOpen: 500, maxFinished: 1000 });
  assert.equal(result.openAvailable, 980);
  assert.equal(result.finishedAvailable, 1020);
  assert.equal(result.openKept, 500);
  assert.equal(result.finishedKept, 1000);
  assert.equal(result.selected.length, result.openKept + result.finishedKept);
});

test("un quota à zéro ne retient rien dans sa catégorie", () => {
  const result = selectFixturesToSync(buildDay(), NOW, { maxOpen: 0, maxFinished: 10 });
  assert.equal(result.selected.filter((x) => x.fixture.status?.short === "NS").length, 0);
  assert.equal(result.selected.length, 10);
});

test("les matchs en direct et reportés sont classés avec les matchs non terminés", () => {
  const items = [fx("live", -0.5, "1H"), fx("postponed", -30, "PST"), fx("done", -2, "FT")];
  const result = selectFixturesToSync(items, NOW, { maxOpen: 10, maxFinished: 10 });
  assert.equal(result.openAvailable, 2);
  assert.equal(result.finishedAvailable, 1);
  assert.equal(result.selected[0].id, "live", "le match en direct est le plus proche");
});
