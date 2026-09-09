import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-screen.dom.test.tsx,
// ward-ed-screen.dom.test.tsx): `ClinicalRail` renders next/link anchors and this suite never
// checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { EscalationBoard } from "@/components/ward-management/ward-derivations";
import {
  EscalatedSection,
  EscalationBoardPage,
  NowhereEligibleSection,
} from "@/components/ward-management/escalation/escalation-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch, so this suite can
 * move the shared clock without reaching into the reducer directly — mirrors `ClockAdvancer` in
 * ward-handover.dom.test.tsx and ward-flow-clock-consistency.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderEscalationBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EscalationBoardPage />
      <ClockAdvancer minutes={100} />
    </WardFlowProvider>,
  );
}

describe("EscalationBoardPage", () => {
  it("renders the root and both sections, in order", () => {
    renderEscalationBoard();

    expect(screen.getByTestId("ward-escalation-page")).toBeInTheDocument();

    const order = ["ward-escalation-escalated", "ward-escalation-nowhere-eligible"];
    const positions = order.map((testId) => {
      const node = screen.getByTestId(testId);
      expect(node).toBeInTheDocument();
      return Array.prototype.indexOf.call(document.querySelectorAll("[data-testid]"), node);
    });
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]);
    }
  });

  it("shows the real fixture's non-empty sections as tables, not the empty note, and names the measured movements", () => {
    renderEscalationBoard();

    // The real fixture at NOW_ANCHOR carries exactly one escalated movement (WF-009) and exactly
    // two movements with nowhere eligible (WF-009, WF-308) — measured, see tests/ward-escalation.test.ts.
    // Neither section is empty against this seed, so neither "-empty" note should render.
    expect(screen.queryByTestId("ward-escalation-escalated-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-escalation-nowhere-eligible-empty")).not.toBeInTheDocument();

    const escalatedText = screen.getByTestId("ward-escalation-escalated").textContent ?? "";
    expect(escalatedText).toContain("WF-009");
    expect(escalatedText).toContain("State bed coordination desk");

    const nowhereText = screen.getByTestId("ward-escalation-nowhere-eligible").textContent ?? "";
    expect(nowhereText).toContain("WF-009");
    expect(nowhereText).toContain("WF-308");
  });

  it("never renders a near-miss or ranking word anywhere on the page — it records and shows, it suggests nothing", () => {
    renderEscalationBoard();
    const pageText = screen.getByTestId("ward-escalation-page").textContent ?? "";
    for (const forbidden of ["least-bad", "closest", "almost", "nearest", "recommend", "suggest"]) {
      expect(pageText.toLowerCase()).not.toContain(forbidden);
    }
  });

  // This board reads live: advancing the shared clock must move WF-009's wait label forward. If a
  // future edit added a `useState` freeze here, this goes red.
  //
  // This comment used to say "unlike the shift handover" and pointed at that suite's freeze test as
  // the opposite assertion. Both halves died with owner decision OD-4 on 2026-08-30 — the handover
  // reads live too, and its freeze test was replaced by the inverse. Left pointing at a pattern
  // that no longer exists, this would have told a reader to copy a freeze from a page that has
  // none.
  it("stays live: the wait column advances when the shared clock advances", () => {
    renderEscalationBoard();

    const beforeText = screen.getByTestId("ward-escalation-escalated").textContent ?? "";

    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    const afterText = screen.getByTestId("ward-escalation-escalated").textContent ?? "";
    expect(afterText).not.toBe(beforeText);
  });

  // Every section must state plainly when it is empty (spec's conservative-failure rule) — but
  // the real fixture, at any `now`, never produces an empty section here (WF-009 always carries
  // its escalation; the standard scenario's nowhereEligible pair is authored into the fixture and
  // does not clear with time). Rather than weaken this assertion by skipping it, the precondition
  // is constructed explicitly: an empty `EscalationBoard` is a real, valid value of the exported
  // type, and each section component takes it as a plain prop with no dependency on the provider.
  describe("renders the explicit empty note for both sections, given an empty board", () => {
    const emptyBoard: EscalationBoard = { escalated: [], nowhereEligible: [] };

    it("escalated", () => {
      render(<EscalatedSection board={emptyBoard} now={NOW_ANCHOR} />);
      expect(screen.getByTestId("ward-escalation-escalated-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("nowhere eligible", () => {
      render(<NowhereEligibleSection board={emptyBoard} now={NOW_ANCHOR} />);
      expect(screen.getByTestId("ward-escalation-nowhere-eligible-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});
