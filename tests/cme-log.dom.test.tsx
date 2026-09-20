/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeEntryPage } from "@/components/cme/cme-entry-page";
import { CmeLogPage } from "@/components/cme/cme-log-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

afterEach(cleanup);

const CLINICAL_STATUS_CLASS = /\b(?:bg|text|border|ring)-(?:red|amber|green|orange|rose|emerald|yellow)-/;
const TAP_TARGET_CLASS = /\bmin-h-(?:12|tap)\b/;

/**
 * `DEMO_CME_ENTRIES` (Task 3) gives every entry a single allocation and
 * `routineId: null` throughout, so neither the multi-allocation "college
 * pill" behaviour nor the "Routine" pill has a real example to render
 * against. This fixture set exercises both shapes directly, plus a second
 * year, an entry with no evidence and no reflection, and an entry with a
 * cost — everything the brief's screen description calls for.
 */
const fixtureEntries: CmeEntry[] = [
  {
    id: "fx-1",
    date: "2026-09-16",
    title: "Journal club — treatment-resistant depression",
    allocations: [{ category: "educational", hours: 1 }],
    reflection: "Compared reading with colleagues afterwards.",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
  },
  {
    id: "fx-2",
    date: "2026-09-11",
    title: "Peer review group — September",
    allocations: [
      { category: "reviewing", hours: 1 },
      { category: "measuring", hours: 0.5 },
    ],
    reflection: "Brought a case for discussion.",
    costCents: 5_000,
    transcribed: true,
    routineId: "routine-1",
    documentId: "00000000-0000-4000-8000-000000000001",
    buckets: ["Peer review — September"],
  },
  {
    id: "fx-3",
    date: "2026-08-22",
    title: "RANZCP WA Branch training day",
    allocations: [{ category: "educational", hours: 5 }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
  },
  {
    id: "fx-4",
    date: "2025-11-03",
    title: "Audit — discharge planning review",
    allocations: [{ category: "measuring", hours: 1 }],
    reflection: "Reviewed a sample of discharge summaries with the team.",
    costCents: null,
    transcribed: true,
    routineId: null,
    documentId: null,
    buckets: [],
  },
];

const fixtureSet: CmeRequirementSet = { ...DEMO_CME_YEAR, year: 2026 };

function noClinicalStatusColour(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[class]")].filter((node) =>
    CLINICAL_STATUS_CLASS.test(node.className),
  );
}

describe("Log", () => {
  it("shows a year tab per year the log holds data for", () => {
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    const tabs = screen.getByTestId("cme-log-year-tabs");
    expect(within(tabs).getByRole("tab", { name: "2026" })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: "2025" })).toBeInTheDocument();
  });

  it("groups entries by month, most recent month first", () => {
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
    const septemberIndex = headings.findIndex((text) => text.includes("September"));
    const augustIndex = headings.findIndex((text) => text.includes("August"));
    expect(septemberIndex).toBeGreaterThanOrEqual(0);
    expect(augustIndex).toBeGreaterThan(septemberIndex);
  });

  it("searches across titles and reflections, not just titles", async () => {
    const user = userEvent.setup();
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    await user.type(screen.getByLabelText(/search your log/i), "discussion");
    expect(screen.getByText("Peer review group — September")).toBeInTheDocument();
    expect(screen.queryByText("Journal club — treatment-resistant depression")).toBeNull();
  });

  it("filters by category with the chip row, without hiding the month grouping's own job", async () => {
    const user = userEvent.setup();
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    await user.click(screen.getByRole("radio", { name: "Measuring outcomes" }));
    expect(screen.getByText("Peer review group — September")).toBeInTheDocument();
    expect(screen.queryByText("Journal club — treatment-resistant depression")).toBeNull();
    expect(screen.queryByText("RANZCP WA Branch training day")).toBeNull();
  });

  it("marks only the entry that came from a routine with a Routine pill", () => {
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    const routineRow = screen.getByTestId("cme-log-row-fx-2").closest("li");
    const plainRow = screen.getByTestId("cme-log-row-fx-1").closest("li");
    expect(routineRow).not.toBeNull();
    expect(plainRow).not.toBeNull();
    expect(within(routineRow as HTMLElement).getByText("Routine")).toBeInTheDocument();
    expect(within(plainRow as HTMLElement).queryByText("Routine")).toBeNull();
  });

  it("links every row to its own entry screen", () => {
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-log-row-fx-1")).toHaveAttribute("href", "/cme/log/fx-1");
    expect(screen.getByTestId("cme-log-row-fx-2")).toHaveAttribute("href", "/cme/log/fx-2");
  });

  it("keeps the board's closing call to action — a standing way to add a new entry", () => {
    render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-log-new-entry")).toHaveAttribute("href", "/cme/new");
  });

  it("shows a guided empty state rather than a blank list when the year has nothing logged", () => {
    render(<CmeLogPage entries={[]} set={fixtureSet} />);
    expect(screen.getByTestId("cme-log-empty")).toBeInTheDocument();
  });

  it("paints no clinical status colour anywhere on the page", () => {
    const { container } = render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    expect(noClinicalStatusColour(container).map((node) => node.className)).toEqual([]);
  });

  it("gives every interactive element a 48px tap target class", () => {
    const { container } = render(<CmeLogPage entries={fixtureEntries} set={fixtureSet} />);
    const interactive = [
      ...container.querySelectorAll<HTMLElement>("button, a[href], [role='button'], [role='tab'], [role='radio']"),
    ];
    expect(interactive.length).toBeGreaterThan(0);
    const short = interactive.filter((node) => !TAP_TARGET_CLASS.test(node.className));
    expect(short.map((node) => node.textContent?.trim() || node.getAttribute("aria-label"))).toEqual([]);
  });
});

