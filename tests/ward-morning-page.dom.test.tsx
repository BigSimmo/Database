import { render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-discharge-board.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  FreshnessStamp,
  MorningBody,
  MorningPage,
  UnplacedUnitsNote,
} from "@/components/ward-management/morning/morning-page";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
  peopleWaitingCount,
  PEOPLE_WAITING_LABEL,
  serviceRollup,
  type CapacityRollup,
  type ServiceRollup,
} from "@/components/ward-management/ward-morning-rollup";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

import { literalsIn } from "./helpers/ast-string-literals";

/** Every figure key, in the one order `CAPACITY_FIGURE_LABELS` declares them — the same array
 *  `morning-page.tsx`'s own (unexported) `ALL_FIGURE_KEYS` builds, kept in sync by construction
 *  rather than by a second hand-typed list, since both read the one exported constant. */
const ALL_FIGURE_KEYS = Object.keys(CAPACITY_FIGURE_LABELS) as (keyof typeof CAPACITY_FIGURE_LABELS)[];

/** Raises the same `ADVANCE_CLOCK` demo event `ward-handover.dom.test.tsx`'s `ClockAdvancer`
 * raises, so this suite can move the shared clock without reaching into the reducer directly. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

/**
 * The brief's illustrative label test writes `render(<MorningPage />)` directly, but
 * `MorningPage` reads `useWardFlow()`, which throws outside `WardFlowProvider` — jsdom cannot
 * provide the App Router context `ClinicalRail` needs either, hence the `next/link` mock above.
 * This local helper wraps exactly the way `renderHandover()` (ward-handover.dom.test.tsx) and
 * `renderBoard()` (ward-discharge-board.dom.test.tsx) already do (controller ruling R3), and
 * every test below calls it in place of a bare `render(<MorningPage />)`.
 */
function renderMorningPage({ withClockAdvancer = false }: { withClockAdvancer?: boolean } = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MorningPage />
      {withClockAdvancer && <ClockAdvancer minutes={100} />}
    </WardFlowProvider>,
  );
}

