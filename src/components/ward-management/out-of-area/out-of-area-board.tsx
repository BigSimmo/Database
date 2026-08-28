"use client";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { splitDuration } from "@/components/ward-management/ward-clock";
import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
} from "@/components/ward-management/ward-distance";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { outOfAreaLedger, type OutOfAreaEntry } from "@/components/ward-management/ward-referrals";

import styles from "./out-of-area.module.css";

/**
 * Phase 8, Task 5 (spec D8-3): the out-of-area ledger — how many people are currently in a bed a
 * long way from where they live, and for how long.
 *
 * **This is the screen most likely to be quoted in a meeting, so it states what it is not, on
 * itself, in full.** Both governance notices render whole and above the entries: not abbreviated,
 * not behind a tooltip, not in a footnote below the fold. A threshold that looks official and is
 * not is exactly the figure that gets repeated back at you six months later.
 *
 * **It calls `outOfAreaLedger` and recomputes nothing.** Neither number is derived here, the
 * entries render in the order the ledger returns them, and there is no comparator anywhere in this
 * file. That order is the admission fixture's own order, deliberately: a sort by elapsed time
 * would be a ranking of people by how recently they were sent away, which reads as a repatriation
 * priority nobody has decided. `ward-referrals.ts` holds a sibling derivation that does sort
 * most-recent-first (`recentlyDecidedReferrals`); it answers a different question and must never
 * be reached for here.
 *
 * **Elapsed time and nothing else.** No countdown, no target, no deadline, and no colour that
 * changes at a threshold. `formatElapsed` is deliberately not reused — it appends "waiting", and
 * somebody in a bed far from home is not waiting for anything this prototype has recorded.
 *
 * **Why this one screen reads the seed directly rather than the provider.** There is no live
 * source to read: `Admission` is not in the reducer's state and no `WardFlowEvent` creates, ends
 * or moves one, so `wardAdmissions` is the only record of who is in a bed. The single-source rule
 * exists so that two surfaces cannot disagree about one live fact; here there is one surface and
 * no live fact, and the screen says so in its own words rather than leaving a reader to assume the
 * list is live. `units` and `now` still come from the provider — those two ARE live, and reading
 * them from `ward-sites.ts` instead is the specific defect that rule was written for.
 *
 * The seed arrives as a DEFAULT PARAMETER rather than a hard-wired read, the same shape
 * `ward-derivations.ts` uses and the same shape `tests/ward-flow-single-source.test.ts` names as
 * acceptable. Nothing in the app passes it: the route renders `<OutOfAreaBoard />`. It exists so a
 * test can render the two states the seeded records cannot produce — nobody out of area at all,
 * and an unclassified count standing on its own as the only non-zero number — because those are
 * the two states whose wording is most easily got wrong and least often seen.
 */
