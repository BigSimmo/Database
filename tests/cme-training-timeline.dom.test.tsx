import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmeTrainingTimeline } from "@/components/cme/cme-training-timeline";
import type { TrainingPeriod } from "@/lib/cme/training-timeline";

/** Made-up training record: two stages, four rotations and a short break. */
const PERIODS: TrainingPeriod[] = [
  { id: "s1", kind: "stage", label: "Stage 1", startsOn: "2025-02-03", endsOn: "2026-02-01", fte: 1 },
  { id: "s2", kind: "stage", label: "Stage 2", startsOn: "2026-02-02", endsOn: null, fte: 1 },
  { id: "r0", kind: "rotation", label: "Community", startsOn: "2025-02-03", endsOn: "2026-01-30", fte: 1 },
  { id: "r1", kind: "rotation", label: "Adult inpatient", startsOn: "2026-02-02", endsOn: "2026-07-31", fte: 1 },
  { id: "b1", kind: "break", label: "Leave", startsOn: "2026-08-01", endsOn: "2026-08-02", fte: 0 },
  {
    id: "r2",
    kind: "rotation",
    label: "Consultation liaison",
    startsOn: "2026-08-03",
    endsOn: "2027-01-29",
    fte: 0.5,
  },
  { id: "r3", kind: "rotation", label: "Old age", startsOn: "2027-02-01", endsOn: "2027-07-30", fte: 1 },
];

function segment(id: string): Element {
  return screen.getByTestId("cme-training-timeline-track").querySelector(`[data-period-id="${id}"]`)!;
}

describe("the training timeline", () => {
  it("draws past and future in the grey ramp and only the current rotation in CPD indigo", () => {
    render(<CmeTrainingTimeline periods={PERIODS} today="2026-09-28" />);
    expect(segment("r2")).toHaveAttribute("data-state", "current");
    expect(segment("r2")).toHaveAttribute("data-mode-identity", "cme");
    expect(segment("r2").getAttribute("class")).toContain("fill-[color:var(--mode-identity)]");
    expect(segment("r1").getAttribute("class")).toContain("fill-[color:var(--text-muted)]");
    expect(segment("r3").getAttribute("class")).toContain("fill-[color:var(--border)]");
    expect(segment("s2")).toHaveAttribute("data-state", "current-stage");
    expect(segment("b1").getAttribute("fill")).toMatch(/^url\(#cme-training-hatch-/);
    const track = screen.getByTestId("cme-training-timeline-track");
    expect(track).toHaveAttribute("aria-hidden", "true");
    expect(track.querySelectorAll("[data-mode-identity]")).toHaveLength(1);
    expect(track.innerHTML).not.toContain("--tone-");
  });

  it("marks now in product blue, inside the current rotation", () => {
    render(<CmeTrainingTimeline periods={PERIODS} today="2026-09-28" />);
    const now = screen.getByTestId("cme-training-timeline-now-marker");
    expect(now.getAttribute("class")).toContain("stroke-[color:var(--clinical-accent)]");
    const nowX = Number(now.getAttribute("x1"));
    const start = Number(segment("r2").getAttribute("x"));
    const width = Number(segment("r2").getAttribute("width"));
    expect(nowX).toBeGreaterThan(start);
    expect(nowX).toBeLessThan(start + width);
  });

  it("says the same facts in words", () => {
    render(<CmeTrainingTimeline periods={PERIODS} today="2026-09-28" />);
    expect(screen.getByTestId("cme-training-timeline-range")).toHaveTextContent("Mon 3 Feb 2025 – ongoing");
    expect(screen.getByTestId("cme-training-timeline-now")).toHaveTextContent(
      "Now, Mon 28 Sep: Consultation liaison, rotation 2 of 3",
    );
    const legend = screen.getByRole("list", { name: "What the timeline shows" });
    expect([...legend.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "This rotation",
      "Other rotations",
      "Stages, top line",
      "Break",
      "Now",
    ]);
  });

  it("says when today falls in a break, with no rotation in indigo", () => {
    render(<CmeTrainingTimeline periods={PERIODS} today="2026-08-01" />);
    expect(screen.getByTestId("cme-training-timeline-now")).toHaveTextContent("Now, Sat 1 Aug: on a break, Leave");
    expect(screen.getByTestId("cme-training-timeline-track").querySelector("[data-mode-identity]")).toBeNull();
    expect(screen.getByRole("list", { name: "What the timeline shows" })).not.toHaveTextContent("This rotation");
  });

  it("draws nothing when no period is recorded", () => {
    const { container } = render(<CmeTrainingTimeline periods={[]} today="2026-09-28" />);
    expect(container).toBeEmptyDOMElement();
  });
});
