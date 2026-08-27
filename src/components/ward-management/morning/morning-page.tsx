"use client";

import { useState } from "react";
import Link from "next/link";

import type { CapacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, LeaveBed, Site, Unit } from "@/components/ward-management/ward-model";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
  morningHandoverInstant,
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
export type FrozenMorning = { instant: Instant | null; rollup: ServiceRollup | null };

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
): FrozenMorning {
  const instant = morningHandoverInstant(now);
  return {
    instant,
    rollup: instant === null ? null : serviceRollup(sites, units, releases, leave, instant),
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
  const { units, bedReleases, leaveBeds, now } = useWardFlow();

  const [frozen] = useState<FrozenMorning>(() => buildFrozenMorning(now, wardSites, units, bedReleases, leaveBeds));

  const [view, setView] = useState<MorningView>("fixed");

  // Live view: recomputed from the live `now` on every render, never frozen.
  const liveRollup = serviceRollup(wardSites, units, bedReleases, leaveBeds, now);

  return (
    <div className={styles.screen} data-testid="ward-morning-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <MorningBody frozen={frozen} view={view} onChangeView={setView} liveRollup={liveRollup} liveNow={now} />
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
  frozen,
  view,
  onChangeView,
  liveRollup,
  liveNow,
}: {
  frozen: FrozenMorning;
  view: MorningView;
  onChangeView: (view: MorningView) => void;
  liveRollup: ServiceRollup;
  liveNow: Instant;
}) {
  const noHandoverYet = view === "fixed" && frozen.instant === null;
  const activeRollup = view === "fixed" ? frozen.rollup : liveRollup;

  return (
    <>
      <GovernanceBanner />

      {noHandoverYet ? (
        <NoHandoverYet onSwitchToLive={() => onChangeView("live")} />
      ) : (
        activeRollup && (
          <>
            <HeadlineFigure rollup={activeRollup.service} />
            <RemainingFigures rollup={activeRollup.service} />
            <ExcludedBeyondTonight count={activeRollup.service.excludedBeyondToday} />
          </>
        )
      )}

      <ViewControl view={view} onChangeView={onChangeView} liveNow={liveNow} />

      {!noHandoverYet && activeRollup && (
        <>
          <UnplacedUnitsNote unplacedUnitIds={activeRollup.unplacedUnitIds} />
          <div className={styles.siteList} data-testid="ward-morning-sites">
            {activeRollup.sites.map((siteRollup) => (
              <SiteBlock key={siteRollup.site.code} siteRollup={siteRollup} />
            ))}
          </div>
        </>
      )}

      <PrintFooter />
    </>
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
      <p>The 08:00 handover has not been taken for this day.</p>
      <button type="button" className={styles.noHandoverButton} onClick={onSwitchToLive}>
        Show the live view instead
      </button>
    </div>
  );
}

/** The one place this page's roll-up freshness wording lives. `RollupFreshness` has no
 *  `confirmedByRole` (a roll-up spans many wards, not one), so this is a bespoke renderer rather
 *  than a reuse of `WardFreshness` — that component's contract is per-confirmation, this one's is
 *  per-group. `"never"` always reads "Never confirmed", literally, never a `0` (failure branch). */
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

export function HeadlineFigure({ rollup }: { rollup: CapacityRollup }) {
  return (
    <section className={styles.headline} data-testid="ward-morning-headline">
      <h1 className={styles.headlineTitle}>Beds available right now</h1>
      <p className={styles.headlineNumber} data-testid="ward-morning-figure-availableNow">
        <span className={styles.headlineValue}>{rollup.availableNow}</span>
        <span className={styles.headlineLabel}>{CAPACITY_FIGURE_LABELS.availableNow}</span>
      </p>
      <FreshnessStamp freshness={rollup.freshness} />
    </section>
  );
}

export function RemainingFigures({ rollup }: { rollup: CapacityRollup }) {
  return (
    <dl className={styles.figureGrid} data-testid="ward-morning-remaining-figures">
      {REMAINING_FIGURE_KEYS.map((key) => (
        <div key={key} className={styles.figureItem} data-testid={`ward-morning-figure-${key}`}>
          <dt className={styles.figureLabel}>{CAPACITY_FIGURE_LABELS[key]}</dt>
          <dd className={styles.figureValue}>{rollup[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The full five-figure grid — including `availableNow` — used at site and unit level, where
 *  there is no separate big headline number to carry it instead (layout item 6). */
export function FigureList({ breakdown }: { breakdown: CapacityBreakdown }) {
  return (
    <dl className={styles.figureGrid}>
      {ALL_FIGURE_KEYS.map((key) => (
        <div key={key} className={styles.figureItem} data-testid={`ward-morning-figure-${key}`}>
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
        The handover view is a snapshot taken when this page was opened, read against the 08:00 handover clock — not
        a reconstruction of what the ward state actually was at 08:00, because this prototype keeps no event
        history. The live view is the one that moves.
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

export function SiteBlock({ siteRollup }: { siteRollup: SiteRollup }) {
  const { site, rollup, units } = siteRollup;
  return (
    <section className={styles.siteBlock} data-testid={`ward-morning-site-${site.code}`}>
      <header className={styles.siteHeader}>
        <h2 className={styles.siteName}>{site.name}</h2>
        <FreshnessStamp freshness={rollup.freshness} />
      </header>
      <FigureList breakdown={rollup} />
      {units.length === 0 ? (
        <p className={styles.emptyNote} data-testid={`ward-morning-site-${site.code}-empty`}>
          No units recorded.
        </p>
      ) : (
        <ul className={styles.unitList}>
          {units.map((unitRollup) => (
            <UnitRow key={unitRollup.unit.id} unitRollup={unitRollup} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function UnitRow({ unitRollup }: { unitRollup: UnitRollup }) {
  const { unit, breakdown, freshness } = unitRollup;
  return (
    <li className={styles.unitRow} data-testid={`ward-morning-unit-${unit.id}`}>
      <div className={styles.unitHeader}>
        <span className={styles.unitName}>{unit.name}</span>
        <FreshnessStamp freshness={freshness} />
      </div>
      <FigureList breakdown={breakdown} />
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
        This page answers &quot;what can I fill right now, across the network?&quot; For &quot;what do I need to
        hand over this shift?&quot;, see the <Link href="/mockups/ward-flow/handover">shift handover</Link>.
      </p>
    </footer>
  );
}