export function OutOfAreaBoard({ admissions = wardAdmissions }: { admissions?: Admission[] }) {
  const { units, now } = useWardFlow();
  const { entries, notBanded } = outOfAreaLedger(admissions, units, now);

  return (
    <div className={styles.screen} data-testid="ward-out-of-area-board">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-out-of-area-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This board is <strong>not a medical device</strong>. Every bed, every occupancy and every travel time in it
            is invented, and nothing here has been checked against a real service.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Out of area</h1>
          <p className={styles.pageSubtitle}>Who is in a bed far from home, and how long since they arrived.</p>
        </header>

        {/*
         * The two figures, together, worded so that neither can be read as a share of the other.
         * They have no common denominator: the first counts people in a bed far from home, the
         * second counts beds this prototype cannot place in a band at all. On the seeded records
         * the second is roughly twelve times the first, so ANY construction implying it is a
         * shortfall or a remainder of the first would not be a small presentational slip — it
         * would be the dominant reading of the screen, and it would be false. Hence two separate
         * sentences: no "of", no fraction, no percentage, no progress bar.
         */}
        <p className={styles.counts} data-testid="ward-out-of-area-counts">
          <span data-testid="ward-out-of-area-count-people">
            {entries.length} {entries.length === 1 ? "person is" : "people are"} recorded as being in a bed far from
            home.
          </span>{" "}
          <span data-testid="ward-out-of-area-count-not-banded">
            {notBanded} more could not be placed in a band because this prototype holds no travel time for their home
            region.
          </span>
        </p>

        {/*
         * Imported whole from `ward-distance.ts`, never retyped, and rendered before the entries
         * rather than beneath them. The threshold is this prototype's own invention, and the
         * sentence saying so has to be met before the number is.
         */}
        <p className={styles.notice} data-testid="ward-out-of-area-threshold-notice">
          {INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE}
        </p>

        {/* Bands are shown on every row below, so the sentence that says the travel times are
            invented belongs on this screen too. Also imported, also whole. */}
        <p className={styles.notice} data-testid="ward-out-of-area-synthetic-notice">
          {SYNTHETIC_TRAVEL_TIMES_NOTICE}
        </p>

        {/*
         * What this list is, in the screen's own words, and it says only what is true.
         *
         * An earlier draft of this task mandated a sentence claiming the prototype has no record
         * of anyone leaving a bed, so nobody ever leaves this ledger. That sentence is FALSE and
         * is forbidden: an `Admission` ends (`state: "left"`, `leftAt`), and the ledger excludes
         * anybody not currently holding a bed. See `docs/ward-flow-phase-8-decisions.md`, D8-9.
         *
         * What IS true is narrower, and is stated here instead: the list is seeded, no event in
         * this prototype adds to it or removes from it, and it is not a live count of anything.
         */}
        <p className={styles.provenance} data-testid="ward-out-of-area-provenance">
          Everyone here comes from this prototype&apos;s own seeded records. Somebody who has left their bed is not on
          this list, and neither is anybody who has not yet arrived. Nothing done on these screens adds anyone to this
          list or takes anyone off it — this prototype does not record admissions as they happen, so only the elapsed
          times move as the demo clock runs. This is not a live statewide count.
        </p>

        <section className={styles.section} data-testid="ward-out-of-area-entries">
          <h2 className={styles.sectionHeading}>People in a bed far from home</h2>
          {entries.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-out-of-area-empty">
              Nobody on these records is in a bed far from home.
            </p>
          ) : (
            <>
              <div className={styles.tableScroll} data-testid="ward-out-of-area-table">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Home region</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Travel time</th>
                      <th scope="col">Since arrival</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* The ledger's own order, unsorted and untruncated. See this file's header. */}
                    {entries.map((entry) => (
                      <tr key={entry.admission.id} data-testid={`ward-out-of-area-row-${entry.admission.id}`}>
                        <td>{entry.admission.homeRegion}</td>
                        <td>{entry.unit.name}</td>
                        <td>{TRAVEL_BAND_LABELS[entry.band]}</td>
                        <td>{sinceArrivalLabel(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cardList} data-testid="ward-out-of-area-cards">
                {entries.map((entry) => (
                  <li key={entry.admission.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardRegion}>{entry.admission.homeRegion}</span>
                      <span className={styles.cardElapsed}>{sinceArrivalLabel(entry)} since arrival</span>
                    </div>
                    <p className={styles.cardUnit}>{entry.unit.name}</p>
                    <p className={styles.cardBand}>{TRAVEL_BAND_LABELS[entry.band]}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Elapsed time, clamped at the point of display exactly as `OutOfAreaEntry.sinceArrival`'s own doc
 * comment specifies. The ledger deliberately does not clamp: a fixture authored with an arrival in
 * the future must read as the oddity it is rather than silently as zero.
 */
function sinceArrivalLabel(entry: OutOfAreaEntry): string {
  return splitDuration(Math.max(entry.sinceArrival, 0));
}
