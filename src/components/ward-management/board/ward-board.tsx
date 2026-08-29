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
import {
  ARROW_HORIZON_DAYS,
  arrowTargets,
  constraintSentence,
  headlineAvailable,
} from "@/components/ward-management/ward-board-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, Site, Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";
import { teamForRegion } from "@/components/ward-management/ward-teams";

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
  "under-2-weeks": styles.band1,
  "2-weeks-1-month": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

type Tile =
  | { kind: "occupied"; key: string; days: number; bandId: StayBandId | null; bandLabel: string; pastDate: boolean }
  | { kind: "waiting"; key: string }
  | { kind: "blocked"; key: string }
  | { kind: "held"; key: string }
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
 * A unit's beds divide into FOUR: **occupied** (including pulled — the ward gave the bed away and
 * the person may still be in an emergency department), **blocked** (out of service), **held**
 * (physically empty, but not yet confirmed as one the ward will actually offer), and **available**
 * — drawn on screen as the plain "empty" tile, because that is the bed a coordinator can fill
 * right now. Tiles are laid out occupied, then blocked, then held, then available, and
 * `occupied + blocked + held + available === unit.beds`.
 *
 * **The blocked tiles are the fix for a defect found by rendering this page and looking at it.**
 * The first pass knew only occupied and empty, so it drew `beds − occupied` empty tiles and every
 * out-of-service bed appeared as one a coordinator could fill. On `fsh-adult-secure` that put four
 * fillable-looking tiles under a header saying three beds free — both figures correct, and the
 * board contradicting itself on screen. No test caught it; `tests/ward-board-consistency.test.ts`
 * was written afterwards and pins the arithmetic across all 23 units.
 *
 * **The held tiles are the same class of fix, for a different unit.** On `rph-adult-secure` the
 * header already said "1 bed you can fill today" (`headlineAvailable`, `min(allocatable, empty)`
 * = `min(1, 2)`), but the first pass still drew BOTH physically-empty beds as plain "Empty" tiles —
 * the header and the grid disagreeing about how many beds a coordinator can actually take someone
 * to. **Held is not invented here**: `unitCapacity` (`ward-derivations.ts`) already partitions
 * every unit into `available + held + blocked + occupied === unit.beds`, and is the same function
 * `ward-screen.tsx` and `flow-diagram.tsx` read for their own "Held" figure — this board reads its
 * `held` count rather than re-deriving a second, possibly-drifting version of the same split.
 *
 * **Which tile is blocked or held is NOT knowable and is not invented.** `Unit.blocked` is a COUNT
 * and `unitCapacity`'s `held` is derived from two more counts (`unit.allocatable.value`,
 * `unit.empty.value`) — the model holds no per-bed record and no admission carries a bed number —
 * so these are drawn purely because they have to be drawn somewhere. The claim being made on
 * screen is "this many of this ward's beds are out of service" / "this many are empty but not yet
 * offered", which is exactly what the data supports, and nothing on either tile identifies a
 * particular bed. That is the same discipline the tiles already hold for bed numbering: `unit.beds`
 * tiles in a grid, none of them a bed anybody could name.
 *
 * The tiles carry NO bed identity: an `Admission` records the unit, never a bed number, so
 * numbering these "Bed 1..20" would invent an identity nothing in the model holds and a ward would
 * read it as real. They are a count of beds, in a grid, and nothing more.
 *
 * If a unit somehow holds more occupants than it has beds, every occupant is still drawn — the
 * over-count is the fact worth seeing, and truncating the list to `unit.beds` would hide exactly
 * the people a double-allocation put there. The blocked tiles are drawn in that case too: beds out
 * of service do not stop being out of service because the ward is over-full, and the held/available
 * counts floor at zero rather than going negative and cancelling them out.
 */
function buildTiles(unit: Unit, admissions: readonly Admission[], bedReleases: readonly BedRelease[], now: Instant): Tile[] {
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

  // Guarded against a negative or non-integer count in the fixture rather than trusted: a bad
  // `blocked` would otherwise either throw the loop or silently draw nothing.
  const blockedCount = Math.max(0, Math.floor(unit.blocked));
  for (let index = 0; index < blockedCount; index += 1) {
    tiles.push({ kind: "blocked", key: `blocked-${index}` });
  }

  // Derived by subtraction, NOT read from `unit.empty.value`. The two agree on every seeded unit
  // (that is what the consistency test pins), but the tiles must add up to the beds even if a
  // future feed disagrees with itself — a grid that silently drew a different number of tiles
  // than the ward has beds is a worse failure than one that shows the shortfall as empty.
  const emptyPoolCount = Math.max(0, unit.beds - occupants.length - blockedCount);

  // `unitCapacity`'s `held` comes from `unit.allocatable.value`/`unit.empty.value` directly, not
  // from this function's own admissions-derived `emptyPoolCount` above — so it is clamped into
  // that pool exactly as `blockedCount` already is, in case a future feed disagrees with itself.
  // A held count that overshot the physically-empty pool would otherwise draw more tiles than the
  // ward has beds, which is the same failure class `blockedCount`'s own guard exists to prevent.
  const heldCount = Math.max(0, Math.min(Math.floor(unitCapacity(unit, [...bedReleases]).held), emptyPoolCount));
  for (let index = 0; index < heldCount; index += 1) {
    tiles.push({ kind: "held", key: `held-${index}` });
  }

  const emptyCount = Math.max(0, emptyPoolCount - heldCount);
  for (let index = 0; index < emptyCount; index += 1) {
    tiles.push({ kind: "empty", key: `empty-${index}` });
  }
  return tiles;
}

