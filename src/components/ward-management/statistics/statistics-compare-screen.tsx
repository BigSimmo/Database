"use client";

import Link from "next/link";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  edStatisticsHref,
  statisticsSectionById,
  wardStatisticsHref,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { EmergencyDepartment, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./statistics-sections.module.css";

/**
 * WARD AND ED COMPARISONS — and the chooser that is the only way into the per-unit detail pages.
 *
 * ⚠️ **NO COMPARISON IS SHOWN, AND THE LIST BELOW IS NOT ONE.** The list is navigation: every ward
 * and every emergency department, each a link to its own detail page. It is not a ranking, not a
 * shortlist and not an ordering by anything — the units keep the order the fixture records them in,
 * and the page says so, because a list of units on a page headed "comparisons" is read as a league
 * table unless it denies being one.
 *
 * ⚠️ **The comparison itself is the hard part and it is not built.** Choosing which measure to set
 * beside every unit decides what the page claims, and a figure shown side by side carries a verdict
 * whether or not one was intended — a ward at the bottom of a column looks like a ward doing badly,
 * when it may simply be the ward taking the people nobody else can. The statistics home page
 * already withholds one such figure pending an owner ruling. That question has to be answered per
 * measure, before any column exists.
 *
 * **Why the chooser lives here.** The per-unit detail routes are dynamic — one route serving every
 * ward, one serving every emergency department — so the section has no index page of its own, and
 * a dynamic route with no concrete link anywhere is a page only reachable by typing an address.
 * This is the one page whose subject is the whole set of units, so this is where the way in
 * belongs. `STATISTICS_UNIT_CHOOSER_ID` is the anchor the hub's third section links to.
 *
 * **Wards come from the provider's live `units`**, never from the frozen fixture, which is what
 * `tests/ward-flow-single-source.test.ts` requires of every screen: a surface reading `allUnits()`
 * instead of live state is how a ward that has changed can still be described by its seeded values.
 * This page renders no unit state at all, so it could not show that staleness today — but the rule
 * is structural on purpose, and "this screen's fields never change" is exactly the exemption that
 * would stop it meaning anything. Emergency departments are not in provider state at all (they are
 * identity, not capacity), so they come from `allEmergencyDepartments()`, the same source
 * `ed-screen.tsx` resolves a department from.
 */
export function StatisticsCompareScreen({
  units: unitsOverride,
  emergencyDepartments: edsOverride,
}: {
  /** A testing seam only — nothing in the app passes either. The route renders this screen with no
   *  props, exactly as `WardIndex` documents on its own override: it exists so a test can render
   *  states the seeded network cannot produce, such as a unit whose site code resolves to nothing. */
  units?: Unit[];
  emergencyDepartments?: EmergencyDepartment[];
} = {}) {
  const { units: liveUnits } = useWardFlow();
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  const perUnitSection = statisticsSectionById("units");
  if (!perUnitSection) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  return (
    <StatisticsSectionFrame
      section={section}
      subtitle="What this section is for, what has not been built in it yet, and the way in to a single unit."
      testId="ward-statistics-compare-screen"
    >
      <section className={styles.section} data-testid="ward-statistics-compare-scope">
        <h2 className={styles.sectionHeading}>What this section will hold</h2>
        <p className={styles.body}>{section.description}</p>
      </section>

      <section className={styles.section} data-testid="ward-statistics-compare-not-built">
        <h2 className={styles.sectionHeading}>No comparison is built yet</h2>

        <p className={styles.notBuilt} data-testid="ward-statistics-compare-not-built-body">
          <strong>
            Nothing on this page compares one unit with another. There is no column, no ordering by any measure and no
            figure of any kind — not a nought, and not a blank cell waiting to be filled.
          </strong>{" "}
          The comparison is unwritten, and a table showing plausible numbers would be believed long before anybody
          checked whether the measure behind it could be attributed to a named unit at all.
        </p>

        {/*
         * ⚠️ **THIS PASSAGE CARRIED A FALSE STATEMENT ABOUT THE MODEL UNTIL 2026-09-01, and it was
         * the passage a reviewer had singled out as the one meeting the home page's standard.** It
         * said `ReferralAddressing` "carries no unit at all". It does carry one —
         * `acceptedUnitId` — and the conclusion drawn from the false premise happened to be
         * correct. Right conclusion, wrong stated reason, every test green: the third time that
         * shape has been found on this screen in a day, and the reason the rule below is written as
         * a property of the record rather than as a list of measures somebody has to remember.
         *
         * Every claim in the three paragraphs below was read from `ward-model.ts` and
         * `ward-admissions.ts` on 2026-09-01 rather than taken from a report.
         */}
        <p className={styles.body} data-testid="ward-statistics-compare-attributability-rule">
          <strong>
            A measure can be set against a named ward only when the record it comes from carries a required unit id.
          </strong>{" "}
          That is the test every column here will have to pass, and it is a property of the record rather than a
          judgement about the measure. An <code className={styles.fieldName}>Admission</code> carries{" "}
          <code className={styles.fieldName}>unitId</code> and always has one, so anything derived from admissions
          attributes cleanly. A unit id that is optional attributes only to the part of the population where it happens
          to be set — which is never the whole column, and never the part a reader assumes.
        </p>

        <p className={styles.body} data-testid="ward-statistics-compare-declines-example">
          <strong>Declines are the worked example, and the asymmetry in them is the thing to see.</strong> A referral
          decline sits on <code className={styles.fieldName}>ReferralAddressing</code>, whose ward destination records
          the bed&apos;s criteria — the sex it must suit, whether it must be secure, whether it must be able to hold
          somebody involuntarily — and never a unit. The one field there that CAN name a ward is{" "}
          <code className={styles.fieldName}>acceptedUnitId</code>, and it is set only when a ward accepts. So from a
          single record an acceptance is attributable to a named ward and a decline is not — and in a comparison table
          those two would sit in adjacent columns looking equally solid, one of them counting the whole population and
          the other counting only the part that said yes.
        </p>

        <p className={styles.body} data-testid="ward-statistics-compare-double-count-example">
          <strong>Referrals received is the other one, and it fails differently — it double-counts.</strong>{" "}
          <code className={styles.fieldName}>Movement.referredUnitIds</code> is a list, not a single id: one
          person&apos;s referral can be live at several wards at once, capped by{" "}
          <code className={styles.fieldName}>PARALLEL_REFERRAL_CAP</code>. A per-ward column of referrals received would
          therefore sum to more than the number of referrals that exist, and the more widely a referral is cast the
          wider the gap. It reconciles to nothing, and the arithmetic gets blamed.
        </p>

        <p className={styles.note}>
          Anything keyed to the department a person came from attributes to an emergency department, not to a ward —
          which is a category error rather than a rounding one. Which measures survive all of this, and whether setting
          any of them side by side implies a judgement nobody intends, is the owner&apos;s decision rather than an
          implementer&apos;s.
        </p>
      </section>

      <section className={styles.section} data-testid="ward-statistics-compare-chooser">
        <h2 className={styles.sectionHeading} id={STATISTICS_UNIT_CHOOSER_ID}>
          Choose a ward or emergency department
        </h2>
        <p className={styles.body}>{perUnitSection.description}</p>

        {/*
         * ⚠️ **WHY THE CHOOSER IS HERE, SAID ON THE SCREEN.** Until fix round 1 this reasoning lived
         * only in this file's doc comment, where the reader it is for — somebody who arrives
         * wondering why a list of units is on a page about comparisons — will never look. The
         * arrangement is deliberate and a reader is entitled to know that rather than infer a
         * mistake.
         */}
        <p className={styles.note} data-testid="ward-statistics-compare-chooser-rationale">
          The unit list is on this page because per-unit detail has no page of its own: one route serves every ward and
          another serves every emergency department, so the way in is a choice rather than an index. This is the page
          whose subject is the whole set of units, so this is where that choice belongs.
        </p>

        {/*
         * The denial has to be on the page, not only in the source. A list of every unit under a
         * heading about comparisons is read as an ordering by something; saying plainly that it is
         * the order the units are recorded in costs one sentence and removes the inference.
         */}
        <p className={styles.note} data-testid="ward-statistics-compare-order-note">
          These are in the order the prototype records them in, which carries no meaning. Nothing here is ranked,
          scored, sorted by any measure, or hidden.
        </p>

        <h3 className={styles.subHeading}>Wards</h3>
        {units.length === 0 ? (
          <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-wards">
            No ward is recorded in this prototype, so there is none to choose.
          </p>
        ) : (
          <ul className={styles.unitList} data-testid="ward-statistics-compare-ward-list">
            {units.map((unit) => {
              const site = siteByCode(unit.siteCode);
              return (
                <li key={unit.id} className={styles.unitItem}>
                  <Link href={wardStatisticsHref(unit.id)} className={styles.unitLink}>
                    <span className={styles.unitName}>{unit.name}</span>
                    {/* A ward whose site code resolves to nothing still appears, and says so, rather
                        than vanishing from the list. A unit silently dropped from the only chooser
                        that reaches its detail page is unreachable AND unreported. */}
                    <span className={styles.unitKind}>
                      {site ? site.name : "Its site code matches no site in this prototype."}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className={styles.subHeading}>Emergency departments</h3>
        {emergencyDepartments.length === 0 ? (
          <p className={styles.emptyNote} data-testid="ward-statistics-compare-no-eds">
            No emergency department is recorded in this prototype, so there is none to choose.
          </p>
        ) : (
          <ul className={styles.unitList} data-testid="ward-statistics-compare-ed-list">
            {emergencyDepartments.map((department) => {
              const site = siteByCode(department.siteCode);
              return (
                <li key={department.id} className={styles.unitItem}>
                  <Link href={edStatisticsHref(department.id)} className={styles.unitLink}>
                    <span className={styles.unitName}>{department.name}</span>
                    <span className={styles.unitKind}>
                      {site ? site.name : "Its site code matches no site in this prototype."}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StatisticsSectionFrame>
  );
}
