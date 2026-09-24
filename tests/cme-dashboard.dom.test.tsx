import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { DEMO_CME_ENTRIES, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

function renderAt(iso: string) {
  return render(<CmeDashboard set={DEMO_CME_YEAR} entries={DEMO_CME_ENTRIES} now={new Date(iso)} />);
}

/**
 * Two unmet `hours-in-category` requirements, deliberately listed with the
 * SMALLER gap first. `evaluateYear` preserves `set.requirements` order in
 * `unmet`, so a next-action picker that took `unmet[0]` — list order — would
 * point at "Small gap" here, even though "Big gap" is nineteen hours further
 * from being met. Only a picker that actually compares the two gaps gets
 * this right regardless of which requirement happens to be listed first.
 */
const FURTHEST_FROM_MET_SET: CmeRequirementSet = {
  year: 2026,
  confirmedOn: "2026-01-01",
  confirmedSource: "Test fixture",
  totalHours: 50,
  requirements: [
    {
      id: "req-small-gap",
      label: "Small gap requirement",
      source: "national",
      spec: { shape: "hours-in-category", category: "educational", minimumHours: 10 },
      completedOn: null,
    },
    {
      id: "req-big-gap",
      label: "Big gap requirement",
      source: "national",
      spec: { shape: "hours-in-category", category: "reviewing", minimumHours: 20 },
      completedOn: null,
    },
  ],
};

const FURTHEST_FROM_MET_ENTRIES: readonly CmeEntry[] = [
  {
    id: "fixture-entry-1",
    date: "2026-06-01",
    title: "Some activity",
    allocations: [{ category: "educational", hours: 9 }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
  },
];

describe("the dashboard", () => {
  it("opens an overdue routine as a pre-filled activity from the Routines due module", async () => {
    const user = userEvent.setup();
    const onLogRoutine = vi.fn();
    const routine: CmeRoutine = {
      id: "routine-due",
      title: "Peer review group",
      cadence: "monthly",
      usualHours: 1,
      usualAllocations: [{ category: "reviewing", hours: 1 }],
      nextDue: "2026-09-01",
      archivedAt: null,
    };
    render(
      <CmeDashboard
        set={DEMO_CME_YEAR}
        entries={DEMO_CME_ENTRIES}
        now={new Date("2026-09-19T02:00:00Z")}
        routines={[routine]}
        onLogRoutine={onLogRoutine}
      />,
    );
    // Changed 2026-09-24: a due routine no longer takes the single Next slot,
    // which hid the requirement gap and the year-end reminder. It is logged
    // from its own row in the Routines due module.
    expect(screen.getByTestId("cme-next-action")).not.toHaveTextContent(/peer review group/i);
    const due = screen.getByTestId("cme-routines-due");
    const log = within(due).getByRole("button", { name: /log/i });
    expect(log.className).toMatch(/min-h-(?:12|tap)/);
    await user.click(log);
    expect(onLogRoutine).toHaveBeenCalledWith({
      routineId: "routine-due",
      date: "2026-09-19",
      title: "Peer review group",
      hours: 1,
      allocations: [{ category: "reviewing", hours: 1 }],
    });
  });

  it("leads with the figure, the pace mark and one action", () => {
    renderAt("2026-09-19T02:00:00Z");
    expect(screen.getByTestId("cme-total-hours")).toHaveTextContent("32.5");
    expect(screen.getByTestId("progress-mark")).toBeInTheDocument();
    expect(screen.getByTestId("cme-pace-sentence")).toHaveTextContent(/45 hours by 31 December/);
    expect(screen.getByTestId("cme-next-action")).toBeInTheDocument();
  });

  it("says nothing about pace in January and points at the plan instead", () => {
    const earlyYearSet: CmeRequirementSet = {
      ...DEMO_CME_YEAR,
      requirements: DEMO_CME_YEAR.requirements.map((requirement) =>
        requirement.id === "plan" ? { ...requirement, completedOn: null } : requirement,
      ),
    };
    render(<CmeDashboard set={earlyYearSet} entries={DEMO_CME_ENTRIES} now={new Date("2026-01-06T02:00:00Z")} />);
    expect(screen.queryByTestId("cme-pace-sentence")).toBeNull();
    expect(screen.queryByTestId("progress-mark")).toBeNull();
    expect(screen.getByTestId("cme-next-action")).toHaveTextContent(/development plan/i);
  });

  it("turns into the year-end checklist in the last fortnight", () => {
    renderAt("2026-12-28T02:00:00Z");
    const next = screen.getByTestId("cme-next-action");
    expect(next).toHaveTextContent(/year end/i);
    // There is no close-the-year step to send anyone to; it opens the summary.
    expect(next).not.toHaveTextContent(/close the year/i);
    expect(next).toHaveAttribute("href", "/cme/summary?year=2026");
  });

  it("shows a legitimate zero as a zero", () => {
    render(<CmeDashboard set={DEMO_CME_YEAR} entries={[]} now={new Date("2026-09-19T02:00:00Z")} />);
    expect(screen.getByTestId("cme-total-hours")).toHaveTextContent("0");
  });

  it("keeps the total-hours shortfall actionable after every named requirement is met", () => {
    const set: CmeRequirementSet = {
      year: 2026,
      confirmedOn: "2026-01-01",
      confirmedSource: "Test fixture",
      totalHours: 50,
      requirements: [
        {
          id: "education-minimum",
          label: "Educational activities",
          source: "national",
          spec: { shape: "hours-in-category", category: "educational", minimumHours: 5 },
          completedOn: null,
        },
      ],
    };
    const entries: readonly CmeEntry[] = [
      {
        id: "education-five",
        date: "2026-06-01",
        title: "Education",
        allocations: [{ category: "educational", hours: 5 }],
        reflection: "",
        costCents: null,
        transcribed: false,
        routineId: null,
        documentId: null,
        buckets: [],
      },
    ];
    render(<CmeDashboard set={set} entries={entries} now={new Date("2026-09-19T02:00:00Z")} />);
    const next = screen.getByTestId("cme-next-action");
    expect(next).toHaveTextContent(/total cpd hours/i);
    expect(next).toHaveTextContent(/45 hours short/i);
    expect(next).toHaveAttribute("href", "/cme/new?year=2026");
    expect(next).not.toHaveTextContent(/every requirement is met/i);
  });

  it("points the next action at whichever requirement is furthest from being met, not the first unmet in list order", () => {
    render(
      <CmeDashboard
        set={FURTHEST_FROM_MET_SET}
        entries={FURTHEST_FROM_MET_ENTRIES}
        now={new Date("2026-09-19T02:00:00Z")}
      />,
    );
    const nextAction = screen.getByTestId("cme-next-action");
    // "Big gap requirement" (19 hours further from met) must be named, not
    // "Small gap requirement" — which lists first but is nearly met.
    expect(nextAction).toHaveTextContent(/Big gap requirement/);
    expect(nextAction).toHaveTextContent(/20 hours short/);
    expect(nextAction).not.toHaveTextContent(/Small gap requirement/);
  });
});
