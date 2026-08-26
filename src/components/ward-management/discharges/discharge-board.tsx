"use client";

import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./discharges.module.css";

/**
 * Task 6, spec D9: the discharge and egress board. A coordinator's whole reason to open this
 * board is "which bed do I chase, and which one is simply on its way" — so releases are grouped
 * by how much work is left on them, worst first: a **blocked** release needs somebody to act on
 * it right now, a **confirmed** one is just waiting for the clock, a **predicted** one is a
 * belief rather than a fact yet, and **released today** is done. Within a group, releases are
 * ordered by `releaseBand` — the same "now / by midday / by 1600 / tonight" ladder the capacity
 * board uses (`ward-bed-availability.ts`), so the two boards never disagree about how soon
 * "soon" is.
 *
 * This board is LIVE, unlike `HandoverPage` — it reads `useWardFlow()` on every render and never
 * freezes a snapshot. There is nothing here a coordinator needs to have held still while they
 * read it; the opposite is true, a discharge board that lagged reality would be actively
 * misleading about which bed is actually free to chase next.
 */

const GROUP_LABELS = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  predicted: "Predicted",
  "released-today": "Released today",
} as const;

type GroupKey = keyof typeof GROUP_LABELS;

/** Every group, in the fixed scan order spec D9 names — blocked first because those are the
 *  rows somebody must act on. Never reorder this array; `tests/ward-discharge-board.dom.test.tsx`
 *  pins the rendered heading order against it. */
const GROUP_ORDER: readonly GroupKey[] = ["blocked", "confirmed", "predicted", "released-today"];

const BAND_LABELS: Record<ReleaseBand, string> = {
  now: "Now",
  "by-midday": "By midday",
  "by-1600": "By 4pm",
  tonight: "Tonight",
};

const EMPTY_REASON: Record<GroupKey, string> = {
  blocked: "release is currently blocked",
  confirmed: "release is confirmed and unreleased",
  predicted: "release is predicted",
  "released-today": "release has been released today",
};

export type DischargeGroups = {
  blocked: BedRelease[];
  confirmed: BedRelease[];
  predicted: BedRelease[];
  "released-today": BedRelease[];
  /** Releases expected beyond tonight (`EVENING_SHIFT_END_MINUTES`) — never merged into a group,
   *  always counted. Silent truncation reads as "we counted everything" when we did not. */
  excludedBeyondToday: number;
};

/**
 * The one place this board's grouping and ordering rules live, so the component itself is pure
 * rendering. Pure function of the live `releases` and `now` the provider hands the board — takes
 * no fixture and no clock read of its own, per this phase's single-source rule.
 */
export function groupDischarges(releases: BedRelease[], now: Instant): DischargeGroups {
  const buckets: Record<GroupKey, BedRelease[]> = {
    blocked: [],
    confirmed: [],
    predicted: [],
    "released-today": [],
  };
  let excludedBeyondToday = 0;

  for (const release of releases) {
    const band = releaseBand(release, now);
    if (band === "beyond-today") {
      excludedBeyondToday += 1;
      continue;
    }
    if (release.state === "released") buckets["released-today"].push(release);
    else if (release.state === "blocked") buckets.blocked.push(release);
    else if (release.state === "confirmed") buckets.confirmed.push(release);
    else buckets.predicted.push(release);
  }

  const byBand = (list: BedRelease[]) =>
    [...list].sort(
      (a, b) =>
        RELEASE_BANDS.indexOf(releaseBand(a, now) as ReleaseBand) -
        RELEASE_BANDS.indexOf(releaseBand(b, now) as ReleaseBand),
    );

  return {
    blocked: byBand(buckets.blocked),
    confirmed: byBand(buckets.confirmed),
    predicted: byBand(buckets.predicted),
    "released-today": byBand(buckets["released-today"]),
    excludedBeyondToday,
  };
}

function unitLabel(unit: Unit | undefined, unitId: string): string {
  // Mirrors handover-page.tsx's own `departmentLabel` fallback: a raw id is a real fact about
  // the record, never a fabricated substitute for one.
  return unit ? unit.name : `No synthetic unit matches "${unitId}"`;
}

function healthServiceLabel(unit: Unit | undefined): string {
  const service = unit ? siteByCode(unit.siteCode)?.service : undefined;
  return service ?? "Unknown service";
}

export function DischargeBoard() {
  const { bedReleases, units, now } = useWardFlow();
  const groups = groupDischarges(bedReleases, now);

  return (
    <div className={styles.screen} data-testid="ward-discharge-board">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-discharge-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This board is <strong>not a medical device</strong>. It shows only the release state a ward has recorded —
            predicted, confirmed, blocked or released — and it never adds a predicted or unreleased bed into
            &quot;available now&quot;.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Discharges</h1>
          <p className={styles.pageSubtitle}>Every bed release across the network, blocked ones first.</p>
        </header>

        {GROUP_ORDER.map((key) => (
          <DischargeGroupSection key={key} groupKey={key} releases={groups[key]} units={units} now={now} />
        ))}

        <footer className={styles.footer} data-testid="ward-discharge-excluded">
          <p>
            {groups.excludedBeyondToday} release{groups.excludedBeyondToday === 1 ? "" : "s"} excluded — expected beyond
            tonight.
          </p>
        </footer>
      </main>
    </div>
  );
}

function DischargeGroupSection({
  groupKey,
  releases,
  units,
  now,
}: {
  groupKey: GroupKey;
  releases: BedRelease[];
  units: Unit[];
  now: Instant;
}) {
  return (
    <section className={styles.section} data-testid={`ward-discharge-group-${groupKey}`}>
      <h2 className={styles.sectionHeading}>{GROUP_LABELS[groupKey]}</h2>
      {releases.length === 0 ? (
        <p className={styles.emptyNote} data-testid={`ward-discharge-group-${groupKey}-empty`}>
          None — no {EMPTY_REASON[groupKey]}.
        </p>
      ) : (
        <>
          <div className={styles.tableScroll} data-testid={`ward-discharge-table-${groupKey}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Health service</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Blocker</th>
                  <th scope="col">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => {
                  const unit = units.find((candidate) => candidate.id === release.unitId);
                  const band = releaseBand(release, now) as ReleaseBand;
                  return (
                    <tr key={release.id}>
                      <td>{unitLabel(unit, release.unitId)}</td>
                      <td>{healthServiceLabel(unit)}</td>
                      <td>{BAND_LABELS[band]}</td>
                      <td>{release.blocker ?? "—"}</td>
                      <td>
                        <WardFreshness
                          confirmedAt={release.confirmedAt}
                          confirmedByRole={release.confirmedBy}
                          now={now}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className={styles.cardList} data-testid={`ward-discharge-cards-${groupKey}`}>
            {releases.map((release) => {
              const unit = units.find((candidate) => candidate.id === release.unitId);
              const band = releaseBand(release, now) as ReleaseBand;
              return (
                <li key={release.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardBand}>{BAND_LABELS[band]}</span>
                    <span className={styles.cardUnit}>{unitLabel(unit, release.unitId)}</span>
                  </div>
                  <p className={styles.cardService}>{healthServiceLabel(unit)}</p>
                  {release.blocker && <p className={styles.cardBlocker}>{release.blocker}</p>}
                  <WardFreshness confirmedAt={release.confirmedAt} confirmedByRole={release.confirmedBy} now={now} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
