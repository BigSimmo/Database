"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { WardPanel } from "@/components/ward-management/ward-panel";

import styles from "./statistics-sections.module.css";

/**
 * ONE EMERGENCY DEPARTMENT IN DETAIL — the per-department statistics page.
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
 * two screens rather than one taking a kind, and it is also why the figures each hold are not the
 * same figures — a department has no beds to be occupied, so none of the three counts below is a
 * bed measure.
 *
 * **The department comes from `allEmergencyDepartments()` via `edById`**, which is where
 * `ed-screen.tsx` resolves one from too. Emergency departments are not in provider state at all:
 * the provider holds `units`, because unit capacity changes as the prototype runs, and a
 * department's identity does not. `movements`, unlike the department itself, DOES come from the
 * provider (`useWardFlow()`) rather than a frozen fixture, because who is on the list right now is
 * exactly the kind of fact that changes as the prototype runs.
 *
 * ⚠️ **ADDED 2026-09-05: THE THREE FIGURES `Movement.originEdId` CAN SUPPORT.** Until now this page
 * showed no figure at all. `originEdId` is a required field on every movement, so a count keyed to
 * it never misattributes anyone and never leaves anyone out — the same property
 * `statistics-compare-screen.tsx` relies on for its own department table, and the same three
 * derivations, so the two pages can never disagree about one department. What still is not shown —
 * how long anyone has waited, how busy the department is, and anything resembling "left without a
 * bed" — is explained in the section below the figures, and stays unbuilt for the reasons given
 * there rather than by omission.
 */
