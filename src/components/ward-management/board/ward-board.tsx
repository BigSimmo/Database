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
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, HomeRegion, Sex, Site, Unit } from "@/components/ward-management/ward-model";
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

/**
 * One person in one of this ward's beds, as the right-hand panel states them.
 *
 * Every field is copied from the `Admission` or derived from it by an existing helper. Nothing
 * here is looked up, defaulted, or filled in: an absent fact arrives as `null` and is RENDERED as
 * absent, which is the same discipline `isPastExpectedDischarge` and `derivedBedReleases` already
 * hold to a few files away.
 */
type Occupant = {
  key: string;
  /** Whole days in the bed, or `null` for a bed given away to somebody who has not arrived. */
  days: number | null;
  /** The stay band's own label, or `null` when there is no stay to band. */
  bandLabel: string | null;
  pastDate: boolean;
  sex: Sex;
  homeRegion: HomeRegion;
  /** Whole days from `now` to the ward's own expected date — NEGATIVE when it has passed, `null`
   *  when nobody has set one. */
  expectedDays: number | null;
  dischargeDateMoves: number;
  dischargeDateSetBy: string | null;
  confirmed: boolean;
  dischargeConfirmedBy: string | null;
  blockReason: string | null;
};

/** The expected date, or `null` for both of the ways it can be missing — unset, and unusable.
 *  A non-finite instant is exactly as absent as a null one; neither may become a date on screen. */
function expectedInstant(admission: Admission): Instant | null {
  const expected = admission.expectedDischargeAt;
  return expected === null || !Number.isFinite(expected) ? null : expected;
}

/**
 * Whole days from `now` to the ward's own expected date, or `null` when there is none.
 *
 * The same `Math.floor((expected - now) / MINUTES_PER_DAY)` `arrowTargets` uses, deliberately
 * WITHOUT its floor at zero. That floor is right there — the destinations panel groups people by
 * how soon the nearest one leaves, and a negative "soonest" is meaningless in an ordering — and it
 * would be wrong here, where the sign is the fact: this panel distinguishes a date still ahead
 * from one already passed, and clamping would silently present every passed date as "under a day
 * away". The two panels therefore agree on magnitude and differ only where they are documented to.
 */
function daysUntilExpected(admission: Admission, now: Instant): number | null {
  const expected = expectedInstant(admission);
  if (expected === null || !Number.isFinite(now)) return null;
  return Math.floor((expected - now) / MINUTES_PER_DAY);
}

/**
 * Who is in this ward's beds, soonest expected out first.
 *
 * **Scoped with `admissionsForUnit(admissions, unit.id)` and filtered with `bedIsOccupied` — the
 * same two calls `buildTiles` makes**, so the panel and the grid are looking at one set of people
 * and can never disagree about who is in a bed. That is not a stylistic preference: the sibling
 * destinations panel shipped earlier today reading `admissions` unscoped, and offered "Kimberley
 * 28 people" on a twenty-bed ward. Its derivation was correct and all nine of its assertions
 * passed; the defect was in the CALL, where no test of that derivation could see it. The check
 * that catches this class is arithmetic a ward can do in its head — these rows plus the empty,
 * held and out-of-service tiles must equal `unit.beds` — and the new suite asserts exactly that.
 *
 * `bedIsOccupied` includes `"pulled"`, so a bed given away to somebody still in an emergency
 * department appears here with no stay rather than being dropped: they hold one of the ward's beds
 * and the grid already draws them.
 *
 * Ordering is total and deterministic — expected date ascending, anyone with no date last, then by
 * id. Ordering by id on a tie is arbitrary but STABLE, which is what the panel needs: two renders
 * of the same fixture must not reshuffle. A passed date sorts to the top on its own, because its
 * instant is the smallest, which is where a flow meeting wants it.
 */
