"use client";

import Link from "next/link";

import type { CapacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, LeaveBed, Referral, Site, Unit } from "@/components/ward-management/ward-model";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
  morningHandoverInstant,
  peopleWaitingCount,
  PEOPLE_WAITING_LABEL,
  serviceRollup,
  type CapacityRollup,
  type RollupFreshness,
  type ServiceRollup,
  type SiteRollup,
  type UnitRollup,
} from "@/components/ward-management/ward-morning-rollup";
import { wardSites } from "@/components/ward-management/ward-sites";

import styles from "./morning.module.css";

/** Every figure key, in the ONE order `CAPACITY_FIGURE_LABELS` declares them — never a
 *  hand-typed second list, so a future reordering of that constant reorders the page too rather
 *  than silently drifting out of sync with it (spec D14). */
const ALL_FIGURE_KEYS = Object.keys(CAPACITY_FIGURE_LABELS) as (keyof typeof CAPACITY_FIGURE_LABELS)[];
const REMAINING_FIGURE_KEYS = ALL_FIGURE_KEYS.filter((key) => key !== "availableNow");

export type MorningView = "fixed" | "live";

/** What the fixed view freezes at open: the 08:00 handover instant (or `null` when it has not
 *  happened yet for this operating day) plus the whole `ServiceRollup` computed at that instant —
 *  never merely the instant. See the doc comment on `MorningPage` for why both must be frozen
 *  together. Exported so a test can hand-author a `null`-instant value directly (see
 *  `MorningBody`'s own doc comment) without depending on the live provider clock ever actually
 *  falling before 08:00. */
export type FrozenMorning = {
  instant: Instant | null;
  rollup: ServiceRollup | null;
  /** Task 9's demand figure, frozen with the rollup rather than beside it. Deliberately follows
   *  the SAME null propagation: when handover has not happened yet the fixed view shows no figure
   *  at all, and a people-waiting count left standing alone under a null rollup would be the one
   *  number on a page that is otherwise refusing to state any. Never merged into `rollup` — see
   *  `peopleWaitingCount`'s own doc comment in `ward-morning-rollup.ts` for why it is kept outside
   *  the `CapacityRollup` shape entirely. */
  peopleWaiting: number | null;
};

/**
 * The freeze computation itself, pulled out as a pure function so it can be unit-tested directly
 * against an arbitrary `now` — including one before 08:00 — without depending on
 * `WardFlowProvider`'s live clock. `MorningPage`'s `useState` initialiser below calls this once,
 * closing over a single read of `useWardFlow()`; nothing else may call it again.
 *
 * Never a silent fall back to `now`: when handover has not happened yet, `instant` is `null` and
 * the frozen rollup stays `null` too — the fixed view then renders no figures at all rather than
 * a rollup computed at the wrong instant (spec D5).
 */
export function buildFrozenMorning(
  now: Instant,
  sites: Site[],
  units: Unit[],
  releases: BedRelease[],
  leave: LeaveBed[],
  referrals: Referral[],
): FrozenMorning {
  const instant = morningHandoverInstant(now);
  return {
    instant,
    rollup: instant === null ? null : serviceRollup(sites, units, releases, leave, instant),
    peopleWaiting: instant === null ? null : peopleWaitingCount(referrals),
  };
}