describe("MorningPage", () => {
  it("renders the governance banner, the headline and the remaining four figures for the real fixture after 08:00", () => {
    renderMorningPage();

    expect(screen.getByTestId("ward-morning-page")).toBeInTheDocument();
    expect(screen.getByTestId("ward-morning-governance")).toHaveTextContent("not a medical device");

    // `ward-morning-figure-<level>-<key>` carries an explicit level prefix (service/site/unit) so
    // the same five keys at three different levels never collide on one `data-testid` — see
    // `FigureList`'s own doc comment in morning-page.tsx for why that used to be a guaranteed
    // Playwright strict-mode violation. Still scoped to one container per assertion below, which
    // is good practice regardless of the prefix.
    const headline = screen.getByTestId("ward-morning-headline");
    expect(within(headline).getByTestId("ward-morning-figure-service-availableNow")).toBeInTheDocument();

    const remaining = screen.getByTestId("ward-morning-remaining-figures");
    expect(within(remaining).getByTestId("ward-morning-figure-service-confirmedToday")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-service-expectedToday")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-service-held")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-service-leaveUsable")).toBeInTheDocument();
  });

  /**
   * The single most important rule in this project (stated in `GovernanceBanner`'s own copy):
   * nothing expected, confirmed-but-unreleased, or on leave may ever reach "beds available right
   * now". No existing test asserted the headline's actual NUMBER, only its presence — so a
   * mutation making the headline `availableNow + confirmedToday` (mutation-report Gap 3, the most
   * serious of the three) passed every assertion in this file. This test computes the expected
   * figure independently via `serviceRollup(...)` from the same real fixture data the page itself
   * renders, over `bedReleases`/`leaveBeds` fixtures (`ward-movements.ts`) that are seeded with
   * non-zero `confirmedToday`, `expectedToday` and `leaveUsable` at the frozen 08:00 handover
   * instant — asserted below rather than assumed, so this guard cannot pass merely because those
   * fields happened to be zero. Adding any of them into the headline changes the expected number
   * and fails this test.
   */
  it("renders the headline as availableNow alone, never mixing in confirmedToday, expectedToday or leaveUsable", () => {
    let captured: ReturnType<typeof useWardFlow> | undefined;

    // Reads the hook during render (required — hooks must be called unconditionally at the top
    // of the component) but defers the write to the outer `captured` variable into an effect,
    // which runs AFTER render rather than during it. Assigning an outside-scope variable while
    // rendering is exactly what react-hooks/globals flags (render must stay pure/side-effect
    // free); `render()` from Testing Library flushes effects before returning, so `captured` is
    // still populated by the time the assertions below read it — same as the previous
    // direct-assignment version, just moved to where a side effect is allowed to live.
    function Capture({ children }: { children: ReactNode }) {
      const flow = useWardFlow();
      useEffect(() => {
        captured = flow;
      });
      return <>{children}</>;
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture>
          <MorningPage />
        </Capture>
      </WardFlowProvider>,
    );

    // The fixed view is frozen at the 08:00 handover instant, not at `NOW_ANCHOR` itself — so the
    // independent expectation must be computed at that same instant, over the exact
    // units/bedReleases/leaveBeds the rendered page used (captured from the same provider tree).
    const { units, bedReleases, leaveBeds } = captured!;
    const expected = serviceRollup(wardSites, units, bedReleases, leaveBeds, MORNING_HANDOVER_MINUTES).service;

    // Guard the guard: this must genuinely exercise all three excluded fields, or the assertion
    // below could pass for the wrong reason (headline === availableNow trivially because the
    // excluded fields were already zero).
    expect(expected.confirmedToday).toBeGreaterThan(0);
    expect(expected.expectedToday).toBeGreaterThan(0);
    expect(expected.leaveUsable).toBeGreaterThan(0);

    const headline = screen.getByTestId("ward-morning-headline");
    expect(within(headline).getByTestId("ward-morning-figure-service-availableNow")).toHaveTextContent(
      String(expected.availableNow),
    );
  });

  /**
   * Task 9 (product owner, 2026-08-28). The demand figure: how many people are waiting for a bed,
   * beside the headline that says how many beds there are.
   *
   * Three separate claims, asserted rather than assumed:
   *   1. The number rendered is `peopleWaitingCount` of the very referrals the provider holds —
   *      the same count `referralQueueOrder` gives the referral board, so the two screens cannot
   *      disagree about how many people are waiting.
   *   2. It is BESIDE the headline, not inside it (spec D2): the people-waiting node is not a
   *      descendant of `ward-morning-headline`, and the headline's own number is untouched.
   *   3. The page prints no derived shortfall. Nothing rendered anywhere on the page states the
   *      difference between the two figures — a subtraction the page performed would be a claim
   *      about a gap, and this prototype does not make one.
   */
  it("renders the people-waiting figure beside the headline, from the same count the referral board uses", () => {
    let captured: ReturnType<typeof useWardFlow> | undefined;

    function Capture({ children }: { children: ReactNode }) {
      const flow = useWardFlow();
      useEffect(() => {
        captured = flow;
      });
      return <>{children}</>;
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture>
          <MorningPage />
        </Capture>
      </WardFlowProvider>,
    );

    const { units, bedReleases, leaveBeds, referrals } = captured!;
    const expectedWaiting = peopleWaitingCount(referrals);
    const expectedService = serviceRollup(wardSites, units, bedReleases, leaveBeds, MORNING_HANDOVER_MINUTES).service;

    // Guard the guard: someone really is waiting on the shipped fixture, and someone has really
    // already been decided — otherwise claim 1 could pass with the wrong filter, and claim 3
    // could pass because the two numbers happened to be equal.
    expect(expectedWaiting).toBeGreaterThan(0);
    expect(referrals.length).toBeGreaterThan(expectedWaiting);
    expect(expectedService.availableNow).not.toBe(expectedWaiting);

    const waiting = screen.getByTestId("ward-morning-people-waiting");
    expect(within(waiting).getByTestId("ward-morning-people-waiting-count")).toHaveTextContent(String(expectedWaiting));
    expect(waiting).toHaveTextContent(PEOPLE_WAITING_LABEL);

    // Claim 2: beside, never inside. `getByTestId` is document-scoped, so the negative has to be
    // asserted as a containment fact about the two nodes, not as an absence of a query result.
    const headline = screen.getByTestId("ward-morning-headline");
    expect(headline.contains(waiting)).toBe(false);
    expect(within(headline).getByTestId("ward-morning-figure-service-availableNow")).toHaveTextContent(
      String(expectedService.availableNow),
    );

    // Claim 3: the demand card prints ONE number and it is the waiting count. Asserted as the
    // complete list of digits in that section rather than as "the shortfall is absent": a
    // difference-is-absent check would pass or fail by coincidence whenever some unrelated bed
    // count happened to equal the difference, and would still miss a shortfall printed in any
    // other form. Exactly-one-number is the property that actually holds — the card's title and
    // its note carry no digits at all — so any second, derived figure appearing here fails.
    const waitingNumbers = (waiting.textContent ?? "").match(/\d+/g) ?? [];
    expect(
      waitingNumbers,
      "the people-waiting card must render the queued count and no other, derived, number",
    ).toEqual([String(expectedWaiting)]);
  });

  /**
   * The same single-source rule spec D14 holds the five capacity labels to, applied to task 9's
   * one demand label: `PEOPLE_WAITING_LABEL` is defined next to `peopleWaitingCount` in
   * `ward-morning-rollup.ts`, and a hardcoded copy in the page would render identically while
   * quietly costing the cheap rename. Same AST literal scan as the capacity-label guard above —
   * see that test's own comment for why a raw substring check was not enough.
   */
  it("never hardcodes the people-waiting label in the page source — it is read from PEOPLE_WAITING_LABEL", () => {
    const literals = literalsIn("src/components/ward-management/morning/morning-page.tsx");
    expect(literals.length, "no string literal was read from morning-page.tsx").toBeGreaterThan(0);
    expect(
      literals.filter((literal) => literal.includes(PEOPLE_WAITING_LABEL)),
      `"${PEOPLE_WAITING_LABEL}" appears as a literal in morning-page.tsx — it must be read from ` +
        `PEOPLE_WAITING_LABEL instead`,
    ).toEqual([]);
  });

  it("renders every figure label from the one definition, so a model change is three strings", () => {
    renderMorningPage();
    for (const label of Object.values(CAPACITY_FIGURE_LABELS)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  /**
   * The test above asserts rendered text equals `CAPACITY_FIGURE_LABELS`'s own values, which is
   * self-referential: a hardcoded literal identical to the constant (e.g. `"Expected today"`
   * typed directly into JSX instead of `{CAPACITY_FIGURE_LABELS.expectedToday}`) produces the
   * same DOM and passes it (mutation-report Gap 2). What spec D14 actually protects is that the
   * page has no such literal at all — every label site reads the constant, so a future rename of
   * one value is three strings, never a JSX hunt.
   *
   * Gap 3 (final review). This used to be `source.includes(JSON.stringify(label))` — a raw
   * substring check for the DOUBLE-QUOTED form only. `JSON.stringify("Expected today")` is
   * `"Expected today"` with double quotes, so the guard was blind to a single-quoted literal
   * (`'Expected today'`) and, more seriously, to a TEMPLATE literal (`` {`Expected today`} ``):
   * Prettier does not rewrite a template literal to quotes, so that form survives lint and format
   * as well as the old test. Replaced with an AST-based scan (`literalsIn`, lifted out of
   * `tests/ward-legal-figure-guard.test.ts` rather than re-implemented here — see that helper's
   * own doc comment), which reads every string literal, no-substitution template literal, and
   * template head/middle/tail the TypeScript parser sees, independent of quote style. Matching is
   * by substring (`literal.includes(label)`, not equality) so a label hardcoded with a dynamic
   * suffix concatenated on — `` `Expected today ${x}` ``, whose static head text already carries
   * the whole label before the parser ever reaches the interpolation — is caught too, not only an
   * exact one-literal-equals-one-label match.
   */
  it("never hardcodes a figure-label literal in the page source — every label is read from CAPACITY_FIGURE_LABELS", () => {
    const literals = literalsIn("src/components/ward-management/morning/morning-page.tsx");

    // Non-vacuity: the parse really produced literals for this file, or every assertion below
    // would pass by finding nothing to contradict it.
    expect(literals.length, "no string literal was read from morning-page.tsx").toBeGreaterThan(0);

    for (const label of Object.values(CAPACITY_FIGURE_LABELS)) {
      const offenders = literals.filter((literal) => literal.includes(label));
      expect(
        offenders,
        `"${label}" appears as a literal in morning-page.tsx (single-quoted, template-literal, or ` +
          `concatenated) — it must be read from CAPACITY_FIGURE_LABELS instead`,
      ).toEqual([]);
    }
  });

  it("reads 'Never confirmed' for a rollup with nothing confirmed, never a bare 0", () => {
    render(<FreshnessStamp freshness={{ kind: "never" }} />);
    expect(screen.getByText("Never confirmed")).toBeInTheDocument();
  });

  it("states a partial rollup in words: N of M wards confirmed, and how many never confirmed", () => {
    render(
      <FreshnessStamp freshness={{ kind: "partial", oldestConfirmedAt: 100, unitsConfirmed: 14, unitsTotal: 15 }} />,
    );
    expect(screen.getByText("14 of 15 wards confirmed · 1 never confirmed")).toBeInTheDocument();
  });

  it("states a fully-confirmed rollup without a spurious 'never confirmed' clause", () => {
    render(
      <FreshnessStamp freshness={{ kind: "confirmed", oldestConfirmedAt: 100, unitsConfirmed: 2, unitsTotal: 2 }} />,
    );
    expect(screen.getByText("2 of 2 wards confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/never confirmed/)).not.toBeInTheDocument();
  });

  /**
   * Failure branch: a site with no units. JHC (Joondalup Health Campus) and PEEL are real
   * fixture sites with `units: []` (ward-sites.ts) — no fabricated fixture needed. The site must
   * still render, never be silently omitted, with an explicit "No units recorded" note.
   */
  it("renders a site with no units as 'No units recorded', never omitting the site itself", () => {
    renderMorningPage();

    const jhc = screen.getByTestId("ward-morning-site-JHC");
    expect(within(jhc).getByText("Joondalup Health Campus")).toBeInTheDocument();
    expect(within(jhc).getByTestId("ward-morning-site-JHC-empty")).toHaveTextContent("No units recorded");
  });

  /**
   * I4 fix pass (spec D4, "Zero is a claim"). JHC and PEEL are real fixture sites with no units
   * — before this fix, `SiteBlock` still rendered their five-figure grid, and every field of
   * `sumBreakdowns([])` is zero, so a reader scanning the page saw "Available now 0 · Confirmed
   * today 0 · Expected today 0 · Held 0 · Leave (usable) 0" under a real hospital's name, as if
   * this page had checked and found nothing. The true fact is that it has nothing to report at
   * all — carried by "Never confirmed" and "No units recorded" alone. This proves the FIGURE GRID
   * itself is gone (not merely covered by a different assertion), for BOTH real no-unit sites,
   * and proves the guard is scoped correctly: RPH — a real fixture site WITH units — still gets
   * its grid, so this is not a blanket "never render site figures" regression.
   */
  it("suppresses the site-level figure grid for a no-unit site, but not for a site with units", () => {
    renderMorningPage();

    for (const code of ["JHC", "PEEL"]) {
      const site = screen.getByTestId(`ward-morning-site-${code}`);
      expect(
        within(site).queryByTestId(`ward-morning-figure-site-${code}-availableNow`),
        `${code} has no units — its figure grid must not render`,
      ).not.toBeInTheDocument();
      // Guard the guard: still says the two real facts, doesn't just silently render less.
      expect(within(site).getByText("Never confirmed")).toBeInTheDocument();
      expect(within(site).getByTestId(`ward-morning-site-${code}-empty`)).toHaveTextContent("No units recorded");
    }

    const rph = screen.getByTestId("ward-morning-site-RPH");
    expect(within(rph).getByTestId("ward-morning-figure-site-RPH-availableNow")).toBeInTheDocument();
  });

  /**
   * I2 fix pass (spec D4, D6). `oldestConfirmedAt` was computed by `ward-morning-rollup.ts` and
   * mutation-tested there, but rendered nowhere on this page — `FreshnessStamp` alone only ever
   * states a COUNT ("22 of 22 wards confirmed"), never the actual oldest-confirming instant. This
   * computes the expected instant independently, the same way the headline-number test above
   * does (via `serviceRollup` at the frozen handover instant, over the real fixture captured from
   * the same provider tree), and asserts the page renders it through the shared `WardFreshness`
   * vocabulary — "Confirmed HH:MM" — next to the existing count, not a second bespoke wording.
   */
  it("renders the service-level freshness's oldest-confirmed instant next to the existing count, via the shared WardFreshness wording", () => {
    let captured: ReturnType<typeof useWardFlow> | undefined;

    function Capture({ children }: { children: ReactNode }) {
      const flow = useWardFlow();
      useEffect(() => {
        captured = flow;
      });
      return <>{children}</>;
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture>
          <MorningPage />
        </Capture>
      </WardFlowProvider>,
    );

    const { units, bedReleases, leaveBeds } = captured!;
    const expected = serviceRollup(wardSites, units, bedReleases, leaveBeds, MORNING_HANDOVER_MINUTES).service;

    // Guard the guard: the real fixture must actually have a confirmed instant to show, or the
    // assertion below could pass by finding nothing to contradict it.
    expect(expected.freshness.kind, "fixture assumption: service-level freshness is confirmed or partial").not.toBe(
      "never",
    );
    const oldestConfirmedAt = expected.freshness.kind === "never" ? null : expected.freshness.oldestConfirmedAt;

    const headline = screen.getByTestId("ward-morning-headline");
    expect(within(headline).getByText(`Confirmed ${formatInstant(oldestConfirmedAt!)}`)).toBeInTheDocument();
  });

  /**
   * C2 fix pass. The print-only view/instant label (`PrintViewMeta`) is screen-hidden by CSS
   * (`.printViewMeta { display: none }`, restored under `@media print`), so its actual on-paper
   * VISIBILITY is a rendered-CSS fact this jsdom suite cannot see (jsdom does not evaluate
   * `@media print`) — that half is proven in `tests/ui-ward-morning.spec.ts` via a real
   * `page.pdf()`/`emulateMedia` measurement, not here. What this DOM test can and does prove is
   * the CONTENT logic: the label names the right view and the right instant, and switches when
   * the view toggles — the source of truth a rendered-CSS check alone could not verify either.
   */
  it("carries WB-DB-10's dated change notice, saying by what RULE the figures moved", () => {
    /*
     * A stamp says WHEN a sheet was taken. It never says BY WHAT RULE, so a definitional change
     * reads as ordinary variation between two correctly-stamped sheets and nobody can tell the
     * number moved for a reason rather than because the ward did.
     *
     * WB-DB-7 raised these figures on 2026-08-30 by making the horizon a rolling day. This notice
     * is the only artefact on the page that explains that, and without an assertion it is one tidy
     * edit from disappearing - the sheet would still print, still be stamped, and still be wrong to
     * compare against an older one.
     *
     * Asserted on SUBSTANCE rather than on the sentence, so a rewording survives and a deletion
     * does not: the date, what changed, and the instruction for retiring it.
     */
    renderMorningPage();

    const notice = screen.getByTestId("ward-morning-definition-change");
    expect(notice, "the notice must be dated, or a reader cannot tell which sheets it applies to").toHaveTextContent(
      "30 August 2026",
    );
    expect(notice, "it must say what the new rule IS, not merely that something changed").toHaveTextContent(
      "rolling twenty-four hours",
    );
    expect(
      notice,
      "it must say the difference is the rule rather than the ward - that is the whole point of it",
    ).toHaveTextContent("the rule rather than the ward");
    expect(
      notice,
      "it must carry its own retirement condition, or it stays on the page for ever by default",
    ).toHaveTextContent("Remove this notice");
  });

  it("stamps the printed sheet with the moment it was printed, which is the only claim a sheet can keep", () => {
    /*
     * REWRITTEN 2026-08-30 (WB-DB-11). This asserted which of two views produced the sheet, and that
     * the label changed when the toggle was pressed. There is one view now and no toggle.
     *
     * The owner's instruction was "there is no point of a stale handover - remove it and make the
     * print out live from whatever time". The frozen sheet was the worse artefact: it claimed a
     * reconstruction of the 08:00 handover that this prototype cannot make, having no event history,
     * and the snapshot was actually taken whenever the page happened to be opened.
     *
     * But a printed sheet is stale the moment it leaves the printer whatever it says, so removing
     * the label without replacing it would have swapped a wrong time for no time - and a sheet with
     * no time on it is the one nobody can tell is old. This pins the replacement: the real moment of
     * printing, and a sentence saying the sheet does not update.
     */
    renderMorningPage();

    expect(
      screen.getByTestId("ward-morning-print-view-label"),
      "the printed sheet must state the moment it was printed, or nobody holding it can tell how old it is",
    ).toHaveTextContent(`This sheet: printed ${formatInstant(NOW_ANCHOR)}.`);

    expect(
      screen.getByTestId("ward-morning-print-view-note"),
      "and it must say the sheet does not update, because a reader cannot tell a printout from a screen",
    ).toHaveTextContent("nothing on this sheet updates once it is printed");
  });

  /**
   * The spec requires the beyond-tonight exclusion count to be stated even when it is zero —
   * silent truncation reads as "we counted everything" when it did not, so `ExcludedBeyondTonight`
   * must render unconditionally at its real call site in `MorningBody`. Both branches are
   * asserted here (mirroring `UnplacedUnitsNote`'s own dual-branch test below), but the zero
   * branch asserts PRESENCE, the opposite of that test's empty branch.
   *
   * Deliberately drives this through `MorningBody` — the real call site (spec D-required, and
   * `morning-page.tsx`'s own comment on that component explains this is exactly the seam a test
   * needing a hand-authored value uses) — rather than rendering `ExcludedBeyondTonight` directly.
   * A direct render only proves the component's own text formatting; it cannot see a
   * `{count > 0 && <ExcludedBeyondTonight ... />}` mutation at the call site, because that
   * conditional lives in `MorningBody`, not in `ExcludedBeyondTonight` itself. Proved by running
   * exactly that mutation: rendering `<ExcludedBeyondTonight count={0} />` directly still passed,
   * while this version goes red (see the fix-round report for the quoted failure).
   */
  it("states the number of beds excluded beyond tonight from the real MorningBody call site, and keeps stating it even when the count is zero", () => {
    function syntheticServiceRollup(excludedBeyondToday: number): ServiceRollup {
      const service: CapacityRollup = {
        availableNow: 4,
        confirmedToday: 1,
        expectedToday: 1,
        blockedToday: 1,
        held: 1,
        leaveUsable: 1,
        excludedBeyondToday,
        unitsTotal: 1,
        freshness: { kind: "never" },
      };
      return { service, sites: [], at: MORNING_HANDOVER_MINUTES, unplacedUnitIds: [] };
    }

    const nonZero = syntheticServiceRollup(3);
    render(<MorningBody liveRollup={nonZero} liveNow={MORNING_HANDOVER_MINUTES} livePeopleWaiting={0} />);
    expect(screen.getByTestId("ward-morning-excluded")).toHaveTextContent(
      "3 beds excluded from the figures above — expected beyond tonight.",
    );

    const zero = syntheticServiceRollup(0);
    const { container } = render(
      <MorningBody liveRollup={zero} liveNow={MORNING_HANDOVER_MINUTES} livePeopleWaiting={0} />,
    );
    expect(within(container).getByTestId("ward-morning-excluded")).toHaveTextContent(
      "0 beds excluded from the figures above — expected beyond tonight.",
    );
  });

  it("states how many units could not be placed under a hospital, and renders nothing when there are none", () => {
    render(<UnplacedUnitsNote unplacedUnitIds={["ghost-unit-1", "ghost-unit-2"]} />);
    expect(screen.getByTestId("ward-morning-unplaced")).toHaveTextContent(
      "2 units could not be placed under a hospital: ghost-unit-1, ghost-unit-2.",
    );

    const { container } = render(<UnplacedUnitsNote unplacedUnitIds={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("carries a print control and a one-line cross-link naming the question each page answers", () => {
    renderMorningPage();

    expect(screen.getByTestId("ward-morning-print")).toHaveTextContent("Print");
    const link = screen.getByRole("link", { name: "shift handover" });
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/handover");
    expect(link.closest("p")).toHaveTextContent("what do I need to hand over this shift?");
  });

  /**
   * Guard for the fix pass (Task 6 follow-up): `FigureList` used to render a bare
   * `ward-morning-figure-<key>` `data-testid` at both site and unit level, and `HeadlineFigure`/
   * `RemainingFigures` rendered the same five keys again at service level — 40 elements sharing
   * one `data-testid` on the real fixture, a guaranteed Playwright strict-mode violation (this
   * repo already has one intermittent flake of exactly this shape on a different screen; this one
   * was certain, not intermittent). Every `data-testid` on the rendered page must now be unique,
   * checked directly against the real fixture rather than against one hand-picked key, so a future
   * call site cannot reintroduce the collision under a key this test did not happen to name.
   */
  it("renders no duplicate data-testid on the page — every figure id carries its service/site/unit level", () => {
    const { container } = renderMorningPage();

    const seen = new Map<string, number>();
    for (const el of container.querySelectorAll("[data-testid]")) {
      const id = el.getAttribute("data-testid")!;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }

    const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
    expect(duplicates, `duplicate data-testid values found: ${JSON.stringify(duplicates)}`).toEqual([]);

    // Guard the guard: the real fixture must actually exercise multiple sites and units, or an
    // empty/trivial fixture could pass this test for the wrong reason (nothing to collide).
    expect(container.querySelectorAll('[data-testid^="ward-morning-site-"]').length).toBeGreaterThan(1);
    expect(container.querySelectorAll('[data-testid^="ward-morning-unit-"]').length).toBeGreaterThan(1);
  });

  /**
   * Gap 1 (final review, the largest hole on the branch). Nothing previously asserted that a
   * hospital's rendered figures are its own wards' figures summed, or that a ward row shows its
   * own numbers rather than someone else's. Three surviving mutations left every existing test —
   * including the Chromium journey — green while every hospital block on screen showed a number
   * that contradicted its neighbours:
   *
   *   1. `serviceRollup` (`ward-morning-rollup.ts`) rolling every site up from the WHOLE
   *      SERVICE's units/breakdowns instead of that site's own — every one of the seventeen
   *      hospitals displays the network total.
   *   2. `SiteBlock` rendering its `FigureList` from its first ward's breakdown instead of the
   *      site rollup — every hospital shows its first ward's figures.
   *   3. `UnitRow` rendering from the site rollup instead of the unit's own breakdown — every
   *      ward under a hospital shows the same (wrong) number. The Chromium journey does not
   *      catch this one: it only reads a delta on one ward, and the site total moves by the same
   *      amount.
   *
   * This test is deliberately DOM-only and self-consistent — it never trusts the page's own
   * numbers against an independently-computed expectation, only checks that what the page
   * renders for a hospital agrees with what it renders for that hospital's own wards. A mutation
   * that makes those two disagree — any of the three above — fails it: mutation 1 makes the site
   * figure the network total (which cannot equal the sum of one hospital's own wards, on a
   * seventeen-hospital network); mutation 2 makes the site figure one ward's number (which
   * cannot equal the sum of two or more wards); mutation 3 makes every ward figure the site
   * total, so summing two or more of them over-counts the true site total. All three need a
   * hospital with 2+ wards to be distinguishable from the correct behaviour, which the
   * non-vacuity check below requires was actually exercised.
   */
  it("renders every hospital's figures as the sum of its own wards' figures — never a network total or one ward's alone", () => {
    const { container } = renderMorningPage();

    function figureValue(scope: ParentNode, testId: string): number {
      const el = scope.querySelector(`[data-testid="${testId}"] dd`);
      expect(el, `no rendered figure for data-testid="${testId}"`).not.toBeNull();
      return Number(el!.textContent);
    }

    const siteSections = [...container.querySelectorAll('section[data-testid^="ward-morning-site-"]')];
    expect(siteSections.length, "no hospital section rendered").toBeGreaterThan(0);

    let sitesChecked = 0;
    let sitesWithMultipleWardsChecked = 0;

    for (const siteEl of siteSections) {
      const code = siteEl.getAttribute("data-testid")!.replace("ward-morning-site-", "");
      const unitRowEls = [...siteEl.querySelectorAll('li[data-testid^="ward-morning-unit-"]')];
      if (unitRowEls.length === 0) continue; // no-unit hospitals (JHC, PEEL) render no figure grid at all
      sitesChecked += 1;
      if (unitRowEls.length > 1) sitesWithMultipleWardsChecked += 1;

      for (const key of ALL_FIGURE_KEYS) {
        const siteValue = figureValue(siteEl, `ward-morning-figure-site-${code}-${key}`);
        const unitSum = unitRowEls.reduce((sum, unitEl) => {
          const unitId = unitEl.getAttribute("data-testid")!.replace("ward-morning-unit-", "");
          return sum + figureValue(unitEl, `ward-morning-figure-unit-${unitId}-${key}`);
        }, 0);
        expect(
          siteValue,
          `${code} ${key}: hospital total (${siteValue}) is not the sum of its own wards' ${key} (${unitSum})`,
        ).toBe(unitSum);
      }
    }

    // Guard the guard: a hospital with 2+ wards must have been exercised, or a mutation that
    // shows every hospital its first ward's figures, or shows every ward its hospital's total,
    // could pass this check by coincidence on a single-ward hospital (where "the site" and "the
    // one ward" are numerically identical either way).
    expect(sitesChecked, "no hospital with any wards was exercised").toBeGreaterThan(1);
    expect(
      sitesWithMultipleWardsChecked,
      "no hospital with 2+ wards was exercised — a first-ward-only or every-ward-shows-the-total bug could pass unnoticed",
    ).toBeGreaterThan(0);
  });

  /**
   * Gap 1, second half: a ward row shows its OWN numbers, checked against an independently
   * computed expectation rather than the page's internal self-consistency the test above checks.
   * Royal Perth Hospital (RPH) carries two real fixture wards, so `UnitRow` silently rendering the
   * hospital's rollup instead of the ward's own breakdown (mutation 3 above) is distinguishable
   * from correct behaviour here too — proven directly by asserting each ward's rendered figures
   * equal `capacityBreakdown()` computed for that ward alone, not `serviceRollup()`'s site-level
   * sum for RPH.
   */
  it("renders each ward row from its own breakdown, computed for that ward alone, not its hospital's rolled-up total", () => {
    let captured: ReturnType<typeof useWardFlow> | undefined;
    function Capture({ children }: { children: ReactNode }) {
      const flow = useWardFlow();
      useEffect(() => {
        captured = flow;
      });
      return <>{children}</>;
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture>
          <MorningPage />
        </Capture>
      </WardFlowProvider>,
    );

    const { units, bedReleases, leaveBeds } = captured!;
    const rphUnits = units.filter((candidate) => candidate.siteCode === "RPH");
    // Guard the guard: RPH must genuinely carry 2+ wards in the live fixture, or a hospital with
    // only one ward could pass this test even if UnitRow silently rendered the hospital's rollup
    // instead of the ward's own breakdown — the two are numerically identical for a one-ward
    // hospital by construction, so the mutation would be invisible here.
    expect(rphUnits.length, "RPH must have 2+ wards for this guard to be meaningful").toBeGreaterThanOrEqual(2);

    const rphSiteRollup = serviceRollup(wardSites, units, bedReleases, leaveBeds, MORNING_HANDOVER_MINUTES).sites.find(
      (candidate) => candidate.site.code === "RPH",
    )!;

    let differsFromSiteRollup = false;
    for (const rphUnit of rphUnits) {
      // The fixed view is frozen at the 08:00 handover instant (renderMorningPage()'s default
      // view) — the independent expectation must be computed at that same instant.
      const expected = capacityBreakdown(rphUnit, bedReleases, leaveBeds, MORNING_HANDOVER_MINUTES);
      const unitEl = screen.getByTestId(`ward-morning-unit-${rphUnit.id}`);
      for (const key of ALL_FIGURE_KEYS) {
        expect(
          within(unitEl).getByTestId(`ward-morning-figure-unit-${rphUnit.id}-${key}`),
          `${rphUnit.id} ${key}`,
        ).toHaveTextContent(String(expected[key]));
        if (expected[key] !== rphSiteRollup.rollup[key]) differsFromSiteRollup = true;
      }
    }

    // Non-vacuity: at least one figure on at least one RPH ward must genuinely differ from RPH's
    // own site rollup, or "shows its own numbers" and "shows the hospital's total" would render
    // identically here and this test could pass for the wrong reason.
    expect(
      differsFromSiteRollup,
      "every RPH ward's breakdown is identical to RPH's site rollup — cannot distinguish 'own numbers' from 'hospital total' with this fixture",
    ).toBe(true);
  });
});