export function WardBoard({ unitId }: { unitId: string }) {
  const found = findUnit(unitId);
  if (found === undefined) {
    // Task A: a "Ward not found" page with no `<ClinicalRail />` was a dead end — there was no way
    // back to anything else in Ward Flow from it. Every other dynamic-route screen mounts the rail
    // in BOTH its return branches (see `ed-screen.tsx`'s own not-found branch), and this one now
    // does too.
    return (
      <div className={styles.screen} data-testid="ward-board-unknown-unit">
        <ClinicalRail />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.unitName}>Ward not found</h1>
          <p className={styles.constraint}>No ward is recorded with the id “{unitId}”.</p>
        </main>
      </div>
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
  const tiles = buildTiles(unit, admissions, bedReleases, now);
  // Read straight back out, purely to say how many held tiles are on screen in the footnote below
  // — never re-derived. `buildTiles` already clamped this into the physically-empty pool; the
  // footnote must describe exactly what got drawn, not a second, unclamped copy of the figure.
  const heldTileCount = tiles.filter((tile) => tile.kind === "held").length;

  /*
   * Scoped to THIS unit with the same helper `buildTiles` uses, so the panel and the grid can
   * never disagree about who is in a bed.
   *
   * **Written first as `arrowTargets(admissions, now)` and caught by rendering the page, not by a
   * test.** `admissions` is the whole network's 267 records, so the panel read every ward in the
   * state: it offered "Kimberley 28 people" on a twenty-bed ward and totalled about 180 against
   * eighteen occupants. Nothing failed — `arrowTargets` was correct and its nine assertions still
   * passed, because the defect was in the CALL and every one of them supplies its own admissions.
   * A derivation's tests cannot see a caller handing it the wrong set.
   */
  const targets = arrowTargets(admissionsForUnit(admissions, unit.id), now);

  return (
    <div className={styles.screen} data-testid="ward-board">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
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
        {/* Listed beside the stay bands because a reader counting fillable beds needs to know
            this tile exists. The tile says so in words on its own face too — this is the index,
            not the explanation. */}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchBlocked}`} aria-hidden="true" />
          Out of service — not fillable
        </li>
        {/* Task B. Same reasoning as the blocked entry just above: the tile itself says "Held" in
            words, this is only the index. */}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchHeld}`} aria-hidden="true" />
          Empty, not yet offered — not fillable
        </li>
      </ul>

      <div className={styles.body}>
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
            {/* Rule 1 on screen for the third bed state: the words say it, not the fill. A
                coordinator reading this board in greyscale, in forced-colors, or on paper must
                still be able to tell an unfillable bed from a fillable one, and "Out of service"
                is what does that — the hatched fill only makes it quicker. */}
            {tile.kind === "blocked" && <span className={styles.blockedLabel}>Out of service</span>}
            {/* Task B on screen: physically empty, but not yet one of the beds this ward is
                offering — a different fact from "Empty" (fillable now) and from "Out of service"
                (never fillable today). The word is what makes it unambiguous; the dotted edge and
                dot pattern only make it quicker to spot. */}
            {tile.kind === "held" && <span className={styles.heldLabel}>Held</span>}
            {tile.kind === "empty" && <span className={styles.emptyLabel}>Empty</span>}
          </li>
        ))}
      </ol>

      {/*
       * WHERE THESE BEDS FREE UP TO — the right-hand panel, from `arrowTargets`, which existed
       * fully tested with zero consumers until now. Checked before building on it rather than
       * assumed: nine references in `tests/ward-board-derivations.test.ts`, none anywhere in `src`.
       * That is the module-contract-awaiting-a-consumer case AGENTS.md distinguishes from debris,
       * and this is the consumer.
       *
       * **There are deliberately no drawn arrows, and that is a correctness decision rather than a
       * simplification.** Connector geometry on the coordinator's diagrams is measured in
       * JavaScript from the live screen layout and never re-measured for print, so a printed route
       * line points at whichever ward has since moved under it — proven on paper this session, and
       * the reason those connectors are now hidden in print entirely. Drawing eighteen bed-to-region
       * arrows would import that failure and add a spaghetti of lines nobody can follow. The
       * connection is carried by a shared REGION NAME on both sides instead: the tile says where
       * its occupant is going, this panel says who is expecting them. Words survive greyscale, a
       * stripped-background print and forced-colors; measured coordinates survive none of it.
       *
       * Scoped to `ARROW_HORIZON_DAYS`, so this is a short list a flow meeting can read, not a
       * second copy of the bed list. Someone with no expected date is absent entirely rather than
       * defaulted — nobody has said when they are leaving, so the board says nothing.
       */}
      {targets.length > 0 && (
        <aside className={styles.destinations} aria-labelledby="ward-board-destinations-heading">
          <h2 id="ward-board-destinations-heading" className={styles.destinationsHeading}>
            Where these beds free up to
          </h2>
          <p className={styles.destinationsIntro}>
            Expected within {ARROW_HORIZON_DAYS} days, soonest first.
          </p>
          <ol className={styles.destinationList} data-testid="ward-board-destinations">
            {targets.map((target) => {
              const team = teamForRegion(target.region);
              return (
                <li
                  key={target.region}
                  className={styles.destination}
                  data-testid={`ward-board-destination-${target.region}`}
                >
                  <p className={styles.destinationRegion}>{target.region}</p>
                  <p className={styles.destinationCount}>
                    {target.count} {target.count === 1 ? "person" : "people"}
                    {" · "}
                    {target.nearestDays === 0
                      ? "soonest due now or overdue"
                      : `soonest in ${target.nearestDays} day${target.nearestDays === 1 ? "" : "s"}`}
                  </p>
                  {/* `teamForRegion` returns null for a region with no recorded team rather than a
                      placeholder string, so a missing team reads as absent instead of as a team
                      called "Unknown" that somebody might try to telephone. */}
                  {team !== null && <p className={styles.destinationTeam}>{team}</p>}
                </li>
              );
            })}
          </ol>
        </aside>
      )}
      </div>

      <p className={styles.footnote} data-testid="ward-board-footnote">
        {tiles.length} tile{tiles.length === 1 ? "" : "s"}, one per recorded bed. A tile carries no bed number — an
        admission records the ward it is on, never a bed. “Empty, waiting” is a bed this ward has already given away to
        somebody who has not arrived yet; it is taken, not free.
        {/* Only said on a ward that HAS one. Rendered unconditionally it read "this ward records 0
            of them, and which particular beds are out of service is not recorded" — a paragraph
            explaining, at length, a tile the reader cannot see and this ward does not have. Found
            by rendering `rph-adult-secure`, which has no blocked beds, not by looking at `fsh`
            where the sentence happened to make sense. */}
        {unit.blocked > 0 && (
          <>
            {" "}
            “Out of service” beds cannot be filled either — this ward records {unit.blocked} of them, and which
            particular {unit.blocked === 1 ? "bed is" : "beds are"} out of service is not recorded, so the tiles marked
            here are a count and not a location.
          </>
        )}
        {/* Task B, same "only said on a ward that HAS one" discipline as the blocked sentence just
            above — `rph-adult-secure` has one held bed, `fsh-adult-secure` has none, and this ward
            board must not describe a tile the reader cannot see. `heldTileCount` is what was
            actually drawn (already clamped into the physically-empty pool), never the raw,
            unclamped `unitCapacity(...).held` figure — the footnote must describe the screen, not
            a number that could disagree with it. */}
        {heldTileCount > 0 && (
          <>
            {" "}
            “Held” beds are empty but not yet confirmed as ones this ward will offer — this ward has {heldTileCount} of
            them right now, and which particular {heldTileCount === 1 ? "bed is" : "beds are"} held is not recorded, so
            the tiles marked here are a count and not a location.
          </>
        )}
      </p>
      </main>
    </div>
  );
}

