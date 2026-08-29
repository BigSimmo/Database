import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
  STAY_BANDS,
  type Admission,
  type StayBandId,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { constraintSentence, headlineAvailable } from "@/components/ward-management/ward-board-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import type { Site, Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

import styles from "./board.module.css";

/**
 * The ward board, first pass: one ward's beds on a screen.
 *
 * **The deliverable is the rendered page, not the test.** This pass is deliberately the ugly
 * version — one component, one stylesheet, no decomposition — because every defect that has
 * reached a screen in this feature was found by rendering it and looking, and none of them were
 * found by a test. Polish is a later pass; being LOOKABLE is this one.
 *
 * Three rules govern what is below, each of which this prototype has broken before:
 *
 *   1. **Colour never carries a fact alone.** The stay band sets a fill shade, and the day count
 *      is printed on the same tile in text. The number IS the band (the bands are ranges of that
 *      one number), so a greyscale print, a colour-blind reader, or forced-colors mode loses
 *      nothing. The same applies to the past-expected-date marker: a heavy outline AND the words
 *      "past date".
 *   2. **A pulled-but-not-arrived bed is OCCUPIED.** The ward gave the bed away at the pull; the
 *      person may still be in an emergency department. `bedIsOccupied` already says so and this
 *      component must never re-decide it — such a tile renders as taken, reading "empty, waiting"
 *      instead of a day count, and is never drawn as a free bed.
 *   3. **No figure from the Mental Health Act, and no free text about anybody.** Every word on a
 *      tile comes from `STAY_BANDS` (the product owner's four, verbatim) or from a day count.
 *      Nothing here is a threshold, a target, or a legal clock.
 *
 * It reads the synthetic seed directly rather than the shared ward-flow provider: this is a
 * read-only design-scratch board over the frozen fixture, and `WARD_ADMISSIONS_ANCHOR` is the
 * instant that fixture is authored against, so every stay length is the one the seed intends.
 * A live board would take `now`, `units` and the admissions from the provider instead.
 */

/** The four band fills, in `STAY_BANDS` order. One hue, four deepening steps — see the
 *  `--wb-band-*` tokens in `board.module.css`. Keyed by band id rather than by array index so a
 *  reordering of `STAY_BANDS` cannot silently re-map a shade onto the wrong band. */
