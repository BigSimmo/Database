import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CmeRequirementSet } from "@/lib/cme/types";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/cme/load-cme-page-data", () => ({ loadCmePageData: mocks.load }));
vi.mock("@/components/cme/cme-annual-summary", () => ({
  CmeAnnualSummary: ({ set }: { set: CmeRequirementSet }) => <p data-testid="summary-stub">Summary {set.year}</p>,
}));

import CmeAnnualSummaryRoute from "@/app/(search-app)/cme/summary/page";

afterEach(() => {
  cleanup();
  mocks.load.mockReset();
});

function readyYear(year: number) {
  return {
    state: "ready",
    demoMode: false,
    year,
    set: { year, confirmedOn: "2026-01-05", confirmedSource: "Demo guide", totalHours: 50, requirements: [] },
    entries: [],
    routines: [],
    now: new Date("2026-09-26T01:41:00Z"),
    close: null,
    goals: [],
    drafts: [],
    missedSessions: [],
    draft: null,
    recordsFailed: false,
  };
}

async function open(query: { year?: string | string[] }) {
  render(await CmeAnnualSummaryRoute({ searchParams: Promise.resolve(query) }));
}

describe("/cme/summary", () => {
  it("opens the current CPD year when no year is given", async () => {
    mocks.load.mockResolvedValue(readyYear(2026));
    await open({});
    // No year: the loader picks today's Perth CPD year (or the demo year).
    expect(mocks.load).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("Summary 2026");
    expect(screen.queryByText("Choose a valid year from your CPD log.")).toBeNull();
  });

  it("treats an empty year the same as no year", async () => {
    mocks.load.mockResolvedValue(readyYear(2026));
    await open({ year: "" });
    expect(mocks.load).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId("summary-stub")).toBeInTheDocument();
  });

  it("opens exactly the year asked for", async () => {
    mocks.load.mockResolvedValue(readyYear(2025));
    await open({ year: "2025" });
    expect(mocks.load).toHaveBeenCalledWith(2025);
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("Summary 2025");
  });

  it("reads the first year when the address repeats it, instead of failing", async () => {
    mocks.load.mockResolvedValue(readyYear(2025));
    await open({ year: ["2025", "2026"] });
    expect(mocks.load).toHaveBeenCalledWith(2025);
  });

  it("never swaps a wrong year for another one", async () => {
    await open({ year: "twenty" });
    expect(mocks.load).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a valid year from your CPD log.")).toBeInTheDocument();
  });
});