function buildOccupants(unit: Unit, admissions: readonly Admission[], now: Instant): Occupant[] {
  const inBeds = admissionsForUnit(admissions, unit.id).filter(bedIsOccupied);

  return [...inBeds]
    .sort((a, b) => {
      const aAt = expectedInstant(a);
      const bAt = expectedInstant(b);
      if (aAt !== null && bAt !== null && aAt !== bAt) return aAt - bAt;
      if (aAt === null && bAt !== null) return 1;
      if (aAt !== null && bAt === null) return -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((admission) => ({
      key: admission.id,
      days: daysInBed(admission, now),
      bandLabel: stayBand(admission, now)?.label ?? null,
      pastDate: isPastExpectedDischarge(admission, now),
      sex: admission.sex,
      homeRegion: admission.homeRegion,
      expectedDays: daysUntilExpected(admission, now),
      dischargeDateMoves: admission.dischargeDateMoves,
      dischargeDateSetBy: admission.dischargeDateSetBy,
      // Read as a decision that was TAKEN, never inferred from how close the date is, how long ago
      // it was set, or how often it moved — `ward-discharge-dates.ts` records at length why each
      // of those proxies renders a ward decision nobody made. A non-finite instant is not a
      // decision either, so it degrades to unconfirmed rather than to a confirmation at `NaN`.
      confirmed: admission.dischargeConfirmedAt !== null && Number.isFinite(admission.dischargeConfirmedAt),
      dischargeConfirmedBy: admission.dischargeConfirmedBy,
      blockReason: admission.blockReason,
    }));
}

/** The expected date in words. Never a calendar date: the model holds instants on a synthetic
 *  operating day and no calendar at all, so a printed "14 March" would be invented. */
function expectedPhrase(expectedDays: number | null): string {
  if (expectedDays === null) return "No expected date set";
  // Sign, not magnitude, is what changes the sentence — see `daysUntilExpected` on why the zero
  // floor `arrowTargets` applies would be wrong here.
  if (expectedDays < 0) {
    const past = -expectedDays;
    return `${past} day${past === 1 ? "" : "s"} past the ward's expected date`;
  }
  // Floors to 0 for anything inside the next day. "Within a day" rather than "today": the model
  // has no calendar, so it cannot say which day anything falls on.
  if (expectedDays === 0) return "Expected out within a day";
  return `Expected out in ${expectedDays} day${expectedDays === 1 ? "" : "s"}`;
}

/** How many times the WARD moved its own plan. Never a measure of the person — `dischargeDateMoves`
 *  says the plan kept changing, and this sentence must not be readable as saying anybody was slow.
 *  Guarded against a negative or non-integer count rather than trusted, the same way `unit.blocked`
 *  is guarded in `buildTiles`. */
function movesPhrase(moves: number): string {
  if (!Number.isFinite(moves) || moves < 1) return "not moved since";
  const whole = Math.floor(moves);
  if (whole === 1) return "moved once since";
  if (whole === 2) return "moved twice since";
  return `moved ${whole} times since`;
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
  /* Scoped inside `buildOccupants` with the same `admissionsForUnit(...)` + `bedIsOccupied` pair
   * `buildTiles` uses — see that function's own comment for the defect this prevents. */
  const occupants = buildOccupants(unit, admissions, now);

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

      {/*
       * WHO IS IN THESE BEDS — the far-right panel the product owner asked for, as a LIST of the
       * ward's occupants rather than a detail panel for a tile a reader selects.
       *
       * **Selectable tiles were the obvious build and are refused, on this file's own grounds.**
       * The tiles are deliberately anonymous: `buildTiles`' comment says a tile "carries NO bed
       * identity" and the footnote says so on screen, because an `Admission` records the ward it is
       * on and never a bed. Making a tile clickable hands it exactly the identity that whole
       * discipline exists to withhold — the fifth tile along becomes the handle for a particular
       * person, two readers of the same board say "the third one on row two", and the grid's order
       * is seed order rather than any ward's floor plan, so the locator they have agreed on means
       * nothing. Three separate facts in this file are already recorded as unknowable per bed
       * (which bed is blocked, which is held, which bed anybody is in); selection would quietly
       * assert the third.
       *
       * Two further costs, neither of them the reason but both real. A printed sheet would carry
       * the detail of whichever person the reader last clicked and nothing about the other
       * seventeen — a sheet whose content depends on an interaction that left no mark on it. And
       * `globals.css`'s print reset carries `header, nav, button { display: none !important }`, so
       * every tile would vanish from paper unless restored — the defect this branch has now fixed
       * on three surfaces.
       *
       * **What makes a second reading of the same people earn its place:** the grid answers "how
       * full is this ward and how long are the stays", spatially and at a glance, and it has room
       * for exactly one number per person. This panel is the only place the ward's DISCHARGE PLAN
       * appears at all — when each person is expected out, who set that date, how many times it has
       * moved, whether the ward has confirmed it, and what is holding it up. None of that fits on a
       * 5rem tile, and none of it is in the destinations panel above, which aggregates by region
       * over a seven-day horizon and says nothing about any individual. Three different questions,
       * three panels, and this is the only one that is per-person.
       *
       * **There is no diagnosis and no placeholder for one.** `Admission` cannot express one
       * (`ward-admissions.ts`, rule 3 — an owner decision, pinned structurally by
       * `tests/ward-admission-model.test.ts`), so the panel says so in one line and shows nothing.
       * A greyed "Diagnosis: —" row would be a field a ward would expect to be filled in later.
       */}
      <aside className={styles.people} aria-labelledby="ward-board-people-heading">
        <h2 id="ward-board-people-heading" className={styles.peopleHeading}>
          Who is in these beds
        </h2>
        {/* Both figures on one line ON PURPOSE. A per-person panel fed the wrong collection is
            this feature's most recently shipped defect, and it is invisible in a list — but
            "28 people" beside "20 beds" is arithmetic a ward does without thinking. The count is
            the rendered rows, so the sentence cannot describe a different list from the one below
            it. */}
        <p className={styles.peopleIntro} data-testid="ward-board-people-count">
          {occupants.length} of this ward&apos;s {unit.beds} bed{unit.beds === 1 ? "" : "s"}{" "}
          {occupants.length === 1 ? "is" : "are"} taken. Soonest expected out first; anyone with no date set is last.
        </p>
        {/* The one honest line about the absence, and the whole of it. It states what the record
            holds, not what a future record might hold — nothing here is a field awaiting content. */}
        <p className={styles.peopleAbsence}>No diagnosis is shown: this record does not hold one.</p>
        {/* An empty list under a heading reads as a panel that failed to load rather than as a ward
            with nobody in it, so the absence is said in words. `constraintSentence` returns null for
            the same reason a few lines up. */}
        {occupants.length === 0 && <p className={styles.personLine}>Nobody is recorded in a bed on this ward.</p>}
        <ol className={styles.peopleList} data-testid="ward-board-people">
          {occupants.map((occupant) => (
            <li key={occupant.key} className={styles.person} data-testid={`ward-board-person-${occupant.key}`}>
              <p className={styles.personStay}>
                {occupant.days === null ? (
                  /* Rule 2 again, in the panel: the bed is gone, the stay has not started. Never a
                     zero-day stay, which would present somebody as newly arrived somewhere they
                     have not reached. */
                  <span className={styles.personNoStay}>No stay yet — not arrived</span>
                ) : (
                  <>
                    <span className={styles.personDays} data-testid={`ward-board-person-${occupant.key}-days`}>
                      {occupant.days} day{occupant.days === 1 ? "" : "s"}
                    </span>
                    {/* The band in words, unlike the tile — a tile has no room for it and prints
                        the number instead, but this panel does, and the words are what survive a
                        greyscale sheet. `null` only where there is no stay to band. */}
                    {occupant.bandLabel !== null && <span className={styles.personBand}>{occupant.bandLabel}</span>}
                  </>
                )}
                {occupant.pastDate && <span className={styles.pastMark}>Past date</span>}
              </p>
              <p className={styles.personWho}>
                {occupant.sex}, from {occupant.homeRegion}
              </p>
              <p className={styles.personExpected}>{expectedPhrase(occupant.expectedDays)}</p>
              {/* Provenance only where there IS a date. With none, "set by nobody, never moved"
                  would describe a plan that does not exist. */}
              {occupant.expectedDays !== null && (
                <p className={styles.personLine}>
                  {occupant.dischargeDateSetBy !== null
                    ? `Date set by ${occupant.dischargeDateSetBy}`
                    : "Date set — the role that set it is not recorded"}
                  , and {movesPhrase(occupant.dischargeDateMoves)}.{" "}
                  {/* Confirmed and unconfirmed are BOTH stated, because the difference is the
                      point: a plan the ward may revise, against a decision it has taken. Silence
                      for the unconfirmed case would leave a reader unable to tell "not decided"
                      from "not displayed". "Not yet its decision" never reads as a refusal — an
                      unset `dischargeConfirmedAt` means nobody has decided, never that anybody
                      declined. */}
                  {occupant.confirmed
                    ? occupant.dischargeConfirmedBy !== null
                      ? `Confirmed by ${occupant.dischargeConfirmedBy} — a decision, not a plan.`
                      : "Confirmed — a decision, not a plan; the role that confirmed it is not recorded."
                    : "Not confirmed — the ward's plan, not yet its decision."}
                </p>
              )}
              {/* Drawn from `BED_RELEASE_BLOCKERS` — the owner's list, about the BED, never about
                  the person. Absent when nothing is recorded, and an absent blocker is silence:
                  it never renders as "nothing outstanding", which would be a ward's finding rather
                  than this panel's ignorance. Same distinction `derivedBedReleases` draws for
                  `waitingOn`. */}
              {occupant.blockReason !== null && (
                <p className={styles.personBlocker}>Held up by: {occupant.blockReason}.</p>
              )}
            </li>
          ))}
        </ol>
      </aside>
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
