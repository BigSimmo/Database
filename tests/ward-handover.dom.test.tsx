import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-screen.dom.test.tsx, ward-ed-screen.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx): `ClinicalRail` renders next/link anchors and this
// suite never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { formatInstant } from "@/components/ward-management/ward-clock";
import type { HandoverSnapshot } from "@/components/ward-management/ward-derivations";
import {
  HandoverPage,
  HeldBedsSection,
  InTransitSection,
  LongestWaitsSection,
  PlacementGoneWrongSection,
} from "@/components/ward-management/handover/handover-page";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch, so this suite can
 * move the shared clock without reaching into the reducer directly — mirrors `ClockAdvancer` in
 * ward-flow-clock-consistency.dom.test.tsx and `DispatchProbe` in ward-flow-provider.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
      <ClockAdvancer minutes={100} />
    </WardFlowProvider>,
  );
}

describe("HandoverPage", () => {
  it("renders the root and all four sections, in order", () => {
    renderHandover();

    expect(screen.getByTestId("ward-handover-page")).toBeInTheDocument();

    const order = [
      "ward-handover-longest-waits",
      "ward-handover-held-beds",
      "ward-handover-in-transit",
      "ward-handover-placement-gone-wrong",
    ];
    const positions = order.map((testId) => {
      const node = screen.getByTestId(testId);
      expect(node).toBeInTheDocument();
      return Array.prototype.indexOf.call(document.querySelectorAll("[data-testid]"), node);
    });
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]);
    }
  });

  it("shows the real fixture's non-empty sections as tables, not the empty note", () => {
    renderHandover();

    // The real fixture at NOW_ANCHOR carries 41 open movements, 7 held beds, 8 in transit and
    // one escalated movement (measured — see tests/ward-handover.test.ts) — none of the four
    // sections is naturally empty against this seed, so none of the "-empty" notes should render
    // here. The explicit-empty-note behaviour itself is proved separately below, against a
    // constructed empty snapshot, because the live seed can never produce one (see that test's
    // own comment).
    expect(screen.queryByTestId("ward-handover-longest-waits-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-held-beds-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-in-transit-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-placement-gone-wrong-empty")).not.toBeInTheDocument();
  });

  /**
   * THE FREEZE MUST BE REAL. `handoverSnapshot` is a pure function of `now`, so if
   * `HandoverPage` ever re-derived it on the provider's live clock tick — instead of freezing it
   * once at mount — this test would catch it two different ways:
   *
   * 1. The freeze-time label itself would move.
   * 2. WF-016's held bed (`bedHeldUntil = NOW_ANCHOR + 45`, fixture-authored, see
   *    ward-movements.ts) reads "Expires in 45m" at mount. Advancing the clock 100 minutes takes
   *    the LIVE `now` past that bed's hold time — if this page recomputed on that live clock, the
   *    same row would flip to "Expired", a categorical change, not just a shifted number. A
   *    frozen page must still show "Expires in 45m" after the advance.
   *
   * The whole page's rendered text is also compared before and after, so any other section
   * quietly drifting (a wait label ticking up, a new "Expired" row) fails this test too, not just
   * the two named checks above.
   */
  it("freezes at open and does not change when the shared clock advances", () => {
    renderHandover();

    const frozenAtBefore = screen.getByTestId("ward-handover-frozen-at").textContent;
    expect(frozenAtBefore).toBe(`Frozen at ${formatInstant(NOW_ANCHOR)}`);

    const heldBedsBefore = screen.getByTestId("ward-handover-held-beds").textContent;
    expect(heldBedsBefore).toContain("WF-016");
    expect(heldBedsBefore).toContain("Expires in 45m");

    const pageBefore = screen.getByTestId("ward-handover-page").textContent;

    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    const frozenAtAfter = screen.getByTestId("ward-handover-frozen-at").textContent;
    expect(frozenAtAfter).toBe(frozenAtBefore);

    const heldBedsAfter = screen.getByTestId("ward-handover-held-beds").textContent;
    expect(heldBedsAfter).toBe(heldBedsBefore);
    expect(heldBedsAfter).toContain("Expires in 45m");

    const pageAfter = screen.getByTestId("ward-handover-page").textContent;
    expect(pageAfter).toBe(pageBefore);
  });

  // Every section must state plainly when it is empty (spec's conservative-failure rule) — but
  // the real fixture, at any `now`, never produces an empty section: 41 open movements, 7 held
  // beds, 8 in-transit jobs and one placement-gone-wrong entry are all authored into the seed
  // (see ward-movements.ts), and the freeze mechanism above means a post-mount reducer event can
  // never reach a frozen page's own rendering anyway. Rather than weaken this assertion by
  // skipping it, the precondition is constructed explicitly: an empty `HandoverSnapshot` is a
  // real, valid value of the exported type (every section is independently optional — nothing
  // about "zero open movements" is fabricated clinical data, it is simply an empty array), and
  // each section component takes that snapshot as a plain prop, with no dependency on the
  // provider or the freeze. Rendering each one directly proves the empty-note branch for real.
  /**
   * Spec D9: the morning page and this handover page must each carry a one-line link to the
   * other, naming the question each one answers, so the two are never confused. The morning
   * page's own reciprocal link (`morning-page.tsx`) is already covered by
   * `tests/ward-morning-page.dom.test.tsx`; this is the other half.
   */
  it("carries a one-line cross-link back to the morning bed state, naming the question each page answers", () => {
    renderHandover();

    const link = screen.getByRole("link", { name: "morning bed state" });
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/morning");
    expect(link.closest("p")).toHaveTextContent("what can I fill right now, across the network?");
  });

  describe("renders the explicit empty note for every section, given an empty snapshot", () => {
    const emptySnapshot: HandoverSnapshot = {
      frozenAt: NOW_ANCHOR,
      longestWaits: [],
      heldBeds: [],
      inTransit: [],
      placementGoneWrong: [],
    };

    it("longest waits", () => {
      render(<LongestWaitsSection snapshot={emptySnapshot} />);
      expect(screen.getByTestId("ward-handover-longest-waits-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("held beds", () => {
      render(<HeldBedsSection snapshot={emptySnapshot} />);
      expect(screen.getByTestId("ward-handover-held-beds-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("in transit", () => {
      render(<InTransitSection snapshot={emptySnapshot} units={[]} />);
      expect(screen.getByTestId("ward-handover-in-transit-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("placement gone wrong", () => {
      render(<PlacementGoneWrongSection snapshot={emptySnapshot} />);
      expect(screen.getByTestId("ward-handover-placement-gone-wrong-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});