/**
 * Task 2 (Phase 6). The morning bed state: one page, frozen to the 08:00 handover, five figures
 * in one vocabulary, network-wide down to hospital down to ward.
 *
 * THE FREEZE MUST BE REAL — exactly the mechanism `handover/handover-page.tsx` uses and explains
 * in its own doc comment. `serviceRollup` is a pure derivation of `now`; called again later it
 * would happily compute a different answer, so what makes the fixed view a *snapshot* rather than
 * just another live view is that `useWardFlow()` is read once and the `useState` initialiser below
 * closes over that single read. A `useState` initialiser runs exactly once, on the first render,
 * and never again — that is the whole mechanism (controller ruling R1, spec D5). Nothing in the
 * fixed view reads `now`, `units`, `bedReleases` or `leaveBeds` from `useWardFlow()` again after
 * this initialiser; only `frozen.instant` and `frozen.rollup`, which cannot change for the
 * lifetime of this mount.
 *
 * The live view is the opposite on purpose: `liveRollup` below is recomputed from
 * `serviceRollup(...)` at the live `now` on every render, exactly like `DischargeBoard` — there is
 * nothing here a coordinator needs held still while chasing a live bed.
 *
 * What this means for a coordinator, stated in the page itself (not just this comment): the fixed
 * view is a snapshot taken when the page was opened, read against the 08:00 handover clock. This
 * prototype keeps no event history, so that snapshot is NOT a reconstruction of what the ward
 * state actually was at 08:00 — it is whatever the figures happened to be at the moment this page
 * was opened, labelled against the handover clock. The live view is the one that moves.
 *
 * This page computes no figure of its own: every number below is a field of a `CapacityBreakdown`
 * or `CapacityRollup` produced by Task 1's `ward-morning-rollup.ts`. If a figure needs new
 * arithmetic, it belongs there, not here.
 */
export function MorningPage() {
  const { units, bedReleases, leaveBeds, referrals, now } = useWardFlow();

  // ONE VIEW, ALWAYS LIVE (WB-DB-11, owner decision). Recomputed from the live `now` on every
  // render, never frozen.
  const liveRollup = serviceRollup(wardSites, units, bedReleases, leaveBeds, now);
  const livePeopleWaiting = peopleWaitingCount(referrals);

  return (
    <div className={styles.screen} data-testid="ward-morning-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        {/*
         * THE GUIDED TOUR IS PAUSED, NOT REMOVED - owner instruction 2026-08-30: "pause the guided
         * tour for now as the app is not built. That should be done last."
         *
         * `MorningTour` is deliberately not rendered here. Its file, its beats and its tests stay
         * exactly where they are, because a tour of a half-built application teaches the wrong
         * thing and a tour deleted for being inconvenient is a feature that disappears with nobody
         * deciding it should. It comes back when the application it describes exists.
         *
         * Pausing it is not a display change. The tour DISPATCHES - `RESET_SCENARIO`, real accepts,
         * real declines, straight through the live reducer - so "paused" has to mean it emits
         * nothing, and `tests/ward-morning-tour-paused.test.ts` asserts exactly that rather than
         * trusting this comment. That test is the thing somebody must deliberately remove when the
         * tour is switched back on, which makes un-pausing a decision rather than an edit.
         */}
        <MorningBody liveRollup={liveRollup} liveNow={now} livePeopleWaiting={livePeopleWaiting} />
      </main>
    </div>
  );
}

/**
 * The whole page below the rail, as a pure function of props rather than of `useWardFlow()`
 * directly. Pulled out of `MorningPage` for two reasons: it lets a test drive the null-handover
 * failure branch (`frozen.instant === null`) with a hand-authored `frozen` value instead of
 * needing the provider's live clock to genuinely fall before 08:00 (mirrors how
 * `handover-page.tsx`'s exported sections take a synthetic `HandoverSnapshot` directly); and it
 * is the clean seam Task 3's guided tour needs — mounting a tour and driving `onChangeView("live")`
 * from outside does not require reaching back into `MorningPage`'s own state.
 */
