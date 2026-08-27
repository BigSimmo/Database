import { fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
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
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  buildFrozenMorning,
  FreshnessStamp,
  MorningBody,
  MorningPage,
  UnplacedUnitsNote,
  type MorningView,
} from "@/components/ward-management/morning/morning-page";
import {
  CAPACITY_FIGURE_LABELS,
  MORNING_HANDOVER_MINUTES,
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

/**
 * Drives `MorningBody` directly with a hand-authored `frozen = { instant: null, rollup: null }`
 * — the null-handover failure branch — instead of depending on `WardFlowProvider`'s live clock
 * ever genuinely falling before 08:00.
 *
 * That dependency does not actually work in this codebase today: `WardFlowProvider`'s
 * `initialNow` prop is documented as "pins the clock at this instant", but its value is only
 * ever used to decide whether the clock is pinned at all — `now` is always computed as
 * `NOW_ANCHOR + elapsed + clockOffsetMinutes`, and `elapsed` is hardcoded to `0` whenever
 * `initialNow` is defined, so `initialNow`'s own numeric value is never read on that path. Every
 * existing Ward Flow test happens to pass `initialNow={NOW_ANCHOR}` (642, 10:42 — after the
 * 08:00 gate), so nothing has exercised a pinned `now` before 08:00 until this suite. This is
 * exactly the kind of case `MorningBody`'s own doc comment explains the seam is for — see that
 * comment in `morning-page.tsx`. (Flagged separately; not this task's file to fix.)
 */
function NullHandoverHarness() {
  const { units, bedReleases, leaveBeds, now } = useWardFlow();
  const [view, setView] = useState<MorningView>("fixed");
  const liveRollup = serviceRollup(wardSites, units, bedReleases, leaveBeds, now);
  return (
    <MorningBody
      frozen={{ instant: null, rollup: null }}
      view={view}
      onChangeView={setView}
      liveRollup={liveRollup}
      liveNow={now}
    />
  );
}

/**
 * Unlike `NullHandoverHarness` above, this drives the REAL `buildFrozenMorning` — the actual
 * null-producing path (spec D5) — instead of hand-authoring `frozen = { instant: null, rollup:
 * null }`. `WardFlowProvider`'s `initialNow` prop cannot be used to make the live `now` genuinely
 * fall before 08:00 (its numeric value is discarded on the path that matters — see
 * `NullHandoverHarness`'s comment and the mutation report's Gap 1), so this harness takes the real
 * `units`/`bedReleases`/`leaveBeds` from the provider and calls `buildFrozenMorning` directly with
 * a synthetic pre-08:00 `now` argument — exactly the value `MorningPage`'s own `useState`
 * initialiser would close over if the clock genuinely read that time. This exercises
 * `buildFrozenMorning`'s null-propagation for real, not a bypass of it.
 */
function DirectFrozenHarness({ now }: { now: Instant }) {
  const { units, bedReleases, leaveBeds } = useWardFlow();
  const frozen = buildFrozenMorning(now, wardSites, units, bedReleases, leaveBeds);
  const [view, setView] = useState<MorningView>("fixed");
  const liveRollup = serviceRollup(wardSites, units, bedReleases, leaveBeds, now);
  return <MorningBody frozen={frozen} view={view} onChangeView={setView} liveRollup={liveRollup} liveNow={now} />;
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
    expect(within(remaining).getByTestId("ward-morning-figure-service-predictedToday")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-service-held")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-service-leaveUsable")).toBeInTheDocument();
  });

  /**
   * The single most important rule in this project (stated in `GovernanceBanner`'s own copy):
   * nothing predicted, confirmed-but-unreleased, or on leave may ever reach "beds available right
   * now". No existing test asserted the headline's actual NUMBER, only its presence — so a
   * mutation making the headline `availableNow + confirmedToday` (mutation-report Gap 3, the most
   * serious of the three) passed every assertion in this file. This test computes the expected
   * figure independently via `serviceRollup(...)` from the same real fixture data the page itself
   * renders, over `bedReleases`/`leaveBeds` fixtures (`ward-movements.ts`) that are seeded with
   * non-zero `confirmedToday`, `predictedToday` and `leaveUsable` at the frozen 08:00 handover
   * instant — asserted below rather than assumed, so this guard cannot pass merely because those
   * fields happened to be zero. Adding any of them into the headline changes the expected number
   * and fails this test.
   */
  it("renders the headline as availableNow alone, never mixing in confirmedToday, predictedToday or leaveUsable", () => {
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
    expect(expected.predictedToday).toBeGreaterThan(0);
    expect(expected.leaveUsable).toBeGreaterThan(0);

    const headline = screen.getByTestId("ward-morning-headline");
    expect(within(headline).getByTestId("ward-morning-figure-service-availableNow")).toHaveTextContent(
      String(expected.availableNow),
    );
  });

  it("renders every figure label from the one definition, so a model change is three strings", () => {
    renderMorningPage();
    for (const label of Object.values(CAPACITY_FIGURE_LABELS)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  /**
   * The test above asserts rendered text equals `CAPACITY_FIGURE_LABELS`'s own values, which is
   * self-referential: a hardcoded literal identical to the constant (e.g. `"Predicted today"`
   * typed directly into JSX instead of `{CAPACITY_FIGURE_LABELS.predictedToday}`) produces the
   * same DOM and passes it (mutation-report Gap 2). What spec D14 actually protects is that the
   * page has no such literal at all — every label site reads the constant, so a future rename of
   * one value is three strings, never a JSX hunt.
   *
   * Gap 3 (final review). This used to be `source.includes(JSON.stringify(label))` — a raw
   * substring check for the DOUBLE-QUOTED form only. `JSON.stringify("Predicted today")` is
   * `"Predicted today"` with double quotes, so the guard was blind to a single-quoted literal
   * (`'Predicted today'`) and, more seriously, to a TEMPLATE literal (`` {`Predicted today`} ``):
   * Prettier does not rewrite a template literal to quotes, so that form survives lint and format
   * as well as the old test. Replaced with an AST-based scan (`literalsIn`, lifted out of
   * `tests/ward-legal-figure-guard.test.ts` rather than re-implemented here — see that helper's
   * own doc comment), which reads every string literal, no-substitution template literal, and
   * template head/middle/tail the TypeScript parser sees, independent of quote style. Matching is
   * by substring (`literal.includes(label)`, not equality) so a label hardcoded with a dynamic
   * suffix concatenated on — `` `Predicted today ${x}` ``, whose static head text already carries
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

  /**
   * THE FREEZE MUST BE REAL. `serviceRollup` is a pure function of `now`, so if `MorningPage`
   * ever re-derived the fixed view on the provider's live clock tick — instead of freezing it
   * once at mount — this test catches it two ways: the headline figure text would change, and
   * every site block's text would change too (compared whole). Advancing the clock 100 minutes
   * from `NOW_ANCHOR` (10:42) to 12:22 stays within the same operating day and stays well after
   * 08:00, so this is purely a freeze check, not a null-handover check (that is covered below).
   *
   * The live view is checked in the same test to prove the opposite is also true: the "Live
   * HH:MM" control label DOES move when the clock advances, because it reads the live `now` on
   * every render — if the whole page were accidentally frozen (not just the fixed view), this
   * assertion would fail too.
   */
  it("freezes the fixed view at open and does not change when the shared clock advances, while the live label keeps moving", () => {
    renderMorningPage({ withClockAdvancer: true });

    const headlineBefore = screen.getByTestId("ward-morning-headline").textContent;
    const sitesBefore = screen.getByTestId("ward-morning-sites").textContent;
    const liveButtonBefore = screen.getByTestId("ward-morning-view-live").textContent;
    expect(liveButtonBefore).toContain(formatInstant(NOW_ANCHOR));

    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    const headlineAfter = screen.getByTestId("ward-morning-headline").textContent;
    const sitesAfter = screen.getByTestId("ward-morning-sites").textContent;
    expect(headlineAfter).toBe(headlineBefore);
    expect(sitesAfter).toBe(sitesBefore);

    const liveButtonAfter = screen.getByTestId("ward-morning-view-live").textContent;
    expect(liveButtonAfter).toContain(formatInstant(NOW_ANCHOR + 100));
    expect(liveButtonAfter).not.toBe(liveButtonBefore);
  });

  /**
   * Failure branch: `morningHandoverInstant(now)` is `null` before 08:00, i.e.
   * `frozen = { instant: null, rollup: null }`. The fixed view must show no figures at all —
   * never a previous day's snapshot, never a silent fall back to `now` (spec D5). See
   * `NullHandoverHarness`'s own comment for why this drives `MorningBody` directly.
   */
  it("shows no figures at all in the fixed view before 08:00, states the handover has not been taken, and offers the live view", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NullHandoverHarness />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-morning-no-handover")).toHaveTextContent(
      "The 08:00 handover has not been taken for this day.",
    );
    expect(screen.queryByTestId("ward-morning-headline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-sites")).not.toBeInTheDocument();

    // Offering the live view — clicking through actually switches and renders real figures.
    fireEvent.click(screen.getByRole("button", { name: "Show the live view instead" }));

    expect(screen.queryByTestId("ward-morning-no-handover")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-morning-headline")).toBeInTheDocument();
    expect(screen.getByTestId("ward-morning-view-live")).toHaveAttribute("aria-pressed", "true");
  });

  /**
   * Same failure branch as the test above, but through the REAL `buildFrozenMorning` (see
   * `DirectFrozenHarness`'s doc comment for why `WardFlowProvider` cannot supply this directly).
   * A `buildFrozenMorning` that silently fell back to `now` instead of propagating `null` —
   * mutation-report Gap 1 — would render figures here instead of the not-taken state, and this
   * test would fail.
   */
  it("propagates buildFrozenMorning()'s real null-instant result to no figures at all, never a fallback to now", () => {
    const beforeHandover = 100; // 01:40 on the same operating day as NOW_ANCHOR (642) — before 08:00
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DirectFrozenHarness now={beforeHandover} />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-morning-no-handover")).toHaveTextContent(
      "The 08:00 handover has not been taken for this day.",
    );
    expect(screen.queryByTestId("ward-morning-headline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-morning-sites")).not.toBeInTheDocument();
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
   * today 0 · Predicted today 0 · Held 0 · Leave (usable) 0" under a real hospital's name, as if
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
  it("states which view and instant the print-only label carries, and updates it when the view toggles", () => {
    renderMorningPage();

    expect(screen.getByTestId("ward-morning-print-view-label")).toHaveTextContent(
      `This sheet: handover view, frozen ${formatInstant(MORNING_HANDOVER_MINUTES)}.`,
    );
    expect(screen.getByTestId("ward-morning-print-view-note")).toHaveTextContent(
      "not a reconstruction of what the ward state actually was at 08:00",
    );

    fireEvent.click(screen.getByTestId("ward-morning-view-live"));

    expect(screen.getByTestId("ward-morning-print-view-label")).toHaveTextContent(
      `This sheet: live view, as at ${formatInstant(NOW_ANCHOR)}.`,
    );
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
        predictedToday: 1,
        held: 1,
        leaveUsable: 1,
        excludedBeyondToday,
        unitsTotal: 1,
        freshness: { kind: "never" },
      };
      return { service, sites: [], at: MORNING_HANDOVER_MINUTES, unplacedUnitIds: [] };
    }

    const nonZero = syntheticServiceRollup(3);
    render(
      <MorningBody
        frozen={{ instant: MORNING_HANDOVER_MINUTES, rollup: nonZero }}
        view="fixed"
        onChangeView={() => {}}
        liveRollup={nonZero}
        liveNow={MORNING_HANDOVER_MINUTES}
      />,
    );
    expect(screen.getByTestId("ward-morning-excluded")).toHaveTextContent(
      "3 beds excluded from the figures above — expected beyond tonight.",
    );

    const zero = syntheticServiceRollup(0);
    const { container } = render(
      <MorningBody
        frozen={{ instant: MORNING_HANDOVER_MINUTES, rollup: zero }}
        view="fixed"
        onChangeView={() => {}}
        liveRollup={zero}
        liveNow={MORNING_HANDOVER_MINUTES}
      />,
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

  it("marks the active fixed/live view in text as well as aria-pressed, not colour alone", () => {
    renderMorningPage();

    const fixedButton = screen.getByTestId("ward-morning-view-fixed");
    const liveButton = screen.getByTestId("ward-morning-view-live");
    // The fixed control's own label names the literal handover time — always 08:00, from the
    // one constant, never the actual freeze instant (which is `null` on the no-handover branch).
    expect(fixedButton).toHaveTextContent(formatInstant(MORNING_HANDOVER_MINUTES));
    expect(fixedButton).toHaveAttribute("aria-pressed", "true");
    expect(liveButton).toHaveAttribute("aria-pressed", "false");
    expect(fixedButton).toHaveTextContent("Showing");
    expect(liveButton).not.toHaveTextContent("Showing");

    fireEvent.click(liveButton);

    expect(fixedButton).toHaveAttribute("aria-pressed", "false");
    expect(liveButton).toHaveAttribute("aria-pressed", "true");
    expect(fixedButton).not.toHaveTextContent("Showing");
    expect(liveButton).toHaveTextContent("Showing");
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

  /**
   * Gap 4 (final review), on-screen half. `ViewControl`'s explainer paragraph is the page's ONLY
   * statement that the fixed view is a snapshot taken at page open, read against the 08:00 clock
   * — NOT a reconstruction of what the ward state actually was at 08:00, because this prototype
   * keeps no event history. That honesty requirement is binding (spec D5/D6): a coordinator who
   * mistakes the fixed view for a true 08:00 reconstruction is trusting a number the prototype
   * cannot actually stand behind. Nothing previously asserted this paragraph's substance — a
   * mutation deleting it outright would have gone unnoticed by every existing test.
   */
  it("states the fixed view's binding honesty caveat in the on-screen explainer — a snapshot at open against the 08:00 clock, not a reconstruction of 08:00 itself", () => {
    renderMorningPage();

    const explainer = screen.getByTestId("ward-morning-view-explainer");
    expect(explainer).toHaveTextContent(
      "The handover view is a snapshot taken when this page was opened, read against the 08:00 handover clock",
    );
    expect(explainer).toHaveTextContent("not a reconstruction of what the ward state actually was at 08:00");
    expect(explainer).toHaveTextContent("this prototype keeps no event history");
  });
});