const BAND_CLASS: Record<StayBandId, string> = {
  "under-1-week": styles.band1,
  "1-4-weeks": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

type Tile =
  | { kind: "occupied"; key: string; days: number; bandId: StayBandId | null; bandLabel: string; pastDate: boolean }
  | { kind: "waiting"; key: string }
  | { kind: "empty"; key: string };

/** Where a unit's own record lives. Resolved by walking `wardSites` rather than through
 *  `unitById`, which `tests/ward-flow-single-source.test.ts` restricts to three named fixture
 *  files. Returns `undefined` for an unknown id and never falls back to a different ward. */
function findUnit(unitId: string): { unit: Unit; site: Site } | undefined {
  for (const site of wardSites) {
    const unit = site.units.find((candidate) => candidate.id === unitId);
    if (unit !== undefined) return { unit, site };
  }
  return undefined;
}

/**
 * One tile per bed, in `unit.beds` of them.
 *
 * Occupied tiles come first, then whatever physical beds are left over are drawn empty. The tiles
 * carry NO bed identity: an `Admission` records the unit, never a bed number, so numbering these
 * "Bed 1..20" would invent an identity nothing in the model holds and a ward would read it as
 * real. They are a count of beds, in a grid, and nothing more.
 *
 * If a unit somehow holds more occupants than it has beds, every occupant is still drawn — the
 * over-count is the fact worth seeing, and truncating the list to `unit.beds` would hide exactly
 * the people a double-allocation put there.
 */
function buildTiles(unit: Unit, admissions: readonly Admission[], now: Instant): Tile[] {
  const occupants = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  const tiles: Tile[] = occupants.map((admission) => {
    const days = daysInBed(admission, now);
    // Rule 2. `daysInBed` is null for a pulled bed nobody has reached yet — the bed is gone, the
    // stay has not started. Never an empty tile, and never a zero-day stay.
    if (days === null) return { kind: "waiting", key: admission.id };
    const band = stayBand(admission, now);
    return {
      kind: "occupied",
      key: admission.id,
      days,
      bandId: band?.id ?? null,
      bandLabel: band?.label ?? "Stay not banded",
      pastDate: isPastExpectedDischarge(admission, now),
    };
  });

  const emptyCount = Math.max(0, unit.beds - tiles.length);
  for (let index = 0; index < emptyCount; index += 1) {
    tiles.push({ kind: "empty", key: `empty-${index}` });
  }
  return tiles;
}

export function WardBoard({ unitId }: { unitId: string }) {
  const found = findUnit(unitId);
  if (found === undefined) {
    return (
      <main id="main-content" className={styles.screen} data-testid="ward-board-unknown-unit">
        <h1 className={styles.unitName}>Ward not found</h1>
        <p className={styles.constraint}>No ward is recorded with the id “{unitId}”.</p>
      </main>
    );
  }

  const { unit, site } = found;
  const now = WARD_ADMISSIONS_ANCHOR;
  const admissions = wardAdmissions;
  // Derived from the same admissions this page draws, so the header cannot disagree with the
  // tiles about who is in a bed. `availableNow` — the only figure the header prints — is
  // `min(allocatable, empty)` and reads neither of these two lists, but they are passed honestly
  // rather than as empty arrays: the releases really are the ones these admissions imply. No
  // leave beds are modelled on this board, and no leave figure is rendered from them.
  const bedReleases = derivedBedReleases([...admissions], now);
  const leaveBeds = [] as const;

  const available = headlineAvailable(unit, admissions, bedReleases, [...leaveBeds], now);
  const constraint = constraintSentence(unit, admissions, bedReleases, [...leaveBeds], now);
  const tiles = buildTiles(unit, admissions, now);

  return (
    <main id="main-content" className={styles.screen} data-testid="ward-board">
      <p className={styles.prototypeBadge}>Synthetic prototype — not a medical device</p>

      {/*
       * A `<div>`, NOT a `<header>` — found by printing the page and looking, not by a test.
       * The global print reset in `globals.css` carries `header, nav, button { display: none
       * !important }` to strip workspace chrome from a printed sheet. This block is a page
       * header, not workspace chrome, so as a `<header>` it vanished in print and a printed ward
       * board carried no ward name, no hospital and no headline figure at all — a sheet of
       * anonymous numbered boxes that could have come from any ward in the state. Other pages
       * fight that rule back with a `display: block !important` override; not using the element
       * is simpler and cannot be undone by a later reset. Nothing here is a landmark: the page's
       * one landmark is the `<main>` above.
       */}
      <div className={styles.header}>
        <h1 className={styles.unitName} data-testid="ward-board-unit-name">
          {unit.name}
        </h1>
        <p className={styles.siteName} data-testid="ward-board-site-name">
          {site.name}
        </p>
        <p className={styles.headline} data-testid="ward-board-headline">
          <span className={styles.headlineValue}>{available}</span>
          <span className={styles.headlineLabel}>
            bed{available === 1 ? "" : "s"} you can fill today
          </span>
        </p>
        {/* `constraintSentence` returns null — never an empty string — when nothing is
            constraining, so nothing is rendered rather than a blank line that reads as a sentence
            which failed to load. */}
        {constraint !== null && (
          <p className={styles.constraint} data-testid="ward-board-constraint">
            {constraint}
          </p>
        )}
      </div>

      {/* The legend explains the shades. It is not what makes the board readable without colour —
          the day count on every tile does that — it just saves a reader working the ranges out. */}
      <ul className={styles.legend} data-testid="ward-board-legend">
        {STAY_BANDS.map((band) => (
          <li key={band.id} className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${BAND_CLASS[band.id]}`} aria-hidden="true" />
            {band.label}
          </li>
        ))}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchPast}`} aria-hidden="true" />
          Past the ward&apos;s own expected date
        </li>
      </ul>

      <ol className={styles.beds} data-testid="ward-board-beds">
        {tiles.map((tile, index) => (
          <li
            key={tile.key}
            className={tileClassName(tile)}
            data-testid={`ward-board-bed-${index + 1}`}
            data-bed-kind={tile.kind}
          >
            {tile.kind === "occupied" && (
              <>
                <span className={styles.days} data-testid={`ward-board-bed-${index + 1}-days`}>
                  {tile.days}
                </span>
                <span className={styles.daysUnit}>day{tile.days === 1 ? "" : "s"}</span>
                {/* The band in words, for the screen reader only: the visible number already
                    states it, and printing both on a 390px-wide tile would crowd out the number
                    this whole tile exists to show. */}
                <span className="sr-only">{tile.bandLabel}</span>
                {tile.pastDate && (
                  <span className={styles.pastMark} data-testid={`ward-board-bed-${index + 1}-past`}>
                    Past date
                  </span>
                )}
              </>
            )}
            {/* Rule 2 on screen: taken, but nobody is in it yet. */}
            {tile.kind === "waiting" && <span className={styles.waiting}>Empty, waiting</span>}
            {tile.kind === "empty" && <span className={styles.emptyLabel}>Empty</span>}
          </li>
        ))}
      </ol>

      <p className={styles.footnote} data-testid="ward-board-footnote">
        {tiles.length} tile{tiles.length === 1 ? "" : "s"}, one per recorded bed. A tile carries no bed number — an
        admission records the ward it is on, never a bed. “Empty, waiting” is a bed this ward has already given away to
        somebody who has not arrived yet; it is taken, not free.
      </p>
    </main>
  );
}

function tileClassName(tile: Tile): string {
  if (tile.kind === "empty") return `${styles.bed} ${styles.bedEmpty}`;
  if (tile.kind === "waiting") return `${styles.bed} ${styles.bedWaiting}`;
  const band = tile.bandId === null ? "" : ` ${BAND_CLASS[tile.bandId]}`;
  const past = tile.pastDate ? ` ${styles.bedPast}` : "";
  return `${styles.bed} ${styles.bedOccupied}${band}${past}`;
}
