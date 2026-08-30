"use client";

import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
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
 * **In whole days, via `daysInBed`.** The first version of this screen rendered minutes through
 * `splitDuration`, and on the seeded records that produced everything from `25h 30m` to
 * `5041h 30m`. Every assertion passed, because every number was correct — the FORMAT was
 * unreadable, and this screen's second headline fact is one nobody could read. Days are what a
 * length of stay is spoken in, and `daysInBed` (`ward-admissions.ts`) is the one place this
 * project computes them: counted from `arrivedAt` and never from `pulledAt`, floored at zero, and
 * `null` rather than a substituted fallback when there is no arrival. Reimplementing the division
 * here would be the second local copy this phase exists to prevent. It is still elapsed time and
 * nothing else — just readable.
 *
 * **THE ADMISSIONS COME FROM THE PROVIDER, AND UNTIL 2026-08-30 THEY CAME FROM THE SEED.** The
 * paragraph that used to sit here said `Admission` was not in the reducer's state and that no
 * event created one. Both had stopped being true: `seedWardFlowState` carries `admissions`, and
 * `PATIENT_ARRIVED` appends one (`ward-flow-reducer.ts`, `AD-ARR-…`). The comment was accurate when
 * it was written and nothing failed when it stopped being — which is how it went on justifying a
 * read that had become wrong.
 *
 * ⚠️ **TWO DEFECTS CAME OUT OF THAT ONE STALE PARAGRAPH, AND THE SMALLER-LOOKING ONE IS WORSE.**
 *
 *  1. **A length of stay counted across two clocks.** `now` is re-anchored to the hour the demo
 *     opens; the seed is not. One side of the subtraction moved, so every figure on a screen whose
 *     headline fact is DAYS IN A BED was inflated by the anchor offset. Ward Board found this exact
 *     shape on `edPressure` the same night: *a wrong clock looks wrong; a wrong length of stay
 *     looks PLAUSIBLE.* Out-of-area duration is a figure people escalate on.
 *  2. **The screen contradicted itself.** Its own provenance line says a patient who arrives during
 *     the session is added, and blames their absence on a missing home region. Reading the seed
 *     made that impossible for a different reason entirely — an arrival appends to state, and this
 *     screen was not looking at state. The stated reason was not the operative one, which is worse
 *     than no explanation: it sends the next reader to the wrong place.
 *
 * The override parameter SURVIVES, and that is deliberate. Board's lesson from `edPressure` is that
 * the injection point was never the problem — its OPTIONALITY pointing at a frozen fixture was. It
 * now falls back to live state, so omitting it (which is what the route does) is safe, and a test
 * can still render the two states the seeded records cannot produce: nobody out of area at all, and
 * an unclassified count standing alone as the only non-zero number.
 *
 * `units` and `now` come from the provider for the same reason they always did.
 */
export function OutOfAreaBoard({ admissions }: { admissions?: Admission[] }) {
  const { units, now, admissions: liveAdmissions } = useWardFlow();
  const { entries, notBanded } = outOfAreaLedger(admissions ?? liveAdmissions, units, now);

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
          This is not a live statewide count. Everyone here starts from this prototype&apos;s own seeded records.
          Somebody who has left their bed is not on this list, and neither is anybody who has not yet arrived. Nothing on
          these screens takes anyone off it. A patient who ARRIVES during this session is added straight away, because
          arrival records a person in a bed — but the emergency-department pathway records no home region, and a distance
          from an unknown home is not a distance, so they raise the second figure below rather than joining the list of
          people far from home.
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
                        <td>{sinceArrivalLabel(entry, now)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* The phone view. Each card is keyed, because below 40rem this list is the ONLY
                  thing a coordinator sees — the table above is `display: none` there — and a row
                  assertion that can only reach the table proves nothing about a phone. */}
              <ul className={styles.cardList} data-testid="ward-out-of-area-cards">
                {entries.map((entry) => (
                  <li
                    key={entry.admission.id}
                    className={styles.card}
                    data-testid={`ward-out-of-area-card-${entry.admission.id}`}
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.cardRegion}>{entry.admission.homeRegion}</span>
                      <span className={styles.cardElapsed}>{sinceArrivalLabel(entry, now)} since arrival</span>
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
 * How long this person has been in this bed, in whole days.
 *
 * Clamping happens inside `daysInBed`, exactly as `OutOfAreaEntry.sinceArrival`'s own doc comment
 * specifies it should happen at the point of display: the ledger deliberately does not clamp, so a
 * fixture authored with an arrival in the future reads as the oddity it is in a test rather than
 * silently as zero.
 *
 * `null` is stated, never substituted. It cannot occur for a ledger entry — the ledger already
 * excludes an admission with no finite `arrivedAt` — but a fallback string here would be the one
 * shape that could put an invented stay length on this screen if that ever changed, so the absence
 * is rendered as an absence.
 */
export function sinceArrivalLabel(entry: OutOfAreaEntry, now: Instant): string {
  const days = daysInBed(entry.admission, now);
  if (days === null) return "Arrival not recorded";
  if (days === 0) return "Under a day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}
