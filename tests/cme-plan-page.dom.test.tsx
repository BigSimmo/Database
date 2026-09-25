import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeEntryGoalPicker } from "@/components/cme/cme-entry-goal-picker";
import { CmePlanPage } from "@/components/cme/cme-plan-page";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/cme/plan" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockReset();
});

const SET = createAustralianRanzcpPreset(2026, "2026-01-05");
const GOAL = { id: "33333333-3333-4333-8333-333333333333", goal: "Document capacity well", sortOrder: 0 };

describe("development plan page", () => {
  it("saves the written goals in one request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ goals: [GOAL] }), { status: 200 }));
    render(<CmePlanPage set={SET} goals={[]} entries={[]} />);
    await user.type(screen.getByLabelText("Goal 1"), "Document capacity well");
    await user.click(screen.getByTestId("cme-plan-save"));
    await waitFor(() => expect(screen.getByTestId("cme-plan-message")).toHaveTextContent("Plan saved."));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ year: 2026, goals: [{ goal: "Document capacity well" }] });
    expect(refresh).toHaveBeenCalled();
  });

  it("is view-only in a closed year", () => {
    render(<CmePlanPage set={{ ...SET, closedAt: "2027-01-02T00:00:00Z" }} goals={[GOAL]} entries={[]} />);
    expect(screen.getByLabelText("Goal 1")).toHaveAttribute("readonly");
    expect(screen.queryByTestId("cme-plan-save")).toBeNull();
    expect(screen.getByTestId("cme-plan-tally")).toHaveTextContent("Document capacity well");
  });

  it("says when the plan is not yet marked written", () => {
    render(<CmePlanPage set={SET} goals={[]} entries={[]} />);
    expect(screen.getByTestId("cme-plan-status")).toHaveTextContent("Not yet marked as written.");
  });
});

describe("goal picker on an activity", () => {
  it("saves the chosen goal, and puts the old one back if saving fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "This CPD year is closed." }), { status: 409 }));
    render(<CmeEntryGoalPicker entryId="e1" goals={[GOAL]} initialGoalId={null} readOnly={false} />);
    const select = screen.getByLabelText(/Which goal/);
    await user.selectOptions(select, GOAL.id);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved."));
    expect(fetchMock).toHaveBeenCalledWith("/api/cme/entries/e1/goal", expect.objectContaining({ method: "PUT" }));
    await user.selectOptions(select, "");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("This CPD year is closed."));
    expect(select).toHaveValue(GOAL.id);
  });

  it("points to the plan when the year has no goals", () => {
    render(<CmeEntryGoalPicker entryId="e1" goals={[]} initialGoalId={null} readOnly={false} />);
    expect(screen.getByRole("link", { name: "Write your plan" })).toHaveAttribute("href", "/cme/plan");
  });
});
