import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import {
  edStatisticsHref,
  statisticsSectionById,
  wardStatisticsHref,
  STATISTICS_OVERVIEW_HREF,
  STATISTICS_SECTIONS,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE FOUR STATISTICS SECTION SCREENS, ON THE SCREEN.
 *
 * ⚠️ **WHAT ONLY A RENDERED PAGE CAN PROVE, and therefore what this file is for.**
 * `tests/ward-statistics-sections.test.ts` already proves the section list is coherent and that the
 * routes it names exist on disk. Four things survive a coherent list and can still make these pages
 * lie, and each has its own test below:
 *
 *   1. **A figure appearing where none was measured.** The whole plan is "skeleton means skeleton":
 *      a nought standing in for an unwritten derivation is indistinguishable, on screen, from a
 *      nought that was measured. The check is the strongest form available — the overview page's
 *      entire main region must contain NO numeral at all, and every screen's not-built statement
 *      must contain none either.
 *   2. **A sub-page shipped without the disclaimer.** A reader can land on any of these directly,
 *      never having seen the home page say the figures are invented and that nothing enforces the
 *      coordinator framing. Each of the four screens is checked for both.
 *   3. **An id that resolves to nothing rendering as an empty unit.** "This ward has nothing to
 *      show" and "there is no such ward" would render identically as a bare shell, and the first is
 *      a false statement about a real ward. Both detail screens are checked in that state.
 *   4. **A heading typed in rather than read from the section list.** The eyebrow is asserted
 *      against `STATISTICS_SECTIONS`, so a screen that hard-coded its own copy of a section name
 *      would fail the moment the list was edited — which is the entire point of the list existing.
 */

/** Collapses the whitespace JSX introduces at line breaks, so a sentence can be pinned whole. */
function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function renderInProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

/** The page's own main region — never the navigation rail, which is chrome shared with every
 *  other Ward Flow screen and is not this page's claim about anything. */
function mainOf(testId: string): HTMLElement {
  return within(screen.getByTestId(testId)).getByRole("main");
}

/**
 * A unit built here rather than found in the fixture. `tests/ward-statistics.test.ts` records why:
 * an assertion that searches a collection for an example passes as soon as ANY example exists,
 * including one a live defect still permits.
 */
function aUnit(overrides: Partial<Unit> = {}): Unit {
  const capacity = { value: 0, source: "ward" as const, confirmedAt: NOW_ANCHOR, staleAfterMinutes: 60 };
  return {
    id: "test-ward",
    siteCode: "RPH",
    name: "Test Ward",
    cohort: "Adult",
    security: "Open",
    authorised: false,
    beds: 0,
    empty: capacity,
    allocatable: capacity,
    held: 0,
    blocked: 0,
    sexMix: { Female: 0, Male: 0 },
    speciallingCapacity: 0,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

describe("every statistics section page carries the disclaimer", () => {
  const pages: { name: string; testId: string; node: ReactNode }[] = [
    { name: "overview", testId: "ward-statistics-overview-screen", node: <StatisticsOverviewScreen /> },
    { name: "comparisons", testId: "ward-statistics-compare-screen", node: <StatisticsCompareScreen /> },
    {
      name: "one ward",
      testId: "ward-statistics-ward-screen",
      node: <StatisticsWardScreen unitId={allUnits()[0].id} />,
    },
    {
      name: "one emergency department",
      testId: "ward-statistics-ed-screen",
      node: <StatisticsEdScreen edId={allEmergencyDepartments()[0].id} />,
    },
  ];

  it.each(pages)("$name says the figures are invented and that no role gate exists", ({ testId, node }) => {
    renderInProvider(node);

    const governance = screen.getByTestId("ward-statistics-section-governance");
    expect(governance.textContent).toContain("Synthetic prototype");

    const access = screen.getByTestId("ward-statistics-section-access");

    /*
     * ⚠️ **WHOLE SENTENCES, NOT SUBSTRINGS, AND FIX ROUND 1 IS WHY.** These assertions read
     * `toContain("not real figures")` and `toContain("There is no role check on this route.")`,
     * which pin the alarming half of each sentence and leave the qualifying half unguarded — the
     * half that says WHICH things are invented, and that anyone can reach the page. The fold of
     * these two sentences with `statistics-screen.tsx` landed on 2026-09-01; a fold that dropped a
     * clause would have stayed green under the old assertions, which is precisely the failure the
     * duplication note in the frame warned about. Equality on the normalised text is what makes a
     * softened disclaimer fail.
     *
     * ⚠️ **THE ACCESS CLAUSE READS "and read everything on it" AND THAT IS THE FOLDED WORDING, not
     * a leftover from the home page.** Neither original was true of both kinds of page: the home
     * page said "and read every figure on it", which is vacuous here where there is no figure, and
     * this frame stopped at "can reach this page", which dropped the point of the clause on a page
     * full of figures. `statistics-disclaimers.tsx` carries the reasoning. The identical string is
     * pinned in `tests/ward-statistics.dom.test.tsx`, so a page-specific edit fails on one side and
     * a shared edit fails on both.
     */
    expect(normalise(governance.querySelector("p")?.textContent)).toBe(
      "These are not real figures. Every patient, bed, referral and instant this prototype holds is invented, and " +
        "nothing here has been measured against a real service.",
    );
    expect(normalise(access.textContent)).toBe(
      "This is meant to be the coordinator's view — and nothing in this prototype enforces that. There is no " +
        "role check on this route. Anyone who can reach the Ward Flow mockups can reach this page and read " +
        "everything on it. Treat the coordinator framing as a statement of intent, not as access control.",
    );

    // Both sit inside the page's own main region, so a page that rendered them into the rail — or
    // outside the scroll container — would not satisfy this.
    expect(mainOf(testId).contains(governance)).toBe(true);
    expect(mainOf(testId).contains(access)).toBe(true);
  });

  it.each(pages)("$name offers a way back to the statistics hub", ({ node }) => {
    renderInProvider(node);
    expect(screen.getByTestId("ward-statistics-section-back").getAttribute("href")).toBe(
      "/mockups/ward-flow/statistics",
    );
  });

  /**
   * ⚠️ **THE NO-INVENTED-FIGURES ASSERTION, and it is the reason this suite exists.** Every one of
   * these screens states plainly that its section is unbuilt; the risk is that somebody later adds
   * a nought, a dash or a sample number to the same paragraph to "show the shape". A numeral inside
   * the statement that there is no figure is a contradiction the prose alone cannot prevent.
   */
  // One screen per case. This rendered all four into one document until fix round 1, which put four
  // `id="main-content"` landmarks in one page — a state no route can produce, so the test was
  // asserting against a document unlike anything a reader sees.
  it.each(
    pages.map((page, index) => ({
      ...page,
      statementTestId: [
        "ward-statistics-overview-not-built-body",
        "ward-statistics-compare-not-built-body",
        "ward-statistics-ward-not-built-body",
        "ward-statistics-ed-not-built-body",
      ][index],
    })),
  )("$name states the absence without a numeral in it", ({ node, statementTestId }) => {
    renderInProvider(node);

    const statement = screen.getByTestId(statementTestId);
    // Not vacuous: the paragraph has to be a real statement, not an empty element that trivially
    // contains no digit.
    expect(statement.textContent?.length ?? 0).toBeGreaterThan(120);
    expect(statement.textContent).not.toMatch(/[0-9]/);
  });
});

describe("across all services — the overview section", () => {
  it("shows no numeral anywhere on the page", () => {
    renderInProvider(<StatisticsOverviewScreen />);

    const main = mainOf("ward-statistics-overview-screen");
    // The guard against a vacuous pass: a page that rendered nothing would also contain no numeral.
    expect(main.textContent?.length ?? 0).toBeGreaterThan(600);
    expect(main.textContent).toContain("Nothing here is built yet");
    expect(main.textContent).not.toMatch(/[0-9]/);
  });

  it("takes its section name and description from the shared section list", () => {
    renderInProvider(<StatisticsOverviewScreen />);

    const section = statisticsSectionById("overview");
    expect(section).toBeDefined();
    expect(screen.getByTestId("ward-statistics-section-eyebrow").textContent).toBe(section?.label);
    expect(mainOf("ward-statistics-overview-screen").textContent).toContain(section?.description);
  });

  /**
   * ⚠️ **A DELETED SENTENCE, PINNED AS AN ABSENCE — AND THIS IS THE SHAPE OF DEFECT THE WHOLE
   * STATISTICS SURFACE KEEPS PRODUCING.** The not-built paragraph told the reader "There is no way
   * in from the statistics home page yet — the index that will link here is separate work." It was
   * TRUE the day it was written and FALSE within the same session, when the hub index landed. A
   * reader who arrived here by clicking that very link was being told the navigation they had just
   * used did not exist.
   *
   * There is no corrected wording, so the repair was a deletion: the absence the sentence described
   * no longer obtains, and a conclusion falls with its reason. This asserts the deletion held.
   *
   * ⚠️ **AND IT IS NOT A VACUOUS ABSENCE.** The companion test below asserts the hub really does
   * link this page. Without it, someone could remove the hub link tomorrow and this file would go
   * on happily forbidding the only sentence that would have told a reader so.
   */
  it("no longer tells the reader the hub cannot reach this page", () => {
    renderInProvider(<StatisticsOverviewScreen />);

    const notBuilt = normalise(screen.getByTestId("ward-statistics-overview-not-built-body").textContent);
    // Not vacuous: an emptied paragraph would satisfy every negative below for the wrong reason.
    expect(notBuilt.length).toBeGreaterThan(120);

    for (const phrase of [
      "There is no way in from the statistics home page",
      "no way in from the statistics home page yet",
      "the index that will link here is separate work",
    ]) {
      expect(notBuilt, `the deleted reachability sentence has returned: "${phrase}"`).not.toContain(phrase);
    }

    // The rest of the paragraph is unchanged and still the point of it.
    expect(notBuilt).toContain("No whole-of-prototype figure has been derived");
    expect(notBuilt).toContain("nobody re-checks a number that renders");
  });

  it("is linked from the hub index, which is what made that sentence false", () => {
    renderInProvider(<StatisticsScreen />);

    const index = screen.getByTestId("ward-statistics-index");
    const hrefs = Array.from(index.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href"));

    // Rendered, not read off the constant the screen also reads: the assertion is that a reader on
    // the hub can click through to this page, and only an anchor in the document establishes that.
    expect(hrefs).toContain(STATISTICS_OVERVIEW_HREF);
    expect(STATISTICS_SECTIONS[0]?.href).toBe(STATISTICS_OVERVIEW_HREF);
  });
});

/**
 * ⚠️ **THE CLAIMS THESE PAGES MAKE ABOUT THE DATA MODEL, PINNED — because this is the failure this
 * screen keeps producing.** Three times in one day a passage here has stated a correct conclusion
 * from a wrong reason, with every test green: a page cannot be checked by a reader, so a confident
 * sentence about the model carries the authority of the model itself.
 *
 * The clause `ReferralAddressing` "carries no unit at all" rendered on three pages until
 * 2026-09-01 and was false — `acceptedUnitId` is on that record (`ward-model.ts`, read directly).
 * The conclusion it supported was right, which is exactly why nothing caught it. These assertions
 * pin the corrected shape: the false clause must not come back, and the field that makes the
 * asymmetry true must be named where the asymmetry is claimed.
 */
describe("what the pages say about the model is true of the model", () => {
  const claims: { name: string; node: ReactNode; testId: string }[] = [
    {
      name: "the comparisons page's declines example",
      node: <StatisticsCompareScreen />,
      testId: "ward-statistics-compare-declines-example",
    },
    {
      name: "the overview page's precedent note",
      node: <StatisticsOverviewScreen />,
      testId: "ward-statistics-overview-precedent",
    },
    {
      // The home screen belongs to Task 2 and is imported read-only. This guard is deliberately
      // narrow — a negative on one retracted clause plus the field that replaced it — so a
      // legitimate Task 2 edit to that page cannot trip it, while a return of the false sentence
      // fails here rather than nowhere.
      name: "the statistics home page's withheld-declines passage",
      node: <StatisticsScreen />,
      testId: "ward-statistics-declines-withheld",
    },
  ];

  it.each(claims)("$name never says the record carries no unit", ({ node, testId }) => {
    renderInProvider(node);
    const text = normalise(screen.getByTestId(testId).textContent);

    expect(text.length).toBeGreaterThan(120);
    expect(text).not.toMatch(/carries no unit/i);
    expect(text).not.toMatch(/no unit at all/i);
  });

  it.each(claims)("$name names the field that makes the asymmetry true", ({ node, testId }) => {
    renderInProvider(node);
    const text = normalise(screen.getByTestId(testId).textContent);

    expect(text).toContain("acceptedUnitId");
    // The conclusion the corrected reason supports, still stated: acceptance names a ward, a
    // decline does not. A page that fixed the premise and dropped the point would pass the
    // negative above and say nothing useful.
    expect(text).toMatch(/when a ward accepts/i);
  });
});

describe("ward and ED comparisons — the chooser", () => {
  it("links to every ward and every emergency department in the network", () => {
    renderInProvider(<StatisticsCompareScreen />);

    // Compared as whole lists rather than one membership check per unit: an equality on the full
    // sequence fails on a ward that is missing, a ward that appears twice, and a link pointing at
    // the wrong unit, where a per-unit `toContain` would pass through the first two.
    const wardList = screen.getByTestId("ward-statistics-compare-ward-list");
    const wardHrefs = Array.from(wardList.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(wardHrefs).toEqual(allUnits().map((unit) => wardStatisticsHref(unit.id)));
    for (const unit of allUnits()) {
      expect(wardList.textContent).toContain(unit.name);
    }

    const edList = screen.getByTestId("ward-statistics-compare-ed-list");
    const edHrefs = Array.from(edList.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(edHrefs).toEqual(allEmergencyDepartments().map((department) => edStatisticsHref(department.id)));
    for (const department of allEmergencyDepartments()) {
      expect(edList.textContent).toContain(department.name);
    }
  });

  /**
   * Finding 7. `Movement.referredUnitIds` is a LIST — one referral can be live at several wards at
   * once — so a per-ward "referrals received" column sums to more than the number of referrals that
   * exist. This is a second failure mode beside the declines one and it fails differently: the
   * declines column silently narrows its population, this one silently inflates it, and the
   * inflation reconciles to nothing and gets blamed on the arithmetic. Both are named on the page
   * because both decide whether a column may be built at all.
   */
  it("names the two ways a per-ward column goes wrong, and the rule that catches both", () => {
    renderInProvider(<StatisticsCompareScreen />);

    const rule = normalise(screen.getByTestId("ward-statistics-compare-attributability-rule").textContent);
    expect(rule).toContain("required unit id");
    expect(rule).toContain("Admission");

    const doubleCount = normalise(screen.getByTestId("ward-statistics-compare-double-count-example").textContent);
    expect(doubleCount).toContain("Movement.referredUnitIds");
    expect(doubleCount).toMatch(/list, not a single id/);
    expect(doubleCount).toMatch(/sum to more than/);
  });

  it("carries the anchor the per-unit section links to, and denies that the list is an ordering", () => {
    renderInProvider(<StatisticsCompareScreen />);

    const perUnit = STATISTICS_SECTIONS.find((section) => section.id === "units");
    expect(perUnit?.href).toContain(`#${STATISTICS_UNIT_CHOOSER_ID}`);
    expect(document.getElementById(STATISTICS_UNIT_CHOOSER_ID)).not.toBeNull();

    expect(screen.getByTestId("ward-statistics-compare-order-note").textContent).toContain("carries no meaning");
  });

  /**
   * The conservative failure `ward-index.tsx` holds to, checked here because this chooser is the
   * ONLY link to a ward's statistics page: a unit silently dropped from it is unreachable AND
   * unreported, which is strictly worse than a ward whose hospital cannot be named.
   */
  it("still lists a ward whose site code resolves to nothing, and says so", () => {
    renderInProvider(
      <StatisticsCompareScreen
        units={[aUnit({ id: "unplaceable-ward", name: "Unplaceable Ward", siteCode: "NO-SUCH-SITE" })]}
        emergencyDepartments={[]}
      />,
    );

    const link = screen.getByRole("link", { name: /Unplaceable Ward/ });
    expect(link.getAttribute("href")).toBe(wardStatisticsHref("unplaceable-ward"));
    expect(link.textContent).toContain("matches no site in this prototype");
  });

  it("says so rather than rendering an empty list when there is nothing to choose", () => {
    renderInProvider(<StatisticsCompareScreen units={[]} emergencyDepartments={[]} />);

    expect(screen.getByTestId("ward-statistics-compare-no-wards").textContent).toContain("No ward is recorded");
    expect(screen.getByTestId("ward-statistics-compare-no-eds").textContent).toContain(
      "No emergency department is recorded",
    );
    expect(screen.queryByTestId("ward-statistics-compare-ward-list")).toBeNull();
  });
});

/**
 * ⚠️ **THE FRAGMENT, ON EVERY LINK THAT CLAIMS TO OFFER THE CHOOSER.** Fix round 1: all four
 * in-page links back to the chooser used the bare comparisons href, so a reader who clicked
 * "choose a ward" landed at the top of a page opening with two sections about why no comparison
 * exists and had to scroll to find the list — and the assertion in this file pinned the bare href
 * as intended behaviour, which is worse than the miss. Asserted on every link, in both states of
 * both detail screens, because a fix applied to three of the four would look identical in review.
 */
describe("every link that offers the chooser lands on the chooser", () => {
  const links: { name: string; node: ReactNode; testId: string }[] = [
    {
      name: "the ward page for a ward that exists",
      node: <StatisticsWardScreen unitId={allUnits()[0].id} />,
      testId: "ward-statistics-ward-chooser-link",
    },
    {
      name: "the ward page for an id that resolves to nothing",
      node: <StatisticsWardScreen unitId="no-such-ward" />,
      testId: "ward-statistics-ward-chooser-link",
    },
    {
      name: "the department page for a department that exists",
      node: <StatisticsEdScreen edId={allEmergencyDepartments()[0].id} />,
      testId: "ward-statistics-ed-chooser-link",
    },
    {
      name: "the department page for an id that resolves to nothing",
      node: <StatisticsEdScreen edId="no-such-ed" />,
      testId: "ward-statistics-ed-chooser-link",
    },
  ];

  it.each(links)("$name links to the anchor, not the top of the comparisons page", ({ node, testId }) => {
    renderInProvider(node);

    const href = screen.getByTestId(testId).getAttribute("href");
    expect(href).toBe(STATISTICS_UNIT_CHOOSER_HREF);
    // Spelled out as well as compared to the constant: a constant that lost its fragment would
    // satisfy the equality above on both sides and change nothing that fails.
    expect(href).toBe(`/mockups/ward-flow/statistics/compare#${STATISTICS_UNIT_CHOOSER_ID}`);
  });

  it("puts the anchor those links point at on the comparisons page, and says why it is there", () => {
    renderInProvider(<StatisticsCompareScreen />);

    expect(document.getElementById(STATISTICS_UNIT_CHOOSER_ID)).not.toBeNull();
    expect(normalise(screen.getByTestId("ward-statistics-compare-chooser-rationale").textContent)).toContain(
      "per-unit detail has no page of its own",
    );
  });
});

describe("one ward in detail", () => {
  it("names the ward and its hospital, and measures nothing about it", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="test-ward"
        units={[aUnit({ id: "test-ward", name: "Test Ward", siteCode: "RPH" })]}
      />,
    );

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toBe(
      "Test Ward is recorded at Royal Perth Hospital.",
    );
    expect(screen.getByTestId("ward-statistics-ward-not-built")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-ward-unresolved")).toBeNull();
  });

  /**
   * ⚠️ **THIS TEST'S NAME USED TO CLAIM MORE THAN ITS BODY COULD PROVE.** It was titled "resolves
   * the ward from live provider state, not from a fixture handed in", but `seeded` and the
   * provider's own units both come from `allUnits()` and nothing here ever dispatched — live
   * state and seed state are identical by construction, so a component that ignored the provider
   * and read `allUnits()` directly would have passed this test too.
   *
   * A real live-vs-seed test needs a way to make the two differ. Checked both routes: no event in
   * `ward-flow-events.ts` ever assigns `Unit.name` or `Unit.siteCode` (grepped the reducer for
   * both — neither appears as an assignment target anywhere), and `scenarioUnits()` in
   * `ward-scenarios.ts` says outright that a scenario switch changes "OPERATIONAL NUMBERS ONLY" —
   * `allocatable`/`speciallingCapacity` — never a unit's name or site. `WardFlowProvider` itself
   * takes only `initialNow`; it has no seed-override prop that could hand the provider a unit list
   * disagreeing with `allUnits()`. This screen renders exactly two things about a resolved unit —
   * its name and its site placement — and neither one is reachable by any dispatchable event. The
   * property the old title claimed is not observable through this component's current props and
   * this reducer's current events, so the name changed rather than staying wrong.
   */
  it("renders the resolved ward's name and site placement, rather than falling into the not-found state", () => {
    const seeded = allUnits()[0];
    renderInProvider(<StatisticsWardScreen unitId={seeded.id} />);

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toContain(seeded.name);
    expect(screen.queryByTestId("ward-statistics-ward-unresolved")).toBeNull();
  });

  /**
   * ⚠️ The honest not-found state. An empty shell would render as a ward with nothing to show, and
   * a reader would take that as a fact about a real ward.
   */
  it("says no such ward exists, names the id, and never falls back to another ward", () => {
    renderInProvider(<StatisticsWardScreen unitId="no-such-ward" />);

    const unresolved = screen.getByTestId("ward-statistics-ward-unresolved");
    expect(unresolved.textContent).toContain("no-such-ward");
    expect(unresolved.textContent).toContain("never falls back to a different ward");

    // Not an empty shell, and not a page about some other ward.
    expect(screen.queryByTestId("ward-statistics-ward-identity")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ward-not-built")).toBeNull();
    for (const unit of allUnits()) {
      expect(mainOf("ward-statistics-ward-screen").textContent).not.toContain(unit.name);
    }

    // Still a page of this prototype: the disclaimer is on the error state too.
    expect(screen.getByTestId("ward-statistics-section-governance").textContent).toContain("not real figures");
    expect(screen.getByTestId("ward-statistics-ward-chooser-link").getAttribute("href")).toBe(
      STATISTICS_UNIT_CHOOSER_HREF,
    );
  });

  it("says it cannot place a ward whose site code resolves to nothing, rather than guessing one", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="unplaceable-ward"
        units={[aUnit({ id: "unplaceable-ward", name: "Unplaceable Ward", siteCode: "NO-SUCH-SITE" })]}
      />,
    );

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toContain(
      "carries a site code this prototype has no site for",
    );
  });

  /**
   * ⚠️ **THE ENUMERATION THIS PAGE USED TO CARRY, AND WHY IT MAY NOT COME BACK.** The blocked-figure
   * paragraph listed `Admission`'s instants as five — the pull, the arrival, the expected discharge
   * date, when that date was set, and the departure — copied from `ward-statistics.ts`'s own doc
   * comment. The record carries seven, plus a nested `followUp.recordedAt`;
   * `awayAtEmergencyDepartmentSince` and `dischargeConfirmedAt` were missing from both.
   *
   * The conclusion survived — neither omitted instant marks entry to `waitlisted` — which is
   * precisely why nothing caught it. A wrong enumeration reads as the most checkable sentence on
   * the page to a reader who cannot check it. So the page states the property of the whole set and
   * never the list, and this test forbids the list from returning: an enumeration copied out of a
   * file this page cannot edit drifts silently by construction.
   */
  it("states the waitlist gap without enumerating the admission record's instants", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="test-ward"
        units={[aUnit({ id: "test-ward", name: "Test Ward", siteCode: "RPH" })]}
      />,
    );

    const blocked = normalise(screen.getByTestId("ward-statistics-ward-blocked-figure").textContent);

    // The conclusion, unchanged and still the point of the paragraph.
    expect(blocked).toContain("no instant on Admission marks the moment they entered waitlisted");
    expect(blocked).toContain("deliberately not listed here");

    /*
     * ⚠️ **THE CHARACTERISATION BESIDE IT WAS FALSE UNTIL 2026-09-01, AND IS NOW PINNED BOTH WAYS.**
     * The paragraph said the record's instants were "every one of them about the bed or about the
     * discharge plan". `ward-admissions.ts` says the opposite of one of them, in bold, on the field:
     * `awayAtEmergencyDepartmentSince` "is a fact about the PERSON, which is why it is a field and
     * not a state". That distinction is load-bearing rather than decorative — the bed stays occupied
     * while somebody is away at an emergency department, and every availability figure depends on it
     * — so flattening it is not a rounding error.
     *
     * The replacement states a FLOOR ("at least one"), never a count and never an absolute, so a
     * further person-fact instant arriving cannot falsify it and no enumeration returns.
     */
    expect(blocked).toContain("not all of one kind");
    expect(blocked).toContain("at least one is a fact about the person rather than about the bed");
    expect(blocked).not.toContain("every one of them is about the bed");
    expect(blocked).not.toContain("about the bed or about the discharge plan; none is the moment");

    // And the retired list, forbidden by name. Any of these three phrases returning means somebody
    // has re-copied the five-item enumeration.
    expect(blocked).not.toContain("The record keeps the pull, the arrival");
    expect(blocked).not.toContain("when that date was set, and the departure");
    expect(blocked).not.toContain("none of them is that moment");
  });
});

describe("one emergency department in detail", () => {
  it("names the department and its hospital, and measures nothing about it", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    expect(screen.getByTestId("ward-statistics-ed-site").textContent).toContain(department.name);
    expect(screen.getByTestId("ward-statistics-ed-not-built")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-ed-unresolved")).toBeNull();
  });

  it("says no such department exists, names the id, and never falls back to another one", () => {
    renderInProvider(<StatisticsEdScreen edId="no-such-ed" />);

    const unresolved = screen.getByTestId("ward-statistics-ed-unresolved");
    expect(unresolved.textContent).toContain("no-such-ed");
    expect(unresolved.textContent).toContain("never falls back to a different department");

    expect(screen.queryByTestId("ward-statistics-ed-identity")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-not-built")).toBeNull();
    for (const department of allEmergencyDepartments()) {
      expect(mainOf("ward-statistics-ed-screen").textContent).not.toContain(department.name);
    }

    expect(screen.getByTestId("ward-statistics-section-governance").textContent).toContain("not real figures");
  });

  /**
   * ⚠️ **"THE TWO CLOCKS THE REFERRAL RECORD ALREADY KEEPS" NAMED NEITHER AND COULD DEFEND
   * NEITHER.** `Referral.raisedAt` is required; `triagedAt` is OPTIONAL, so a referral may carry
   * none at all, and nothing in the model orders the two — a triage instant may sit EARLIER than
   * the `raisedAt` beside it, because somebody can be in a department for hours before psychiatry
   * is called. Two instants that can be absent and can run backwards are not a pair a duration may
   * be quietly assumed from.
   *
   * The paragraph's conclusion is unchanged and now stands on the movement side, where
   * `Movement.originEdId` is a required `string`. This test pins both halves: the unnamed claim may
   * not return, and the conclusion must still be attributed to the record that can carry it.
   *
   * ⚠️ **THE FIRST CORRECTION REPLACED AN UNEARNED CLAIM WITH A FIXTURE ONE.** It said "most seeded
   * referrals carry none" and cited the single fixture referral whose triage runs backwards. Both
   * were true on 2026-09-01, both were properties of the SEED rather than of the page, and a seed
   * edit would have falsified them with nothing going red. The last block below is what stops that
   * returning: the paragraph may state what the TYPE establishes and may not state what the data
   * happens to hold, so it carries no quantity at all — and a quantity in prose starts as a
   * numeral or as a word like "most".
   */
  it("names the referral's clocks and their limits rather than asserting an unqualified pair", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    const attributable = normalise(screen.getByTestId("ward-statistics-ed-attributable").textContent);

    expect(attributable).toContain("raisedAt");
    expect(attributable).toContain("triagedAt");
    expect(attributable).toContain("is optional");
    expect(attributable).toContain("the triage can precede the referral");
    // The conclusion, re-attributed to the record that never goes missing.
    expect(attributable).toContain("a required field, never missing");
    expect(attributable).toContain("derivable from the movement side");

    // The retired wording, forbidden by name.
    expect(attributable).not.toContain("the two clocks the referral record already keeps");
  });

  it("states the optionality as a property of the type, and counts nothing about the seed", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    const attributable = normalise(screen.getByTestId("ward-statistics-ed-attributable").textContent);

    // Non-vacuity first. Every assertion below is a NOT, and every one of them passes against an
    // empty string — so the paragraph has to be shown to be the paragraph before its absences mean
    // anything.
    expect(
      attributable.length,
      "the attributable paragraph rendered empty — nothing below this line proves anything",
    ).toBeGreaterThan(200);
    expect(attributable, "the paragraph no longer states the model property that replaced the seed claim").toContain(
      "optional, so a referral may carry no triage instant at all",
    );

    // No numeral anywhere in the paragraph. Written as an explicit digit class rather than \d so
    // that no escape sequence is involved: a literal backslash-b pasted into a pattern becomes a
    // backspace byte, matches nothing, and prints as valid — which has already cost this project a
    // day.
    const numeral = attributable.match(/[0123456789]/);
    expect(
      numeral,
      `the paragraph now contains the numeral "${numeral?.[0] ?? ""}" — a figure typed into prose is a claim about ` +
        `the data that nothing can re-check. Render it from live state or leave it out.`,
    ).toBeNull();

    // The words a fixture claim arrives as when it is not a numeral. "most" and "seeded" are the
    // exact words the retired sentence used. Deliberately narrow: "many" is not here, because the
    // paragraph legitimately asks "how many people this department is currently waiting on" — a
    // forbidden word that also occurs innocently teaches the next person to widen the exception
    // rather than fix the sentence.
    for (const quantifier of ["most ", "seeded", "fixture"]) {
      expect(
        attributable.toLowerCase(),
        `the paragraph says "${quantifier.trim()}" — that is a claim about what the seed happens to contain, and it ` +
          `will go false silently the next time the seed is edited.`,
      ).not.toContain(quantifier);
    }
  });
});