export function MorningBody({
  liveRollup,
  liveNow,
  livePeopleWaiting,
}: {
  liveRollup: ServiceRollup;
  liveNow: Instant;
  livePeopleWaiting: number;
}) {
  return (
    <>
      <GovernanceBanner />

      {/* Print-only: which view produced this sheet, and its instant (C2). Deliberately a
          sibling of `ViewControl`, not a descendant — `.viewControl` is fully hidden in print
          (it holds the two interactive buttons), so anything that must survive into print has to
          live outside it. */}
      <PrintViewMeta liveNow={liveNow} />

      {liveRollup && (
        <>
          {/* Task 9: the demand figure sits BESIDE the headline, never inside it (spec D2).
              `.headlineRow` is a layout wrapper only — it places two independent sections side
              by side and performs no arithmetic across them. */}
          <div className={styles.headlineRow}>
            <HeadlineFigure rollup={liveRollup.service} now={liveNow} />
            <PeopleWaitingFigure count={livePeopleWaiting} />
          </div>
          <RemainingFigures rollup={liveRollup.service} />
          <ExcludedBeyondTonight count={liveRollup.service.excludedBeyondToday} />

          <UnplacedUnitsNote unplacedUnitIds={liveRollup.unplacedUnitIds} />
          <div className={styles.siteList} data-testid="ward-morning-sites">
            {liveRollup.sites.map((siteRollup) => (
              <SiteBlock key={siteRollup.site.code} siteRollup={siteRollup} now={liveNow} />
            ))}
          </div>
        </>
      )}

      <PrintFooter />
    </>
  );
}

/**
 * C2 fix pass. The `.viewControl` print rule (`morning.module.css`) hides the fixed/live buttons
 * AND the explainer paragraph together — both are interactive-adjacent chrome with no place on a
 * printed sheet. But that left a printed sheet with no statement of which view produced it or
 * when: a sheet printed from the live view was byte-identical to one printed from the frozen
 * 08:00 handover, exactly the hazard spec D6 names ("the danger is not that someone opens the
 * live view; it is that someone screenshots it and calls it the morning number").
 *
 * Screen-hidden, print-only (`.printViewMeta` in `morning.module.css`): a sibling of
 * `ViewControl`, so it survives `.viewControl { display: none !important }` untouched. Carries
 * two facts, in the page's own established language:
 * 1. Which view, and its instant — the exact fact a printed sheet could not previously state.
 * 2. A condensed form of `ViewControl`'s own on-screen explainer, so the printed sheet still
 *    carries the page's one honest caveat about the fixed view (a snapshot at open, not a
 *    reconstruction of 08:00) rather than losing it entirely along with the buttons.
 */
function PrintViewMeta({ liveNow }: { liveNow: Instant }) {
  return (
    <div className={styles.printViewMeta} data-testid="ward-morning-print-meta">
      <p className={styles.printViewLabel} data-testid="ward-morning-print-view-label">
        {`This sheet: printed ${formatInstant(liveNow)}.`}
      </p>
      {/*
       * WHY THE TIME IS ON THE SHEET AT ALL, and prominently.
       *
       * This used to say which of two views produced the sheet, and label a frozen one against the
       * 08:00 handover clock. The owner removed that on 2026-08-30: "There is no point of a stale
       * handover. Remove it and make the print out live from whatever time." He is right that the
       * frozen sheet was the worse artefact - it claimed a reconstruction of 08:00 that this
       * prototype cannot make, since it holds no event history and the snapshot was taken whenever
       * the page happened to be opened.
       *
       * But a printed sheet is stale the moment it leaves the printer whatever it says. Removing
       * the label without replacing it would swap a time that was wrong for no time at all, and a
       * sheet with no time on it is the one nobody can tell is old. So it now says the moment it
       * was actually printed, which is the only claim a sheet can make and keep.
       */}
      <p className={styles.printViewNote} data-testid="ward-morning-print-view-note">
        Printed from the live view. Every figure is as at the time above and nothing on this sheet updates once it is
        printed — a printed sheet is a moment, not a monitor.
      </p>
      {/*
       * WB-DB-10's change notice, and it exists because a timestamp is not one. A stamp says WHEN a
       * sheet was taken; it never says BY WHAT RULE, so a definitional change reads as ordinary
       * variation between two correctly-stamped sheets and nobody can tell that the number moved for
       * a reason. This sentence is the only artefact that says why, and it is dated so it can be
       * removed on evidence rather than on a feeling that enough time has passed.
       */}
      <p className={styles.printViewNote} data-testid="ward-morning-definition-change">
        <strong>Definition changed 30 August 2026.</strong> Beds expected free are now counted over a rolling
        twenty-four hours with tomorrow shown separately, rather than stopping at the end of the evening shift. Figures
        on this sheet are higher than on a sheet printed before that date, and the difference is the rule rather than
        the ward. Remove this notice once sheets printed under the old rule are no longer in circulation.
      </p>
    </div>
  );
}

