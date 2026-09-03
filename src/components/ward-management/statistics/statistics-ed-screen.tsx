"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./statistics-sections.module.css";

/**
 * ONE EMERGENCY DEPARTMENT IN DETAIL — the per-department statistics page, and it is a skeleton.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward
 * screen beside this one does: an empty shell and "there is no such department" render identically,
 * and a reader who takes the first for the second believes something false about a real place. This
 * screen never falls back to a different department, and it names the id it could not resolve —
 * the same discipline `edById` itself holds to.
 *
 * ⚠️ **THE DISCLAIMER IS ON BOTH STATES.** The not-found page is still a page of this prototype.
 *
 * ⚠️ **A WARD AND AN EMERGENCY DEPARTMENT ARE NOT ONE LIST WITH A FLAG.** They are different
 * records: `EmergencyDepartment` carries an id, a site code and a name and nothing else, while a
 * `Unit` carries cohort, security, authorisation and capacity. That is why there are two routes and
 * two screens rather than one taking a kind, and it is also why the figures each will eventually
 * hold are not the same figures — a department has no beds to be occupied.
 *
 * **The department comes from `allEmergencyDepartments()` via `edById`**, which is where
 * `ed-screen.tsx` resolves one from too. Emergency departments are not in provider state at all:
 * the provider holds `units`, because unit capacity changes as the prototype runs, and a
 * department's identity does not.
 */
