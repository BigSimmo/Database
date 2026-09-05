"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

import styles from "./statistics-sections.module.css";

/**
 * ONE WARD IN DETAIL — the per-ward statistics page, and it is a skeleton.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO.** Not a crash, and — worse — not an
 * empty shell that looks like a ward with no data. Those two are indistinguishable to a reader:
 * "this ward has nothing to show" and "there is no such ward" would render identically, and the
 * first is a statement about a real ward the reader would then believe. This screen never falls
 * back to a different unit, and it says which id it could not resolve.
 *
 * ⚠️ **THE SAME PAGE CARRIES THE DISCLAIMER IN BOTH STATES.** A reader who lands here from a stale
 * link sees the not-found state first, and it is still a page of this prototype — so it still says
 * the figures are invented and that nothing enforces the coordinator framing. An error state that
 * quietly drops the governance chrome is the one page most likely to be screenshotted.
 *
 * ⚠️ **NO FIGURE, AND NO SHAPE WHERE ONE WOULD GO.** The ward's name and its hospital are identity,
 * not measurement: they cannot drift against a figure because they are not figures. Bed counts,
 * occupancy, availability and length of stay are deliberately absent — this page shows none of
 * them, rather than showing them as noughts, and it says so in a sentence.
 *
 * **The unit comes from the provider's live `units`**, never from `unitById()`, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen: a surface resolving a unit from
 * the frozen fixture describes the ward as it was seeded rather than as it is.
 */
