// tests/ward-community-figures.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityFigures, type CommunityFigureSpec } from "@/components/ward-management/community/community-figures";

/**
 * `CommunityFigures` is presentational only -- see its own doc comment on why. Every value below
 * is a FIXTURE, invented for this test alone, never a value the component itself computes. The
 * design prototype's own figures (61, 38, 5d 2h, 7, 3 of 16) are likewise invented and are not
 * reused here, so nobody mistakes this fixture for real repository data.
 */
const FIXTURE: readonly CommunityFigureSpec[] = [
  { label: "Coming in, awaiting first contact", value: "42" },
  { label: "Going out, awaiting a bed", value: "19" },
  { label: "Longest wait for contact", value: "3d 6h", sub: "RF-901 · fixture", flagged: true },
  { label: "Nobody now looking for a bed", value: "5", sub: "All wards asked have declined", flagged: true },
  { label: "Teams with nothing waiting", value: "2", unit: "of 65" },
];

describe("CommunityFigures", () => {
  it("renders five tiles, with the label, value, unit and sub the fixture supplies -- not constants", () => {
    render(<CommunityFigures figures={FIXTURE} />);
    for (const figure of FIXTURE) {
      expect(screen.getByText(figure.label)).toBeInTheDocument();
      expect(screen.getByText(figure.value)).toBeInTheDocument();
      if (figure.sub) expect(screen.getByText(figure.sub)).toBeInTheDocument();
      if (figure.unit) expect(screen.getByText(figure.unit)).toBeInTheDocument();
    }
  });

  it("carries `flagged` on exactly the two fixture tiles that ask for it, and no others", () => {
    const { container } = render(<CommunityFigures figures={FIXTURE} />);
    const flagged = container.querySelectorAll('[data-flagged="true"]');
    expect(flagged).toHaveLength(2);
  });

  it("does not hardcode any figure -- a different fixture renders different values", () => {
    const other: readonly CommunityFigureSpec[] = [{ label: "A made-up label", value: "999", unit: "of 999" }];
    render(<CommunityFigures figures={other} />);
    expect(screen.getByText("A made-up label")).toBeInTheDocument();
    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.getByText("of 999")).toBeInTheDocument();
    expect(screen.queryByText("Coming in, awaiting first contact")).not.toBeInTheDocument();
  });

  /**
   * The emphasis rule, proved here rather than trusted from the primitive's own suite --
   * `tests/ward-figure.dom.test.tsx` already proves `WardFigureStrip` refuses three; this proves
   * `CommunityFigures` does not swallow or re-wrap that refusal on the way through.
   */
  it("refuses a fixture that flags a third tile, with WardFigureStrip's own message", () => {
    const threeFlagged: readonly CommunityFigureSpec[] = [
      { label: "a", value: "1", flagged: true },
      { label: "b", value: "2", flagged: true },
      { label: "c", value: "3", flagged: true },
    ];
    expect(() => render(<CommunityFigures figures={threeFlagged} />)).toThrow(/at most two/u);
  });
});
