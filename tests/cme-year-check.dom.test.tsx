import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { CmeLogPage } from "@/components/cme/cme-log-page";
import { CmeYearCheckPage } from "@/components/cme/cme-year-check-page";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";
import type { CmeEntry } from "@/lib/cme/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/cme",
}));

afterEach(cleanup);

const SET = createAustralianRanzcpPreset(2026, "2026-01-05");

function entry(overrides: Partial<CmeEntry> & Pick<CmeEntry, "id">): CmeEntry {
  return {
    date: "2026-03-01",
    title: `Activity ${overrides.id}`,
    allocations: [{ category: "educational", hours: 2 }],
    reflection: "Useful.",
    costCents: null,
    transcribed: true,
    routineId: null,
    documentId: null,
    buckets: [],
    evidenceCount: 1,
    ...overrides,
  };
}

const ENTRIES = [
  entry({ id: "a", title: "Grand round" }),
  entry({ id: "b", title: "Peer review group", evidenceCount: 0, transcribed: false, reflection: "" }),
];

describe("year check page", () => {
  it("says how many rows are ready and states each status in words", () => {
    render(<CmeYearCheckPage set={SET} entries={ENTRIES} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^\d+ of 10 ready$/);
    const evidence = screen.getByTestId("cme-check-row-evidence");
    expect(evidence).toHaveAttribute("data-ready", "false");
    expect(evidence).toHaveTextContent("Evidence kept for each activity — not ready");
    expect(within(evidence).getByRole("link", { name: /^Peer review group/, hidden: true })).toHaveAttribute(
      "href",
      "/cme/log/b",
    );
    expect(within(evidence).getByRole("link", { name: "Show them" })).toHaveAttribute(
      "href",
      "/cme/log?year=2026&fix=evidence",
    );
  });
});

describe("dashboard shortcuts", () => {
  it("links to the year check and the calendar, and reminds about last year's copies", () => {
    render(
      <CmeDashboard
        set={SET}
        entries={ENTRIES}
        now={new Date("2026-02-10T02:00:00Z")}
        reportingReminder={{ year: 2025, notCopied: 3, closesOn: "2026-03-01" }}
      />,
    );
    expect(screen.getByTestId("cme-year-check-link")).toHaveAttribute("href", "/cme/check?year=2026");
    expect(screen.getByTestId("cme-calendar-link")).toHaveTextContent("18 Dec 2026: You can close your 2026 CPD year");
    const reminder = screen.getByTestId("cme-reporting-reminder");
    expect(reminder).toHaveAttribute("href", "/cme/log?year=2025&copy=todo");
    expect(reminder).toHaveTextContent("3 activities from 2025 not yet copied to MyCPD.");
    expect(reminder).toHaveTextContent("closes on 1 March");
  });
});

describe("log attention filters", () => {
  it("opens already narrowed to activities not yet copied", () => {
    render(<CmeLogPage set={SET} entries={ENTRIES} initialAttention="copy" />);
    expect(screen.getByTestId("cme-log-attention-copy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cme-log-copy-help")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-log-row-a")).toBeNull();
    expect(screen.getByTestId("cme-log-row-b")).toBeInTheDocument();
  });
});
