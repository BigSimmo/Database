import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { CmeEntryPage } from "@/components/cme/cme-entry-page";
import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";
import { CmePaceChart, hoursByCategory } from "@/components/cme/cme-progress-visuals";
import { CmeQuickLog } from "@/components/cme/cme-quick-log";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

const navigation = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => "/cme" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigation.push.mockReset();
  navigation.refresh.mockReset();
  window.sessionStorage.clear();
});

const SET: CmeRequirementSet = {
  year: 2026,
  confirmedOn: "2026-01-02",
  confirmedSource: "Test fixture",
  totalHours: 50,
  requirements: [
    {
      id: "req-educational",
      label: "Educational activities",
      source: "national",
      spec: { shape: "hours-in-category", category: "educational", minimumHours: 12.5 },
      completedOn: null,
    },
    {
      id: "req-measuring",
      label: "Measuring outcomes",
      source: "national",
      spec: { shape: "hours-in-category", category: "measuring", minimumHours: 5 },
      completedOn: null,
    },
  ],
};

function entry(overrides: Partial<CmeEntry> & Pick<CmeEntry, "id" | "date">): CmeEntry {
  return {
    title: "Activity",
    allocations: [{ category: "educational", hours: 1 }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
    ...overrides,
  };
}

const ENTRIES: readonly CmeEntry[] = [
  entry({ id: "e1", date: "2026-02-10", allocations: [{ category: "educational", hours: 14 }] }),
  entry({ id: "e2", date: "2026-05-04", allocations: [{ category: "reviewing", hours: 6 }] }),
  entry({
    id: "e3",
    date: "2026-07-20",
    allocations: [
      { category: "reviewing", hours: 1 },
      { category: "measuring", hours: 1.5 },
    ],
  }),
  entry({
    id: "archived",
    date: "2026-03-01",
    archivedAt: "2026-03-02T00:00:00Z",
    allocations: [{ category: "measuring", hours: 20 }],
  }),
];

describe("the dashboard's progress picture", () => {
  it("says each category's hours in words beside the coloured bar, leaving archived entries out", () => {
    render(<CmeDashboard set={SET} entries={ENTRIES} now={new Date("2026-09-01T02:00:00Z")} />);
    const legend = within(screen.getByTestId("cme-category-bar")).getByRole("list", { name: "Hours by category" });
    expect(legend).toHaveTextContent("Educational14 h");
    expect(legend).toHaveTextContent("Reviewing7 h");
    expect(legend).toHaveTextContent("Outcomes1.5 h");
    expect(hoursByCategory(ENTRIES)).toEqual({ educational: 14, reviewing: 7, measuring: 1.5 });
  });

  it("gives an hours requirement a small bar, and a tick once it is met", () => {
    render(<CmeDashboard set={SET} entries={ENTRIES} now={new Date("2026-09-01T02:00:00Z")} />);
    const items = within(screen.getByTestId("cme-requirements")).getAllByRole("listitem");
    const educational = items.find((item) => item.textContent?.includes("Educational activities"))!;
    const measuring = items.find((item) => item.textContent?.includes("Measuring outcomes"))!;
    expect(educational).toHaveAttribute("data-met", "true");
    expect(measuring).toHaveAttribute("data-met", "false");
    expect(within(measuring).getByTestId("cme-requirement-meter")).toBeInTheDocument();
  });

  it("draws the pace chart as one described image, not a pile of points", () => {
    render(<CmeDashboard set={SET} entries={ENTRIES} now={new Date("2026-09-01T02:00:00Z")} />);
    const chart = within(screen.getByTestId("cme-pace-chart")).getByRole("img");
    expect(chart).toHaveAccessibleName(/22\.5 hours logged so far/);
    expect(chart).toHaveAccessibleName(/behind that pace/);
  });
});

describe("the pace chart", () => {
  it("says ahead when logged hours are above an even pace", () => {
    render(
      <CmePaceChart
        entries={[entry({ id: "big", date: "2026-01-05", allocations: [{ category: "educational", hours: 40 }] })]}
        year={2026}
        targetHours={50}
        todayIndex={60}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/ahead of that pace/);
  });
});

describe("quick log", () => {
  it("opens the entry form in a panel, saves with one request, and says it landed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ entry: { id: "new" } }), { status: 201 }));
    render(<CmeQuickLog set={SET} />);

    await user.click(screen.getByTestId("cme-quick-log-button"));
    const sheet = await screen.findByTestId("cme-quick-log-sheet");
    await user.type(within(sheet).getByLabelText(/what was it/i), "Grand round");
    await user.click(within(sheet).getByRole("button", { name: "Educational" }));
    await user.click(within(sheet).getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(screen.getByTestId("cme-quick-log-saved")).toHaveTextContent("Saved to your log."));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ title: "Grand round", allocations: [{ category: "educational", hours: 1 }] });
    expect(typeof body.requestId).toBe("string");
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cme-quick-log-sheet")).toBeNull();
  });

  it("keeps the panel open with the reason when the save fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "The record could not be saved yet." }), { status: 503 }),
    );
    render(<CmeQuickLog set={SET} />);
    await user.click(screen.getByTestId("cme-quick-log-button"));
    const sheet = await screen.findByTestId("cme-quick-log-sheet");
    await user.type(within(sheet).getByLabelText(/what was it/i), "Grand round");
    await user.click(within(sheet).getByRole("button", { name: "Educational" }));
    await user.click(within(sheet).getByRole("button", { name: /save entry/i }));
    expect(await within(sheet).findByText("The record could not be saved yet.")).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/what was it/i)).toHaveValue("Grand round");
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});

describe("log it again", () => {
  const original = entry({
    id: "orig",
    date: "2026-03-10",
    title: "Monthly peer review",
    allocations: [{ category: "reviewing", hours: 1.5 }],
    reflection: "Last month's own reflection",
    costCents: 2500,
    buckets: [],
  });

  it("links a saved entry to a new entry copied from it", () => {
    render(<CmeEntryPage entryId="orig" entries={[original]} set={SET} />);
    expect(screen.getByTestId("cme-entry-log-again")).toHaveAttribute("href", "/cme/new?year=2026&repeat=orig");
  });

  it("copies the title and hours but not the reflection or cost", () => {
    render(<CmeNewEntryRoute repeatOf={original} set={SET} />);
    expect(screen.getByTestId("cme-entry-repeat-notice")).toBeInTheDocument();
    expect(screen.getByLabelText(/what was it/i)).toHaveValue("Monthly peer review");
    expect(screen.getByLabelText("Hours for this activity")).toHaveValue("1.5");
    expect(screen.getByRole("button", { name: "Reviewing" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Reflection")).toHaveValue("");
    expect(screen.getByLabelText(/what it cost/i)).toHaveValue("");
  });
});

describe("annual summary PDF", () => {
  it("names the file after the year while the print screen is open, then puts the title back", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.title).toBe("CPD annual summary 2026");
      window.dispatchEvent(new Event("afterprint"));
    });
    document.title = "Summary | CME";
    render(<CmeAnnualSummary set={SET} entries={ENTRIES} />);
    screen.getByTestId("cme-summary-save-pdf").click();
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("Summary | CME");
  });
});