function GovernanceBanner() {
  return (
    <div className={styles.governanceBanner} data-testid="ward-morning-governance">
      <span className={styles.prototypeBadge}>Synthetic prototype</span>
      <p>
        This page is <strong>not a medical device</strong>. It shows only the bed-availability figures a ward has
        recorded, rolled up to hospital and network level, and it never adds a predicted, confirmed-but-unreleased or
        leave bed into &quot;available now&quot;.
      </p>
    </div>
  );
}

export function NoHandoverYet({ onSwitchToLive }: { onSwitchToLive: () => void }) {
  return (
    <div className={styles.noHandover} data-testid="ward-morning-no-handover">
      {/*
       * Review finding M5: this page's only <h1> lives in `HeadlineFigure`, which renders inside
       * the `!noHandoverYet && activeRollup` branch — so in THIS branch the page had no <h1> at
       * all. It is reachable through the demo control mounted on every ward screen:
       * `morningHandoverInstant` returns null once `now` passes into the next operating day
       * before 08:00, about fourteen "+1 hour" presses from `NOW_ANCHOR`. The landmark suite
       * renders `MorningPage` at `NOW_ANCHOR` only, where the other branch always wins.
       *
       * The two branches are mutually exclusive, so exactly one <h1> renders either way — and a
       * second here would be as much a defect as none (`tests/ward-landmarks.test.ts`). The text
       * is the page's own name (`ward-nav.ts`'s "Morning bed state"), never the headline's "Beds
       * available right now", which would title a screen showing no bed figure at all.
       */}
      <h1 className={styles.noHandoverTitle}>Morning bed state</h1>
      <p>The 08:00 handover has not been taken for this day.</p>
      <button type="button" className={styles.noHandoverButton} onClick={onSwitchToLive}>
        Show the live view instead
      </button>
    </div>
  );
}

/** The one place this page's roll-up COUNT wording lives — "N of M wards confirmed". No
 *  `WardFreshness` rendering here: `RollupFreshness` has no `confirmedByRole` (a roll-up spans
 *  many wards, not one), so the count itself stays a bespoke renderer. `"never"` always reads
 *  "Never confirmed", literally, never a `0` (failure branch). See `FreshnessLine` below for the
 *  INSTANT this count is paired with (I2 fix pass) — that part does reuse `WardFreshness`. */
export function rollupFreshnessLabel(freshness: RollupFreshness): string {
  if (freshness.kind === "never") return "Never confirmed";
  const { unitsConfirmed, unitsTotal } = freshness;
  const neverConfirmed = unitsTotal - unitsConfirmed;
  const base = `${unitsConfirmed} of ${unitsTotal} ward${unitsTotal === 1 ? "" : "s"} confirmed`;
  return neverConfirmed > 0 ? `${base} · ${neverConfirmed} never confirmed` : base;
}

export function FreshnessStamp({ freshness }: { freshness: RollupFreshness }) {
  return <span className={styles.freshness}>{rollupFreshnessLabel(freshness)}</span>;
}

/**
 * I2 fix pass. `oldestConfirmedAt` (`ward-morning-rollup.ts`, mutation-tested) was computed but
 * rendered nowhere — `FreshnessStamp` alone only ever states a COUNT ("22 of 22 wards
 * confirmed"), never the actual instant. Spec D4's central rule is that a roll-up's freshness is
 * its OLDEST contributing confirmation, and spec D6 requires every figure group to carry its own
 * instant — neither was visible.
 *
 * Reuses the existing `WardFreshness` component (`ward-freshness.tsx`) for the instant, rather
 * than inventing a second freshness vocabulary: its "`confirmedAt` present, `confirmedByRole`
 * absent → 'Confirmed <time>'" branch (added this pass) is exactly a group-level freshness's
 * shape — a rollup has an oldest confirming instant but no single confirming role. `now` is
 * passed through only to satisfy `WardFreshness`'s prop contract; `derived` is never set here, so
 * it is not read on this path (`WardFreshness`'s own doc comment on that branch order).
 *
 * Skips `WardFreshness` entirely when nothing has ever been confirmed (`kind === "never"`):
 * `FreshnessStamp` already renders "Never confirmed" for that case, and rendering it a second
 * time from `WardFreshness` alongside it would be a duplicate claim, not a new fact.
 */