export function StatisticsWardScreen({
  unitId,
  units: unitsOverride,
  admissions: admissionsOverride,
}: {
  unitId: string;
  units?: Unit[];
  admissions?: Admission[];
}) {
  const { units: liveUnits, admissions: liveAdmissions, now } = useWardFlow();
  const units = unitsOverride ?? liveUnits;
  const admissions = admissionsOverride ?? liveAdmissions;
  const unit = units.find((candidate) => candidate.id === unitId);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!unit) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Ward not found"
        subtitle="The address names a ward this prototype does not have."
        testId="ward-statistics-ward-screen"
      >
        <div className={styles.notFoundBlock}>
          {/* No heading here, and NOT a WardPanel: that primitive requires a title and the frame's
              own `<h1>` already reads "Ward not found". The frame's own `<h1>` already reads "Ward not found"; a second
              heading saying the same thing in different words was the near-duplicate fix round 1
              picked up, and the warning paragraph below is the content. */}
          <p className={styles.notFoundBody} data-testid="ward-statistics-ward-unresolved">
            No ward in this prototype has the id <span className={styles.unresolvedId}>{unitId}</span>. It may have been
            renamed or removed, or the id in the address may be wrong. This page never falls back to a different ward,
            because a page showing the wrong ward under the right heading is worse than a page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
              Choose a ward from the comparisons page
            </Link>{" "}
            to reach one that does exist.
          </p>
        </div>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(unit.siteCode);
  const statistics = wardStatistics(unit.id, admissions, now);

  return (
    <StatisticsSectionFrame
      section={section}
      title={unit.name}
      subtitle="What this prototype can measure about this ward, and what its record cannot support."
      testId="ward-statistics-ward-screen"
    >
      <WardPanel title="Which ward this is" testId="ward-statistics-ward-identity">
        <div className={styles.panelBody}>
          <p className={styles.body} data-testid="ward-statistics-ward-site">
            {/* A ward whose site code resolves to nothing is described as exactly that, rather than
                being given a plausible hospital. The same conservative failure `ward-index.tsx` holds
                to: the page says it cannot place the ward, and still shows you the ward. */}
            {site
              ? `${unit.name} is recorded at ${site.name}.`
              : `${unit.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
          </p>
          <p className={styles.note}>
            A name and a hospital, and nothing else. Neither is a measurement, so neither can be wrong in the way a
            figure can be wrong.
          </p>
        </div>
      </WardPanel>

      <WardPanel title="What can be measured about this ward" testId="ward-statistics-ward-measures">
        <div className={styles.panelBody}>
          {/*
           * 🔴 **A NULL IS WORDED. A NOUGHT IS COUNTED. THEY MUST NEVER SHARE A RENDERING.**
           *
           * `ward-statistics.ts` separates them in the TYPE — every `number` is a genuine count where
           * nought is true and correct, every `number | null` is an average where `null` means there
           * was nothing to measure — and its own comment calls collapsing the two "the single most
           * likely way this page could lie". Both kinds are on this page at once, so the distinction
           * has to survive in the words rather than in the type.
           *
           * ⚠️ A dash is not available as a shorthand for either. A dash cannot say which of the two
           * it means, which is the whole defect. `tests/ward-statistics-ward-nulls.dom.test.tsx`
           * fails on a digit inside any of the three nullable measures, on a trailing dash, and on
           * an average that renders the same string as a true nought.
           */}

          <h3 className={styles.subHeading}>Average length of stay</h3>
          <p className={styles.body} data-testid="ward-stat-length-of-stay">
            {statistics.averageLengthOfStayDays === null ? (
              <>No admission on this ward has both arrived and left, so there is no completed stay to average yet.</>
            ) : (
              <>
                {statistics.averageLengthOfStayDays} days, averaged over the admissions on this ward that have both
                arrived and left.
              </>
            )}
          </p>

          <h3 className={styles.subHeading}>Average time a bed stood empty</h3>
          <p className={styles.body} data-testid="ward-stat-empty-bed-minutes">
            {statistics.averageEmptyBedMinutes === null ? (
              <>
                No bed on this ward has yet gone from being given away to the person arriving in it, so there is no
                empty stretch to average.
              </>
            ) : (
              <>{statistics.averageEmptyBedMinutes} minutes between a bed being given away and the person arriving.</>
            )}
          </p>

          <h3 className={styles.subHeading}>Average wait after being accepted</h3>
          <p className={styles.body} data-testid="ward-stat-waitlist-wait">
            {/*
             * ⚠️ PERMANENTLY UNMEASURABLE, NOT MERELY EMPTY — and the difference has to be on the
             * screen. `averageWaitlistWaitMinutes` is a literal `null` in the return object, never
             * computed, on any ward with any data: nothing on `Admission` marks the moment somebody
             * entered the waiting list, and the module refuses to fabricate an instant that is not
             * on the record. Worded as a property of the record, so nobody waits for data that
             * cannot arrive.
             */}
            {/*
             * ⚠️ THE FIELD NAMES CAME OFF THIS PARAGRAPH ON 2026-09-06, ON THE OWNER'S RULING, AND THE
             * IDENTIFIERS LIVE HERE SO THE CLAIM STAYS CHECKABLE:
             *
             *     the always-null figure   WardStatistics.averageWaitlistWaitMinutes
             *     the record with no such instant   Admission        the state it never timestamps   waitlisted
             *     where the field kinds are documented   ward-admissions.ts
             *     the nearest equivalent elsewhere   Referral.raisedAt
             *
             * He asked for the prototype not to publish them. **The reasoning is unchanged and every
             * claim above is still verifiable — by a developer, from here, which is where a field name
             * is useful.** What a coordinator needs from this paragraph is which RECORD cannot answer
             * and why; what a developer needs is the identifier. Those are different readers and the
             * screen was serving only the second.
             */}
            <strong>
              One figure beside them is genuinely blocked, and it is the clearest example of what this page is for.
            </strong>{" "}
            How long somebody accepted in principle waits before a bed is given is never measured here — not for this
            ward, not for any ward, and not because nobody has filled it in. The admission record carries no instant
            marking the moment a person joined the waiting list. The instants it does carry are not all of one kind:
            some are about the bed, some are about the discharge plan, and at least one is a fact about the person
            rather than about the bed, which is how the admission record itself describes them. None of them is the
            moment somebody joined the waitlist. They are deliberately not listed here — that field set belongs to a
            record this page does not own, so a copy of it would go stale the day one is added and nothing on this page
            would fail. The nearest equivalent elsewhere in this prototype measures from the moment a referral was
            raised, which this derivation cannot see, because it is given admissions only, by design. So no amount of
            data entry against today&apos;s model would produce this figure: it needs the admission record to gain an
            instant of its own, or the derivation to be given a different input, and either is a change to the model
            rather than to this page.
          </p>

          <h3 className={styles.subHeading}>Ready to leave, and blocked</h3>
          <p className={styles.body} data-testid="ward-stat-ready-blocked">
            {statistics.readyToLeaveCannot === 0 ? (
              <>None. Every admission on this ward that could leave is free to.</>
            ) : (
              <>
                {statistics.readyToLeaveCannot} on this ward could leave and cannot, each with a blocker recorded
                against it.
              </>
            )}
          </p>

          <h3 className={styles.subHeading}>Long stays</h3>
          <p className={styles.body} data-testid="ward-stat-long-stays">
            {statistics.longStays === 0 ? (
              <>None. No admission on this ward has passed three months.</>
            ) : (
              <>{statistics.longStays} on this ward have been here longer than three months.</>
            )}
          </p>

          <h3 className={styles.subHeading}>Discharge dates</h3>
          <p className={styles.body} data-testid="ward-stat-discharge-outcomes">
            {statistics.dischargeDateOutcomes.consideredCount === 0 ? (
              <>None. No admission on this ward has had a discharge date written down, so none can have been met.</>
            ) : (
              <>
                Of {statistics.dischargeDateOutcomes.consideredCount} with a date written down,{" "}
                {statistics.dischargeDateOutcomes.met} met, {statistics.dischargeDateOutcomes.missed} missed and{" "}
                {statistics.dischargeDateOutcomes.moved} moved.
              </>
            )}
          </p>

          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
              Choose a different ward from the comparisons page
            </Link>{" "}
            to see the same measures for another.
          </p>

          <p className={styles.note}>
            Every figure here is computed from this prototype&apos;s own state as the page renders. A measure the record
            cannot support says so in words rather than showing a nought, because a nought that was never measured reads
            exactly like a nought that was.
          </p>
        </div>
      </WardPanel>
    </StatisticsSectionFrame>
  );
}
