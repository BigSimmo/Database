"use client";

import Link from "next/link";

import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./ward-index.module.css";

/**
 * Phase 8: the ward index — every ward in the network, grouped by health service, each one a link
 * to its own ward screen.
 *
 * **Why it exists.** `ward/[unitId]` serves twenty-three wards and exactly ONE of them was named by
 * a concrete href anywhere in the source: `ward-nav.ts`'s seeded `rph-adult-secure` example. The
 * only other builder, `ward-role-switcher.tsx`, works over `wardCandidates` — empty unless a
 * movement is focused, otherwise nought to three units implied by that selection. So twenty-two
 * ward screens could be reached only by typing an address. That shortfall is recorded as a figure
 * in `tests/ward-nav.test.ts`'s `WARD_DYNAMIC_ROUTE_ORPHANS`, and this page is what closes it.
 *
 * **Deliberately not a second dashboard. Owner's decision, and it is the constraint that shapes
 * the whole file.** No bed count, no empty/allocatable figure, no availability, no occupancy, no
 * pressure colour — nothing this page renders answers a question the capacity board, the morning
 * bed state or a ward's own screen already answers. Two surfaces answering one question in wording
 * that can drift is this project's most reliable defect, and an index that quietly grew a bed
 * column would be exactly that. What a ward IS — its name, who it takes, whether it is locked —
 * cannot drift against a figure, because it is not a figure. If a number is ever wanted here,
 * that is a product decision, not an implementer's convenience.
 *
 * **Enumerated, never listed.** The wards come from the provider's live `units`, which is the whole
 * network (`scenarioUnits` clones `allUnits()` and neither scenario filters it), so a ward seeded
 * into `ward-sites.ts` appears here the moment it exists. A hand-written list of wards is the exact
 * defect shape this phase has spent a fortnight removing.
 *
 * `units` comes from the provider rather than from `allUnits()` directly, which is what
 * `tests/ward-flow-single-source.test.ts`'s `UNITS_FIXTURE_ALLOWLIST` requires of every screen: a
 * surface reading the frozen fixture instead of live state is how a ward could confirm zero
 * allocatable beds while a shortlist still called it eligible (whole-branch review Critical 1).
 * This page renders no capacity at all, so it could not show that particular staleness — but the
 * rule is structural on purpose, and a screen that reads the fixture "because its own fields never
 * change" is precisely the exemption that stops the rule meaning anything.
 *
 * **A ward whose site cannot be resolved still appears**, under its own stated heading, rather than
 * vanishing from every group. `siteByCode` returning `undefined` for a broken site code is the
 * ordinary conservative failure this phase is built on: the page says it cannot place the ward, and
 * still gives you the way in. A unit silently dropped from an index is unreachable AND unreported,
 * which is strictly worse than the orphan this page exists to fix.
 *
 * **No ordering claim of any kind.** Services run in `wardServiceOrder` — the one canonical order,
 * never a second copy — and within a service the wards keep the fixture's own order. Nothing here
 * sorts, ranks, scores, truncates or hides a ward, and no heading, label or badge carries a
 * comparative word.
 */