export function FreshnessLine({ freshness, now }: { freshness: RollupFreshness; now: Instant }) {
  return (
    <span className={styles.freshnessLine}>
      <FreshnessStamp freshness={freshness} />
      {freshness.kind !== "never" && <WardFreshness confirmedAt={freshness.oldestConfirmedAt} now={now} />}
    </span>
  );
}

export function HeadlineFigure({ rollup, now }: { rollup: CapacityRollup; now: Instant }) {
  return (
    <section className={styles.headline} data-testid="ward-morning-headline">
      <h1 className={styles.headlineTitle}>Beds available right now</h1>
      <p className={styles.headlineNumber} data-testid="ward-morning-figure-service-availableNow">
        <span className={styles.headlineValue}>{rollup.availableNow}</span>
        <span className={styles.headlineLabel}>{CAPACITY_FIGURE_LABELS.availableNow}</span>
      </p>
      <FreshnessLine freshness={rollup.freshness} now={now} />
    </section>
  );
}

/**
 * Task 9 (product owner, 2026-08-28). How many people are currently waiting for a bed, beside the
 * headline that says how many beds there are.
 *
 * **It is beside the headline, never in it.** Spec D2 is that "beds available right now" is the
 * sum of `availableNow` and nothing else, and that rule is not weakened by a demand figure sharing
 * a row with it. This component receives a plain `count` and renders it; it never sees the
 * headline's number, so it cannot add to it or subtract from it.
 *
 * **The page prints no shortfall.** Two numbers a reader can subtract for themselves is honest.
 * A subtraction this page performed would be a claim that the gap between them means something —
 * a claim nobody has validated, on a prototype built on an unvalidated bed model. So the note
 * below states the two figures sit side by side and stops there.
 *
 * The count itself comes from `peopleWaitingCount` (`ward-morning-rollup.ts`), which is the length
 * of `referralQueueOrder`'s own list — the very list the referral board renders. This page
 * computes no figure of its own (spec D1).
 */
function PeopleWaitingFigure({ count }: { count: number }) {
  return (
    <section className={styles.peopleWaiting} data-testid="ward-morning-people-waiting">
      <h2 className={styles.peopleWaitingTitle}>{PEOPLE_WAITING_LABEL}</h2>
      <p className={styles.peopleWaitingNumber}>
        <span className={styles.peopleWaitingValue} data-testid="ward-morning-people-waiting-count">
          {count}
        </span>
      </p>
      {/*
       * Review finding M7 recorded that this sentence used to read "counted exactly as the referral
       * board counts them" on BOTH views, and that on the FIXED view it was false in tense: the
       * number was captured at mount and never moved, so accepting a referral left the board reading
       * Queued (1) while this still read 2, under a sentence saying the two are counted the same.
       *
       * WB-DB-11 removed the fixed view on 2026-08-30, so there is one view and the live wording is
       * the only wording. The finding is kept rather than dropped with the branch it described,
       * because it is the reason this sentence is worded in the present tense at all - and a future
       * reader adding a second view would otherwise reintroduce the same false tense with nothing
       * recording that it had already happened once.
       */}
      <p className={styles.peopleWaitingNote} data-testid="ward-morning-people-waiting-note">
        Referrals still queued, counted exactly as the referral board counts them. It is shown beside the beds figure,
        never taken away from it — this page states demand and supply and leaves the comparison to the reader.
      </p>
    </section>
  );
}

