import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
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
    <MorningBody frozen={{ instant: null, rollup: null }} view={view} onChangeView={setView} liveRollup={liveRollup} liveNow={now} />
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

    // `ward-morning-figure-<key>` is deliberately reused at service, site and unit level (each
    // level carries its own five figures), so scope to one container rather than asserting a
    // single unscoped match — the headline for `availableNow`, the service-level block for the
    // other four.
    const headline = screen.getByTestId("ward-morning-headline");
    expect(within(headline).getByTestId("ward-morning-figure-availableNow")).toBeInTheDocument();

    const remaining = screen.getByTestId("ward-morning-remaining-figures");
    expect(within(remaining).getByTestId("ward-morning-figure-confirmedToday")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-predictedToday")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-held")).toBeInTheDocument();
    expect(within(remaining).getByTestId("ward-morning-figure-leaveUsable")).toBeInTheDocument();
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

    function Capture({ children }: { children: ReactNode }) {
      captured = useWardFlow();
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
    expect(within(headline).getByTestId("ward-morning-figure-availableNow")).toHaveTextContent(
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
   * one value is three strings, never a JSX hunt. This asserts that directly against the page's
   * own source text: none of the current label values may appear anywhere in `morning-page.tsx`
   * as a quoted string literal, because the only legitimate way to render one is
   * `CAPACITY_FIGURE_LABELS[key]`. (Precedent for a source-text assertion in this style:
   * `tests/ward-management.test.ts`, `tests/ward-legal-figure-guard.test.ts`.)
   */
  it("never hardcodes a figure-label literal in the page source — every label is read from CAPACITY_FIGURE_LABELS", () => {
    const source = readFileSync("src/components/ward-management/morning/morning-page.tsx", "utf8");
    for (const label of Object.values(CAPACITY_FIGURE_LABELS)) {
      expect(source.includes(JSON.stringify(label))).toBe(false);
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
      <FreshnessStamp
        freshness={{ kind: "partial", oldestConfirmedAt: 100, unitsConfirmed: 14, unitsTotal: 15 }}
      />,
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
});