export function StatisticsEdScreen({ edId }: { edId: string }) {
  const department = edById(edId);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!department) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Emergency department not found"
        subtitle="The address names an emergency department this prototype does not have."
        testId="ward-statistics-ed-screen"
      >
        <section className={styles.section}>
          {/* No heading here — the frame's own `<h1>` already reads "Emergency department not
              found", and a second heading restating it was the near-duplicate fix round 1 found. */}
          <p className={styles.notFoundBody} data-testid="ward-statistics-ed-unresolved">
            No emergency department in this prototype has the id <span className={styles.unresolvedId}>{edId}</span>. It
            may have been renamed or removed, or the id in the address may be wrong. This page never falls back to a
            different department, because a page showing the wrong department under the right heading is worse than a
            page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
              Choose an emergency department from the comparisons page
            </Link>{" "}
            to reach one that does exist.
          </p>
        </section>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(department.siteCode);

  return (
    <StatisticsSectionFrame
      section={section}
      title={department.name}
      subtitle="What this section will hold about this emergency department, and what has not been built in it yet."
      testId="ward-statistics-ed-screen"
    >
      <section className={styles.section} data-testid="ward-statistics-ed-identity">
        <h2 className={styles.sectionHeading}>Which emergency department this is</h2>
        <p className={styles.body} data-testid="ward-statistics-ed-site">
          {site
            ? `${department.name} is recorded at ${site.name}.`
            : `${department.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
        </p>
        <p className={styles.note}>
          A name and a hospital, and nothing else. Neither is a measurement, so neither can be wrong in the way a figure
          can be wrong.
        </p>
      </section>

      <section className={styles.section} data-testid="ward-statistics-ed-not-built">
        <h2 className={styles.sectionHeading}>Nothing about this department is measured here yet</h2>

        <p className={styles.notBuilt} data-testid="ward-statistics-ed-not-built-body">
          <strong>
            No figure about this emergency department is shown here — not a nought, and not a dash standing where a
            number will go.
          </strong>{" "}
          Which of them are a derivation away and which the record cannot support at all are different answers, and this
          page keeps them apart rather than calling everything absent.
        </p>

        {/*
         * ⚠️ **THIS PARAGRAPH ONCE PROMISED THREE FIGURES AND SORTED THEM WRONGLY IN BOTH
         * DIRECTIONS.** It read "how many people are waiting, how long they have waited and how many
         * left without a bed are all absent here on purpose" — and "absent on purpose" reads as
         * unbuilt, meaning coming. Two of those three are within reach and the third is not a
         * derivation at all. Naming which is which is the entire job of this section; a page that
         * lumps them together is doing the thing it exists to prevent.
         *
         * Read from `ward-model.ts` and `ward-referrals.ts` on 2026-09-01.
         *
         * ⚠️ **"THE TWO CLOCKS THE REFERRAL RECORD ALREADY KEEPS" WAS UNEARNED AND IS NOW NAMED.**
         * It named neither and could not have defended either: `Referral.raisedAt` is required, but
         * `triagedAt` is OPTIONAL, so a referral may carry none at all — and nothing in the model
         * orders the two, so a `triagedAt` may sit EARLIER than the `raisedAt` beside it, because
         * somebody can be in a department for hours before psychiatry is called. Two instants that
         * can be absent and can run backwards are not a pair a duration may be quietly assumed from.
         *
         * ⚠️ **THE FIRST CORRECTION REACHED FOR THE SEED AND HAD TO BE CORRECTED AGAIN.** It read
         * "most seeded referrals carry none", and named the one fixture referral whose triage runs
         * backwards. Both were true on 2026-09-01 and neither is a property of this page: a seed edit
         * falsifies them and nothing goes red. What the page may say is what the TYPE establishes —
         * optional, and unordered — which is pinned in `statistics-claims-register.ts` as
         * `statistics-ed-screen/attributable/triaged-at-is-optional`.
         *
         * The paragraph's conclusion is unchanged and stands on the movement side instead, where
         * `Movement.originEdId` is a required `string` on every movement — so which department a
         * person is in is never missing.
         */}
        <p className={styles.body} data-testid="ward-statistics-ed-attributable">
          <strong>Nothing is stored on a department itself.</strong>{" "}
          <code className={styles.field}>EmergencyDepartment</code> holds an id, a site code and a name, and no figure
          could ever sit on it. Two other records name one, and they are where a department&apos;s figures would come
          from: <code className={styles.field}>Movement.originEdId</code> says which department a person is physically
          in — a required field, never missing — alongside when their movement opened, what stage it has reached and
          every ward decline against it; and a referral addressed to this department&apos;s psychiatry service carries{" "}
          <code className={styles.field}>edId</code> on its destination. The referral&apos;s own clocks are weaker than
          they look: <code className={styles.field}>raisedAt</code> is always there, but{" "}
          <code className={styles.field}>triagedAt</code> is optional, so a referral may carry no triage instant at all
          — and where both exist the triage can precede the referral, because somebody can be in a department for hours
          before psychiatry is called. So how many people this department is currently waiting on, and how long each has
          been waiting, are derivable from the movement side, and simply not yet derived.
        </p>

        <p className={styles.body} data-testid="ward-statistics-ed-unrecordable">
          <strong>How busy the department is, though, is not a derivation away — the model has no field for it.</strong>{" "}
          Every record above describes somebody mental health has been told about. Emergency department medical staff
          are not users of this system: their request arrives verbally, and psychiatry then raise the referral. So
          attendances this service was never told about are outside the model entirely, and no figure on this page could
          count them. Adding them is a design question about what this prototype is for, not a task somebody has yet to
          get to.
        </p>

        <p className={styles.body} data-testid="ward-statistics-ed-near-miss">
          <strong>And one figure would be easy to publish and wrong.</strong> A movement can close with the outcome{" "}
          <code className={styles.field}>did_not_proceed</code>, which looks like a count of people who left without a
          bed and is not one: it records a movement that ended without admission, typically because an examination found
          admission was not needed. Publishing it under that heading would rename a clinical outcome as a failure of
          flow. Whether anything here should be counted as leaving without a bed is a question for the owner, and until
          it is answered this page shows no such figure — deliberately, and never as a nought.
        </p>

        <p className={styles.body}>
          <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
            Choose another ward or emergency department
          </Link>
        </p>
      </section>
    </StatisticsSectionFrame>
  );
}