export function WardIndex({ units: unitsOverride }: { units?: Unit[] }) {
  const { units: liveUnits } = useWardFlow();
  // The provider's live units unless a caller supplies its own. Nothing in the app does — the route
  // renders `<WardIndex />` — and this is the same testing seam, with the same justification, that
  // `OutOfAreaBoard` documents on its own default parameter: it exists so a test can render the two
  // states the seeded network cannot produce, an empty health service and a ward whose site code
  // resolves to nothing. Those are precisely the two states whose wording is easiest to get wrong
  // and hardest to ever see, and the second one is this page's conservative-failure requirement.
  const units = unitsOverride ?? liveUnits;

  // One lookup per unit (23 units — cheap), the same shape `flow-diagram.tsx` uses. A unit whose
  // site code resolves to nothing is excluded from every service group here rather than guessed
  // into one, and `unplaced` below picks it up so it is still on the page.
  const serviceGroups: { service: HealthService; units: Unit[] }[] = wardServiceOrder.map((service) => ({
    service,
    units: units.filter((unit) => siteByCode(unit.siteCode)?.service === service),
  }));

  // Derived by subtraction from the groups actually rendered, never by re-testing the condition.
  // Re-deriving it would let the two tests disagree — a unit could satisfy neither and appear
  // nowhere, which is the silent drop this group exists to prevent.
  const grouped = new Set(serviceGroups.flatMap((group) => group.units.map((unit) => unit.id)));
  const unplaced = units.filter((unit) => !grouped.has(unit.id));

  return (
    <div className={styles.screen} data-testid="ward-index">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-index-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This page is <strong>not a medical device</strong>. Every ward listed here is invented, and nothing on it
            has been checked against a real service.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>All wards</h1>
          <p className={styles.pageSubtitle}>Every ward in this prototype&apos;s network, by health service.</p>
        </header>

        {/*
         * What this page is NOT, said on the page rather than only in the source. A reader arriving
         * at a list of every ward reasonably expects it to tell them where the beds are; saying
         * plainly that it does not is cheaper than having them infer an absence of beds from an
         * absence of numbers.
         */}
        <p className={styles.provenance} data-testid="ward-index-provenance">
          This is a way in, not a bed state. It shows what each ward is and links to it — no bed numbers, no
          availability and nothing about who is in a bed. The capacity and morning bed state boards answer those
          questions, and a ward&apos;s own screen answers them for that ward.
        </p>

        {serviceGroups.map((group) => (
          <section
            key={group.service}
            className={styles.section}
            data-testid={`ward-index-service-${slug(group.service)}`}
          >
            <h2 className={styles.sectionHeading}>{group.service}</h2>
            {group.units.length === 0 ? (
              // An empty service is rendered as an empty service, not omitted. A heading that
              // disappears when its group empties makes the reader work out which services exist
              // from which ones they can see, and this page's whole job is to stop wards being
              // invisible.
              <p className={styles.emptyNote}>No ward in this prototype belongs to this health service.</p>
            ) : (
              <ul className={styles.wardList}>
                {group.units.map((unit) => (
                  <WardLink key={unit.id} unit={unit} />
                ))}
              </ul>
            )}
          </section>
        ))}

        {unplaced.length > 0 && (
          <section className={styles.section} data-testid="ward-index-unplaced">
            <h2 className={styles.sectionHeading}>Not placed in a health service</h2>
            <p className={styles.unplacedNote}>
              This prototype holds no site for these wards&apos; site codes, so it cannot say which health service they
              belong to. They are listed here rather than left off the page, and each one still links to its ward
              screen.
            </p>
            <ul className={styles.wardList}>
              {unplaced.map((unit) => (
                <WardLink key={unit.id} unit={unit} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * One ward, one link. `<Link>` and never a raw anchor — internal navigation in this repository goes
 * through the router, and the href is built from the unit's own id so it cannot name a ward that
 * does not exist.
 *
 * The two descriptors are what the record already says about the ward and nothing derived: `cohort`
 * (who it takes) and `security` (open or locked). Both are plain fields on `Unit`. Neither is a
 * count, and neither can go stale against a figure on another screen, because neither is a figure.
 * `authorised` is deliberately NOT rendered: it is the bed's legal-status capability, and a
 * legal-status word on a ward index is the shape that invites a legal figure beside it later.
 */
function WardLink({ unit }: { unit: Unit }) {
  return (
    <li className={styles.wardItem}>
      <Link className={styles.wardLink} href={`/mockups/ward-flow/ward/${unit.id}`} data-testid="ward-index-link">
        <span className={styles.wardName}>{unit.name}</span>
        <span className={styles.wardKind}>
          {unit.cohort} · {unit.security}
        </span>
      </Link>
    </li>
  );
}

/** A test id fragment, never a display string and never an href — the service names above render
 *  verbatim from `wardServiceOrder`. */
function slug(service: HealthService): string {
  return service.toLowerCase().split(" ").join("-");
}
