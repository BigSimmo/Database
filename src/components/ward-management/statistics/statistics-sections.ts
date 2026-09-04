/**
 * THE SECTIONS OF THE STATISTICS SCREEN, IN ONE PLACE.
 *
 * ⚠️ **This module exists so that the section list is written down exactly once.** The hub index on
 * the statistics home page, each section screen's own header, and the tests that check they agree
 * all read this file. A second copy of "Across all services" — in a heading, in a nav label, in a
 * test literal — is how the hub comes to promise one thing and the page to deliver another, and
 * nothing would fail while they drifted.
 *
 * ⚠️ **NOTHING HERE IS A FIGURE, AND NOTHING HERE MAY BECOME ONE.** A description says what a
 * section will hold. It never says how many wards there are, how many measures exist, or how much
 * of the section is built — those are counts, and a count written into a constant is a count that
 * stops being true silently. The screens state what is unbuilt in prose instead.
 *
 * **Why there are three sections and five routes.** The owner named three: figures across all
 * services, comparisons between units, and detail for one named unit. The third is served by two
 * dynamic routes — one for wards, one for emergency departments — because a ward and an emergency
 * department are different records with different fields, not one list with a flag. So the third
 * section has no index page of its own: it is reached by choosing a unit, and the chooser lives on
 * the comparisons page, which is the one page whose whole subject is the set of units. That is what
 * `STATISTICS_UNIT_CHOOSER_ID` and the fragment on the third section's `href` are for. It is stated
 * here rather than left to be inferred, because a hub entry that lands somewhere other than a page
 * of its own is exactly the kind of thing a later reader "tidies up" into a wrong shape.
 */

/** The statistics home page — the hub that indexes the sections below. */
export const STATISTICS_HOME_HREF = "/mockups/ward-flow/statistics";

/**
 * ⚠️ **THE FULL PATH IS WRITTEN OUT, NEVER COMPOSED — and that is a reachability requirement rather
 * than a style preference.** The repository's route scan reads SOURCE TEXT: it can see a literal
 * route path and cannot see one assembled at runtime, however correct the resulting string is. Both
 * of these were composed from `STATISTICS_HOME_HREF` until 2026-09-01, and on that day the strings
 * "/mockups/ward-flow/statistics/overview" and "/mockups/ward-flow/statistics/compare" appeared
 * NOWHERE in `src` — only in this module's own test. Two real, linked, working routes were invisible
 * to the scan, and nothing anywhere went red about it.
 *
 * This is the same rule `wardStatisticsHref` and `edStatisticsHref` below already follow, and it is
 * the reason their duplicated prefix is deliberate. `STATISTICS_HOME_HREF` stays a literal beside
 * them because it is a route in its own right and is linked as one.
 *
 * Ward Lead is building an invariant test that walks every route directory under
 * `src/app/mockups/ward-flow` and asserts its literal prefix appears in `src` source text. These
 * three sites were written out by hand ahead of it; if that test later flags something here, the
 * two are the same finding.
 */
export const STATISTICS_OVERVIEW_HREF = "/mockups/ward-flow/statistics/overview";

export const STATISTICS_COMPARE_HREF = "/mockups/ward-flow/statistics/compare";

/**
 * The id of the unit chooser on the comparisons page. The third section's `href` points at it, and
 * the comparisons screen puts it on the chooser's own heading — one constant, so a rename cannot
 * leave the hub linking at an anchor that no longer exists.
 */
export const STATISTICS_UNIT_CHOOSER_ID = "choose-a-unit";

/**
 * The link to the chooser — the comparisons route plus its anchor.
 *
 * ⚠️ **Every link to the chooser uses this, never a bare `STATISTICS_COMPARE_HREF`.** Fix round 1
 * found the four in-page links back to the chooser had each dropped the fragment, so a reader who
 * clicked "choose a ward" landed at the top of a page that opens with two sections about why no
 * comparison exists and had to scroll to find the list — and a test asserting the bare href had
 * blessed it. A constant is what makes the correct link the cheap one to write.
 */