export function RemainingFigures({ rollup }: { rollup: CapacityRollup }) {
  return (
    <dl className={styles.figureGrid} data-testid="ward-morning-remaining-figures">
      {REMAINING_FIGURE_KEYS.map((key) => (
        <div key={key} className={styles.figureItem} data-testid={`ward-morning-figure-service-${key}`}>
          <dt className={styles.figureLabel}>{CAPACITY_FIGURE_LABELS[key]}</dt>
          <dd className={styles.figureValue}>{rollup[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The full five-figure grid — including `availableNow` — used at site and unit level, where
 * there is no separate big headline number to carry it instead (layout item 6).
 *
 * `idTestId` disambiguates the per-figure `data-testid`: this component renders once per
 * hospital (`SiteBlock`) and once per ward (`UnitRow`), and the service-level headline/remaining
 * figures render the same five keys again — so a bare `ward-morning-figure-<key>` used to be
 * emitted on up to 40 elements at once (one service-level, one per site, one per unit), a
 * guaranteed Playwright strict-mode violation rather than the intermittent flake this repo has
 * already hit once on a different screen. Every level now gets its own prefix:
 * `ward-morning-figure-service-<key>` (headline/remaining figures, not this component),
 * `ward-morning-figure-site-<code>-<key>` and `ward-morning-figure-unit-<unitId>-<key>`.
 */
export function FigureList({
  breakdown,
  idTestId,
  printDense,
}: {
  breakdown: CapacityBreakdown;
  idTestId: string;
  /** C3 fix pass: the site-level grid is the only figure grid that still prints (unit-level is
   *  hidden entirely — see `.unitList` in the print block). A second, print-only class hook lets
   *  `@media print` force it onto one row (five fixed columns instead of `auto-fit` wrapping to
   *  two), without touching `RemainingFigures`' service-level grid, which shares this same base
   *  class but is not part of this fix. */
  printDense?: boolean;
}) {
  return (
    <dl className={printDense ? `${styles.figureGrid} ${styles.figureGridDense}` : styles.figureGrid}>
      {ALL_FIGURE_KEYS.map((key) => (
        <div key={key} className={styles.figureItem} data-testid={`ward-morning-figure-${idTestId}-${key}`}>
          <dt className={styles.figureLabel}>{CAPACITY_FIGURE_LABELS[key]}</dt>
          <dd className={styles.figureValue}>{breakdown[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExcludedBeyondTonight({ count }: { count: number }) {
  return (
    <p className={styles.excluded} data-testid="ward-morning-excluded">
      {count} bed{count === 1 ? "" : "s"} excluded from the figures above — expected beyond tonight.
    </p>
  );
}

/** Only renders when there is something to report — unlike the exclusion count above, an empty
 *  `unplacedUnitIds` is not itself a fact worth stating on every render of an otherwise-ordinary
 *  page (spec's failure-branch list only requires stating this when it is non-empty). */
export function UnplacedUnitsNote({ unplacedUnitIds }: { unplacedUnitIds: string[] }) {
  if (unplacedUnitIds.length === 0) return null;
  return (
    <p className={styles.unplaced} data-testid="ward-morning-unplaced">
      {unplacedUnitIds.length} unit{unplacedUnitIds.length === 1 ? "" : "s"} could not be placed under a hospital:{" "}
      {unplacedUnitIds.join(", ")}.
    </p>
  );
}

export function ViewControl({
  view,
  onChangeView,
  liveNow,
}: {
  view: MorningView;
  onChangeView: (view: MorningView) => void;
  liveNow: Instant;
}) {
  return (
    <div className={styles.viewControl}>
      <div className={styles.viewButtons} role="group" aria-label="Fixed or live view">
        <ViewButton
          testId="ward-morning-view-fixed"
          active={view === "fixed"}
          label={`Handover ${formatInstant(MORNING_HANDOVER_MINUTES)}`}
          onClick={() => onChangeView("fixed")}
        />
        <ViewButton
          testId="ward-morning-view-live"
          active={view === "live"}
          label={`Live ${formatInstant(liveNow)}`}
          onClick={() => onChangeView("live")}
        />
      </div>
      <p className={styles.viewExplainer} data-testid="ward-morning-view-explainer">
        The handover view is a snapshot taken when this page was opened, read against the 08:00 handover clock — not a
        reconstruction of what the ward state actually was at 08:00, because this prototype keeps no event history. The
        live view is the one that moves.
      </p>
    </div>
  );
}

/** "Visibly different states, not colour alone" (spec item 5): the active button carries its own
 *  text marker (`● Showing`) and an `aria-pressed` state, neither of which depends on colour — the
 *  marker's text still reads under forced-colors mode and in the print stylesheet's ink-only
 *  rendering (this whole control is hidden in print, but the same discipline applies while it is
 *  on screen). */
function ViewButton({
  testId,
  active,
  label,
  onClick,
}: {
  testId: string;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={active ? styles.viewButtonActive : styles.viewButton}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      {active && (
        <span className={styles.viewActiveMark} aria-hidden="true">
          ● Showing
        </span>
      )}
      {active && <span className="sr-only">(current view)</span>}
    </button>
  );
}

export function SiteBlock({ siteRollup, now }: { siteRollup: SiteRollup; now: Instant }) {
  const { site, rollup, units } = siteRollup;
  // I4 fix pass ("Zero is a claim", spec D4). A site with no units recorded (JHC, PEEL in the
  // real fixture) always rolls up to `rollupFreshness([])` — `kind: "never"` — and
  // `sumBreakdowns([])` — every field zero. Rendering that as a five-figure grid under a real
  // hospital's name presents "Available now 0 · Confirmed today 0 · ..." as if it were a fact
  // this page checked, when the true fact is that it has nothing to report at all: the words
  // below ("No units recorded") already carry that, so the grid is suppressed rather than left to
  // print five bold zeros a reader would scan first. A site WITH units still renders its grid
  // even when every figure happens to be zero — that zero is a real count of real (zero) beds,
  // not this failure mode.
  const hasUnits = units.length > 0;
  return (
    <section className={styles.siteBlock} data-testid={`ward-morning-site-${site.code}`}>
      <header className={styles.siteHeader}>
        <h2 className={styles.siteName}>{site.name}</h2>
        <FreshnessLine freshness={rollup.freshness} now={now} />
      </header>
      {hasUnits && <FigureList breakdown={rollup} idTestId={`site-${site.code}`} printDense />}
      {hasUnits ? (
        <ul className={styles.unitList}>
          {units.map((unitRollup) => (
            <UnitRow key={unitRollup.unit.id} unitRollup={unitRollup} now={now} />
          ))}
        </ul>
      ) : (
        <p className={styles.emptyNote} data-testid={`ward-morning-site-${site.code}-empty`}>
          No units recorded.
        </p>
      )}
    </section>
  );
}

export function UnitRow({ unitRollup, now }: { unitRollup: UnitRollup; now: Instant }) {
  const { unit, breakdown, freshness } = unitRollup;
  return (
    <li className={styles.unitRow} data-testid={`ward-morning-unit-${unit.id}`}>
      <div className={styles.unitHeader}>
        <span className={styles.unitName}>{unit.name}</span>
        <FreshnessLine freshness={freshness} now={now} />
      </div>
      <FigureList breakdown={breakdown} idTestId={`unit-${unit.id}`} />
    </li>
  );
}

function PrintFooter() {
  return (
    <footer className={styles.footer}>
      <button
        type="button"
        className={styles.printButton}
        data-testid="ward-morning-print"
        onClick={() => window.print()}
      >
        Print
      </button>
      <p className={styles.crossLink}>
        This page answers &quot;what can I fill right now, across the network?&quot; For &quot;what do I need to hand
        over this shift?&quot;, see the <Link href="/mockups/ward-flow/handover">shift handover</Link>.
      </p>
    </footer>
  );
}