type ClipboardStub = { writeText: ReturnType<typeof vi.fn> };

function stubClipboard(writeText: ReturnType<typeof vi.fn>): ClipboardStub {
  const clipboard = { writeText };
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true, writable: true });
  return clipboard;
}

function removeClipboard() {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
}

describe("One entry", () => {
  afterEach(removeClipboard);

  it("shows every allocation with its category pill", () => {
    render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);
    const section = screen.getByTestId("cme-entry-allocations");
    expect(within(section).getByText("Reviewing performance")).toBeInTheDocument();
    expect(within(section).getByText("Measuring outcomes")).toBeInTheDocument();
  });

  it("shows the reflection in the owner's own words", () => {
    render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByText("Brought a case for discussion.")).toBeInTheDocument();
  });

  it("shows a guided empty state rather than nothing when there is no reflection yet", () => {
    render(<CmeEntryPage entryId="fx-3" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-reflection-empty")).toBeInTheDocument();
  });

  it("shows the evidence row, attached or not", () => {
    render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-evidence")).toHaveTextContent(/attached/i);

    cleanup();
    render(<CmeEntryPage entryId="fx-1" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-evidence-empty")).toBeInTheDocument();
  });

  it("shows the cost row, or says plainly that nothing was recorded", () => {
    render(<CmeEntryPage entryId="fx-1" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-cost")).toHaveTextContent(/not recorded/i);

    cleanup();
    render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-cost")).toHaveTextContent("$50.00");
  });

  it("copies the portal text and marks the entry transcribed, never the other way around", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const onCopied = vi.fn();
    render(<CmeEntryPage entryId="fx-1" entries={fixtureEntries} set={fixtureSet} onCopied={onCopied} />);

    expect(screen.getByTestId("cme-entry-transcribed-status")).toHaveTextContent(/not yet copied/i);
    await user.click(screen.getByRole("button", { name: /copy for your cpd home/i }));

    await waitFor(() =>
      expect(screen.getByTestId("cme-entry-transcribed-status")).toHaveTextContent(/^copied to your cpd home\.$/i),
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Date: 2026-09-16"));
    expect(onCopied).toHaveBeenCalledWith("fx-1");
  });

  it("never puts the entry's cost on the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);

    await user.click(screen.getByRole("button", { name: /copy for your cpd home/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copiedText = writeText.mock.calls[0]?.[0] as string;
    expect(copiedText).not.toMatch(/50\.00|cost/i);
  });

  it("says plainly when an entry cannot be found, rather than crashing", () => {
    render(<CmeEntryPage entryId="does-not-exist" entries={fixtureEntries} set={fixtureSet} />);
    expect(screen.getByTestId("cme-entry-not-found")).toBeInTheDocument();
  });

  it("paints no clinical status colour anywhere on the page", () => {
    const { container } = render(<CmeEntryPage entryId="fx-2" entries={fixtureEntries} set={fixtureSet} />);
    expect(noClinicalStatusColour(container).map((node) => node.className)).toEqual([]);
  });

  it("gives every interactive element a 48px tap target class", () => {
    const { container } = render(<CmeEntryPage entryId="fx-1" entries={fixtureEntries} set={fixtureSet} />);
    const interactive = [...container.querySelectorAll<HTMLElement>("button, a[href], [role='button']")];
    expect(interactive.length).toBeGreaterThan(0);
    const short = interactive.filter((node) => !TAP_TARGET_CLASS.test(node.className));
    expect(short.map((node) => node.textContent?.trim() || node.getAttribute("aria-label"))).toEqual([]);
  });
});