export function StatisticsEdScreen({ edId }: { edId: string }) {
  const { movements } = useWardFlow();
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
        <div className={styles.notFoundBlock}>
          {/* No heading here, and NOT a WardPanel: that primitive requires a title and the frame's own `<h1>` already reads "Emergency department not
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
        </div>
      </StatisticsSectionFrame>
    );
  }

  const site = siteByCode(department.siteCode);

  /*
   * ⚠️ **THE SAME THREE DERIVATIONS THE COMPARISONS TABLE USES, ON PURPOSE.** `originEdId` is a
   * required field on every `Movement` (see the attributable paragraph below), which is why a
   * count built from it never misattributes anyone and never leaves anyone out. Read from
   * `statistics-compare-screen.tsx`'s `ED_COLUMNS` row builder rather than re-derived independently,
   * so the single-department page and the comparisons page cannot disagree about the same
   * department on the same render.
   */
  const departmentMovements = movements.filter((movement) => movement.originEdId === department.id && isOpen(movement));
  const onTheList = departmentMovements.length;
  const urgent = departmentMovements.filter((movement) => movement.flaggedUrgent).length;
  const unplaced = departmentMovements.filter((movement) => movement.acceptedUnitId === undefined).length;

  return (
    <StatisticsSectionFrame
      section={section}
      title={department.name}
      subtitle="What this prototype can measure about this emergency department, and what its record cannot support yet."
      testId="ward-statistics-ed-screen"
    >
      <WardPanel title="Which emergency department this is" testId="ward-statistics-ed-identity">
        <div className={styles.panelBody}>
          <p className={styles.body} data-testid="ward-statistics-ed-site">
            {site
              ? `${department.name} is recorded at ${site.name}.`
              : `${department.name} carries a site code this prototype has no site for, so it cannot be placed at a hospital here.`}
          </p>
          <p className={styles.note}>
            A name and a hospital, and nothing else. Neither is a measurement, so neither can be wrong in the way a
            figure can be wrong.
          </p>
        </div>
      </WardPanel>

      {/*
       * 🔴 **ADDED 2026-09-05: THE THREE FIGURES `Movement.originEdId` CAN ACTUALLY SUPPORT.**
       * `originEdId` is a required field on every movement, which is why these three attribute
       * cleanly to a single named department — the same test the comparisons page's own
       * `ED_COLUMNS` sets for itself. Nothing here is a bed measure: an emergency department has no
       * beds, no capacity and no length of stay in this model, and this section adds none of those.
       */}
      <WardPanel title="What can be measured about this department" testId="ward-statistics-ed-measures">
        <div className={styles.panelBody}>
          <p className={styles.body}>
            All three come from the same required fact: every movement records which department the person is physically
            in, always, so a count built from it never misattributes anyone and never leaves anyone out. These are the
            same derivations the comparisons page sets beside every other department, so the two pages can never
            disagree about this one.
          </p>

          <h3 className={styles.subHeading}>On the list</h3>
          <p className={styles.body} data-testid="ward-stat-ed-on-the-list">
            {onTheList} — everyone with an open movement whose origin is this department right now.
          </p>

          <h3 className={styles.subHeading}>Marked urgent</h3>
          <p className={styles.body} data-testid="ward-stat-ed-urgent">
            {urgent} of the {onTheList} above are flagged urgent.
          </p>

          <h3 className={styles.subHeading}>No ward yet</h3>
          <p className={styles.body} data-testid="ward-stat-ed-unplaced">
            {unplaced} of the {onTheList} above have no ward that has accepted them yet.
          </p>

          <p className={styles.note}>
            A movement counts as open until it closes or the person arrives in a bed. &quot;No ward yet&quot; is every
            open movement with no accepting ward recorded against it. None of the three is a measure of the department
            itself — how busy it is cannot be counted at all, for the reason the next section gives.
          </p>
        </div>
      </WardPanel>

      <WardPanel title="What else is not measured here" testId="ward-statistics-ed-not-built">
        <div className={styles.panelBody}>
          <p className={styles.notBuilt} data-testid="ward-statistics-ed-not-built-body">
            <strong>
              The three figures above are the only ones this page shows — nothing else here is a nought, and nothing
              stands as a dash where a further number would go.
            </strong>{" "}
            Which of the rest are a derivation away and which the record cannot support at all are different answers,
            and this page keeps them apart rather than calling everything absent.
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
            <strong>Nothing is stored on a department itself.</strong> A department record holds an id, a site code and
            a name, and no figure could ever sit on it. Two other records name one, and they are where a
            department&apos;s figures would come from. A movement says which department a person is physically in —
            always, never missing — alongside when their movement opened, what stage it has reached and every ward
            decline against it. And a referral addressed to this department&apos;s psychiatry service names the
            department on its destination. The referral&apos;s own clocks are weaker than they look: the moment it was
            raised is always recorded, but the moment it was triaged is optional, so a referral may carry no triage
            instant at all — and where both exist the triage can precede the referral, because somebody can be in a
            department for hours before psychiatry is called. So how many people this department is currently waiting on
            is derivable from the movement side, and is shown above; how long each has been waiting draws on that same
            required field and is not derived here.
          </p>

          <p className={styles.body} data-testid="ward-statistics-ed-unrecordable">
            <strong>
              How busy the department is, though, is not a derivation away — the model has no field for it.
            </strong>{" "}
            Every record above describes somebody mental health has been told about. Emergency department medical staff
            are not users of this system: their request arrives verbally, and psychiatry then raise the referral. So
            attendances this service was never told about are outside the model entirely, and no figure on this page
            could count them. Adding them is a design question about what this prototype is for, not a task somebody has
            yet to get to.
          </p>

          <p className={styles.body} data-testid="ward-statistics-ed-near-miss">
            <strong>And one figure would be easy to publish and wrong.</strong> A movement can close with an outcome
            meaning it did not proceed, which looks like a count of people who left without a bed and is not one: it
            records a movement that ended without admission, typically because an examination found admission was not
            needed. Publishing it under that heading would rename a clinical outcome as a failure of flow. Whether
            anything here should be counted as leaving without a bed is a question for the owner, and until it is
            answered this page shows no such figure — deliberately, and never as a nought.
          </p>

          <p className={styles.body}>
            <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
              Choose another ward or emergency department
            </Link>
          </p>
        </div>
      </WardPanel>
    </StatisticsSectionFrame>
  );
}
