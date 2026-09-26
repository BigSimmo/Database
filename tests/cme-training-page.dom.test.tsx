import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  usePathname: () => "/cme/training",
}));
vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({ AccountSetupDialog: () => null }));
vi.mock("@/lib/cme/training-page-data", () => ({ loadCmeTrainingPageData: mocks.load }));

import CmeTrainingRoute from "@/app/(search-app)/cme/training/page";
import { CmeTrainingPage } from "@/components/cme/cme-training-page";
import type { TrainingMilestone, TrainingPeriod } from "@/lib/cme/training-timeline";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.load.mockReset();
});

/** 28 September 2026, 10:00 Perth. */
const NOW_ISO = "2026-09-28T02:00:00.000Z";

const PERIODS: TrainingPeriod[] = [
  { id: "s2", kind: "stage", label: "Stage 2", startsOn: "2026-02-02", endsOn: null, fte: 1 },
  { id: "r1", kind: "rotation", label: "Adult inpatient", startsOn: "2026-02-02", endsOn: "2026-07-31", fte: 1 },
  {
    id: "r2",
    kind: "rotation",
    label: "Consultation liaison",
    startsOn: "2026-08-03",
    endsOn: "2027-01-29",
    fte: 0.5,
  },
];

const OVERDUE_EXAM: TrainingMilestone = {
  id: "m1",
  label: "Written examination",
  dueKind: "date",
  dueFteMonths: null,
  dueOn: "2026-09-01",
  completedOn: null,
};

describe("CME training page", () => {
  it("explains that nothing is preloaded when the record is empty", () => {
    render(<CmeTrainingPage nowIso={NOW_ISO} initialPeriods={[]} initialMilestones={[]} demoMode={false} />);
    expect(screen.getByTestId("cme-training")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Training" })).toBeInTheDocument();
    expect(
      screen.getByText(/It is not the college's record, and nothing here changes your CPD targets\./),
    ).toBeTruthy();
    const empty = screen.getByTestId("cme-training-empty");
    expect(empty).toHaveTextContent("Nothing is preloaded here.");
    expect(empty).toHaveTextContent("your college's current requirements");
    expect(screen.queryByTestId("cme-training-position")).toBeNull();
  });

  it("shows where the trainee is, the training clock, and an overdue milestone", () => {
    render(
      <CmeTrainingPage nowIso={NOW_ISO} initialPeriods={PERIODS} initialMilestones={[OVERDUE_EXAM]} demoMode={false} />,
    );
    expect(screen.queryByTestId("cme-training-empty")).toBeNull();
    expect(screen.getByTestId("cme-training-stage")).toHaveTextContent("Stage 2");
    expect(screen.getByTestId("cme-training-rotation")).toHaveTextContent(
      "Consultation liaison, rotation 2 of 2, at 0.5 FTE",
    );
    // 180 full-time days + 57 half-time days = 208.5 FTE days = 6.85 FTE months.
    expect(screen.getByTestId("cme-training-clock")).toHaveTextContent("6.9 FTE months");
    expect(screen.getByText(/Half-time counts half, and breaks pause the clock\./)).toBeTruthy();
    expect(screen.getByTestId("cme-training-next")).toHaveTextContent("Written examination");
    expect(screen.getByTestId("cme-training-next-detail")).toHaveTextContent(
      "Overdue: it was due on 1 September 2026.",
    );
  });

  it("says the clock is paused on a break", () => {
    render(
      <CmeTrainingPage
        nowIso={NOW_ISO}
        initialPeriods={[
          { id: "b1", kind: "break", label: "Parental leave", startsOn: "2026-09-01", endsOn: null, fte: 0 },
        ]}
        initialMilestones={[]}
        demoMode={false}
      />,
    );
    expect(screen.getByTestId("cme-training-on-break")).toHaveTextContent(
      "On a break: Parental leave. Your training clock is paused.",
    );
    expect(screen.getByTestId("cme-training-clock")).toHaveTextContent("0 FTE months");
    expect(screen.getByTestId("cme-training-next-detail")).toHaveTextContent("No milestones yet.");
  });

  it("adds a rotation through the API and shows it", async () => {
    const user = userEvent.setup();
    const saved: TrainingPeriod = {
      id: "55555555-5555-4555-8555-555555555555",
      kind: "rotation",
      label: "Child and adolescent",
      startsOn: "2027-02-01",
      endsOn: null,
      fte: 0.8,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ period: saved }), { status: 201 }));
    render(<CmeTrainingPage nowIso={NOW_ISO} initialPeriods={PERIODS} initialMilestones={[]} demoMode={false} />);

    await user.click(screen.getByRole("button", { name: "Add stage, rotation or break" }));
    await user.type(screen.getByLabelText(/^Label/), "Child and adolescent");
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "2027-02-01" } });
    const fte = screen.getByLabelText(/^FTE/);
    await user.clear(fte);
    await user.type(fte, "0.8");
    await user.click(screen.getByRole("button", { name: "Save period" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cme/training");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      type: "period",
      kind: "rotation",
      label: "Child and adolescent",
      startsOn: "2027-02-01",
      endsOn: null,
      fte: 0.8,
    });
    await waitFor(() => expect(screen.getByTestId("cme-training-periods")).toHaveTextContent("Child and adolescent"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows an overlap inline and does not call the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<CmeTrainingPage nowIso={NOW_ISO} initialPeriods={PERIODS} initialMilestones={[]} demoMode={false} />);

    await user.click(screen.getByRole("button", { name: "Add stage, rotation or break" }));
    await user.type(screen.getByLabelText(/^Label/), "Old age");
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: "2026-09-01" } });
    await user.click(screen.getByRole("button", { name: "Save period" }));

    expect(await screen.findByTestId("cme-training-period-problems")).toHaveTextContent(/overlap/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CME training route", () => {
  it("shows the sign-in notice when signed out", async () => {
    mocks.load.mockResolvedValue({
      state: "signed-out",
      demoMode: false,
      periods: [],
      milestones: [],
      now: new Date(NOW_ISO),
    });
    render(await CmeTrainingRoute());
    expect(screen.getByTestId("cme-signed-out")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-training")).toBeNull();
  });

  it("renders the page when ready", async () => {
    mocks.load.mockResolvedValue({
      state: "ready",
      demoMode: true,
      periods: [],
      milestones: [],
      now: new Date(NOW_ISO),
    });
    render(await CmeTrainingRoute());
    expect(screen.getByTestId("cme-training-empty")).toBeInTheDocument();
  });
});