/**
 * An EXHAUSTIVE switch on `tile.kind`, not a chain of early returns ending in the occupied case as
 * the fall-through — which is how the blocked tile was broken the moment it was added.
 *
 * The chain read `if empty … if waiting … otherwise treat it as occupied`, so the new third kind
 * silently took the occupied branch, read a `bandId` it does not have, and rendered with the class
 * name `"undefined"` and an occupied fill. **Nothing failed.** `"undefined"` is a legal class name
 * that matches no rule, the tile still drew, and it drew in a plausible-looking colour. It was
 * found by sampling the rendered background of every tile kind on the page — not by a test, and
 * not by reading the diff, where the missing branch is an absence rather than a mistake.
 *
 * The `never` binding below is the guard against the next kind: adding a fifth `Tile` variant and
 * forgetting this function becomes a compile error instead of another silently mis-styled tile.
 */
function tileClassName(tile: Tile): string {
  switch (tile.kind) {
    case "empty":
      return `${styles.bed} ${styles.bedEmpty}`;
    case "waiting":
      return `${styles.bed} ${styles.bedWaiting}`;
    case "blocked":
      return `${styles.bed} ${styles.bedBlocked}`;
    case "held":
      return `${styles.bed} ${styles.bedHeld}`;
    case "occupied": {
      const band = tile.bandId === null ? "" : ` ${BAND_CLASS[tile.bandId]}`;
      const past = tile.pastDate ? ` ${styles.bedPast}` : "";
      return `${styles.bed} ${styles.bedOccupied}${band}${past}`;
    }
    default: {
      // Unreachable while the switch is exhaustive; a new variant fails to assign here.
      const unhandled: never = tile;
      throw new Error(`Unhandled ward-board tile kind: ${JSON.stringify(unhandled)}`);
    }
  }
}
