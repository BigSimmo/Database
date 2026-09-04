"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

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
export function StatisticsWardScreen({ unitId, units: unitsOverride }: { unitId: string; units?: Unit[] }) {
  const { units: liveUnits } = useWardFlow();
  const units = unitsOverride ?? liveUnits;
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
        <section className={styles.section}>
          {/* No heading here. The frame's own `<h1>` already reads "Ward not found"; a second
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
        </section>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(unit.siteCode);

  return (
    <StatisticsSectionFrame
      section={section}
      title={unit.name}
      subtitle="What this section will hold about this ward, and what has not been built in it yet."
      testId="ward-statistics-ward-screen"
    >
      <section className={styles.section} data-testid="ward-statistics-ward-identity">
        <h2 className={styles.sectionHeading}>Which ward this is</h2>
        <p className={styles.body} data-testid="ward-statistics-ward-site">
          {/* A ward whose site code resolves to nothing is described as exactly that, rather than
              being given a plausible hospital. The same conservative failure `ward-index.tsx` holds
              to: the page says it cannot place the ward, and still shows you the ward. */}
          {site
            ? `${unit.name} is recorded at ${site.name}.`
            : `${unit.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
        </p>
        <p className={styles.note}>
          A name and a hospital, and nothing else. Neither is a measurement, so neither can be wrong in the way a figure
          can be wrong.
        </p>
      </section>

      <section className={styles.section} data-testid="ward-statistics-ward-not-built">
        <h2 className={styles.sectionHeading}>Nothing about this ward is measured here yet</h2>

        <p className={styles.notBuilt} data-testid="ward-statistics-ward-not-built-body">
          <strong>
            No figure about this ward is shown here — not a nought, and not a dash standing where a number will go.
          </strong>{" "}
          What that costs is smaller than it looks, and saying so precisely matters more than saying it modestly: most
          of these figures are written and simply have nowhere to appear. A nought where a derivation was never written
          reads exactly like a nought that was measured, so none is shown until each one arrives with its own account of
          itself.
        </p>

        {/*
         * ⚠️ **"ABSENT" WAS AN OVERSTATEMENT AND IT IS THE FAILURE THIS SECTION EXISTS TO AVOID,
         * INVERTED.** This paragraph read "beds, occupancy, availability, how long people stay and
         * how long they wait are all absent here on purpose" until fix round 1. Five of those are
         * COMPUTED ALREADY, in `ward-statistics.ts`, which has no consumer in `src` at all — only
         * its own test. Describing written arithmetic as absent understates how near the figures
         * are, and a reader deciding what to build next would have started from the wrong place.
         *
         * The figures named below were read from `ward-statistics.ts` on 2026-09-01; that module is
         * another chat's file and is deliberately NOT consumed here — this page has no derivation
         * of its own yet, and wiring one in is not a copy fix.
         *
         * ⚠️ **"NO CONSUMER IN THE APP" IS A LIVE MEASUREMENT, NOT A STANDING TRUTH, and the first
         * screen to render a ward figure falsifies it — which is this page's own next step.** It is
         * pinned in `tests/ward-statistics-sections.test.ts`, which walks `src` for an import of
         * `ward-statistics` and goes red the day one appears, so the sentence cannot age quietly
         * into a false claim the way the five-instant list below it did.
         *
         * ⚠️ **AND THE PARAGRAPH BELOW ONCE ENUMERATED `Admission`'s INSTANTS AND MISSED TWO.** It
         * listed five, copied from `ward-statistics.ts`'s own doc comment; the record carries seven
         * plus a nested `followUp.recordedAt`, with `awayAtEmergencyDepartmentSince` and
         * `dischargeConfirmedAt` omitted. The conclusion survived — neither omitted instant marks
         * entry to `waitlisted` — but a wrong enumeration on this page is exactly the confidently
         * checkable-looking claim a reader has no way to check. It no longer enumerates: a list
         * copied out of a file this page cannot edit is a copy that drifts silently.
         *
         * ⚠️ **AND THE SENTENCE THAT REPLACED THE ENUMERATION WAS ITSELF FALSE UNTIL 2026-09-01.** It read
         * "the record carries several instants and EVERY ONE OF THEM is about the bed or about the discharge
         * plan". `ward-admissions.ts` says the opposite of one of them, in bold, on the field:
         * `awayAtEmergencyDepartmentSince` "is a fact about the PERSON, which is why it is a field and not a
         * state", and the same doc explains that `AdmissionState` is where the bed facts live. The bed/person
         * distinction is load-bearing elsewhere — the bed stays occupied while somebody is away — so a
         * sentence that flattens it is not a rounding error. The conclusion ("none is the moment somebody
         * joined the waitlist") was true of every instant and survives; the characterisation did not. The
         * repair states the property as a floor rather than as an absolute, so a further person-fact instant
         * arriving cannot falsify it, and it still does not enumerate.
         */}
        <p className={styles.body} data-testid="ward-statistics-ward-computed-not-surfaced">
          <strong>Most of it is computed and simply not surfaced anywhere.</strong>{" "}
          <code className={styles.field}>wardStatistics()</code> already derives, per ward: average length of stay,
          average empty-bed minutes from the pull to the person arriving, discharge-date outcomes as met, missed and
          moved, admissions ready to leave but blocked, and long stays. It has no consumer in the app — only its own
          test — so the gap between here and a ward&apos;s figures is a rendering decision about what to show and how to
          word it, not arithmetic nobody has done.
        </p>

        <p className={styles.body} data-testid="ward-statistics-ward-blocked-figure">
          <strong>
            One figure beside them is genuinely blocked, and it is the clearest example of what this page is for.
          </strong>{" "}
          <code className={styles.field}>WardStatistics.averageWaitlistWaitMinutes</code> is always{" "}
          <code className={styles.field}>null</code> — how long somebody accepted in principle waits before a bed is
          given cannot be measured, because no instant on <code className={styles.field}>Admission</code> marks the
          moment they entered <code className={styles.field}>waitlisted</code>. The instants it does carry are not all
          of one kind — some are about the bed, some are about the discharge plan, and at least one is a fact about the
          person rather than about the bed, which is how <code className={styles.field}>ward-admissions.ts</code> puts
          it on the field itself. None of them is the moment somebody joined the waitlist. They are deliberately not
          listed here: the field set belongs to a record this page does not own, so a copy of it would go stale the day
          one is added and nothing on this page would fail. The nearest equivalent elsewhere in this prototype measures
          from <code className={styles.field}>Referral.raisedAt</code>, a field this derivation has no access to,
          because it takes admissions only, by design. So no amount of data entry against today&apos;s model would
          produce this figure: it needs the admission record to gain an instant of its own, or the derivation to be
          given a different input, and either is a change to the model rather than to this page.
        </p>

        <p className={styles.note}>
          Beds, occupancy and availability are a different matter again: those are a ward&apos;s current capacity, which
          the capacity board and the ward&apos;s own screen already answer. They are not repeated here, because two
          surfaces answering one question in wording that can drift is how the two come to disagree.
        </p>

        <p className={styles.body}>
          <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ward-chooser-link">
            Choose another ward or emergency department
          </Link>
        </p>
      </section>
    </StatisticsSectionFrame>
  );
}