export const STATISTICS_UNIT_CHOOSER_HREF = `/mockups/ward-flow/statistics/compare#${STATISTICS_UNIT_CHOOSER_ID}`;

export type StatisticsSectionId = "overview" | "compare" | "units";

export type StatisticsSection = {
  id: StatisticsSectionId;
  /** The section's name, as it is written wherever the section is named. */
  label: string;
  /** One line saying what the section is for. Never a claim that anything in it is built. */
  description: string;
  /** Where a reader is sent to reach the section. */
  href: string;
};

export const STATISTICS_SECTIONS: readonly StatisticsSection[] = [
  {
    id: "overview",
    label: "Across all services",
    description: "Figures about the prototype as a whole, and about Western Australia, rather than about any one unit.",
    href: STATISTICS_OVERVIEW_HREF,
  },
  {
    id: "compare",
    label: "Ward and ED comparisons",
    description: "The same measure set beside every ward and emergency department, so differences can be seen.",
    href: STATISTICS_COMPARE_HREF,
  },
  {
    id: "units",
    label: "One ward or emergency department in detail",
    description: "Everything the model can honestly say about a single named unit, chosen from the comparisons page.",
    href: STATISTICS_UNIT_CHOOSER_HREF,
  },
] as const;

/** Returns `undefined` for an unknown id. Never falls back to a different section. */
export function statisticsSectionById(id: string): StatisticsSection | undefined {
  return STATISTICS_SECTIONS.find((section) => section.id === id);
}

/**
 * The two per-unit detail routes.
 *
 * ⚠️ **THE PATH IS WRITTEN OUT IN FULL RATHER THAN BUILT FROM `STATISTICS_HOME_HREF`, DELIBERATELY,
 * AND MUST STAY THAT WAY.** This is the one place in this module where "one place per fact" is
 * knowingly given up, so the reason is recorded here rather than left to be rediscovered.
 *
 * `tests/ward-nav.test.ts` scans the source for a LITERAL route path to prove a dynamic route can
 * be reached at all. Built by interpolating the home-href constant the prefix is a variable, the scan
 * finds nothing, and both of these routes read as referenced by no link anywhere — which is exactly
 * the state the board route shipped in, and the reason that assertion exists. A page nothing can be
 * proven to link to is a page nobody finds; a duplicated prefix on two adjacent lines is a much
 * smaller risk than that, and `statistics-sections.ts` keeps both builders side by side so the
 * duplication cannot scatter.
 *
 * This is the house pattern rather than a local exception: `ward-screen.tsx` and
 * `patient-search.tsx` both write their whole route path into the template and interpolate only the
 * id. (Their example hrefs are deliberately not quoted here — a concrete route path sitting in a
 * comment is itself a source reference, and this module should not vouch for routes it does not
 * link to.) `tests/ward-statistics-sections.test.ts` pins the literal, so tidying it back into the
 * variable goes red here rather than only in a file this task may not edit.
 *
 * `encodeURIComponent` on the way out because the routes `decodeURIComponent` on the way in — the
 * pair has to be symmetric, or an id containing a character that needs escaping would resolve on
 * one side of the link and not the other. Today's ids are plain slugs, which is precisely why this
 * would go unnoticed if it were wrong.
 *
 * ⚠️ The prefix is written out in full rather than composed from `STATISTICS_HOME_HREF`, and that is
 * deliberate. `tests/ward-nav.test.ts` establishes that every dynamic route has a way in by reading
 * the SOURCE TEXT for an href, and a path assembled from a constant is invisible to any such scan —
 * so this page was reported as reachable by nothing at all while the comparisons page linked every
 * ward on it. The literal is pinned against the constant in `tests/ward-statistics-sections.test.ts`,
 * so the two cannot drift.
 */
export function wardStatisticsHref(unitId: string): string {
  return `/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;
}

/** The detail route for one emergency department. See `wardStatisticsHref` — same two reasons. */
export function edStatisticsHref(edId: string): string {
  return `/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;
}
