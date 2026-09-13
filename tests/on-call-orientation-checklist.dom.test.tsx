/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OnCallOrientationSection } from "@/components/on-call/on-call-orientation-section";
import { onCallChecklistStorageKey } from "@/lib/on-call/checklist-storage-keys";
import { type OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const NOW = new Date("2026-09-13T00:00:00.000Z");

const FIRST_FIFTEEN = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "first-fifteen-minutes",
  section: "orientation",
  title: "Your first fifteen minutes",
  subtitle: null,
  body: null,
  details: {
    pinnedSummaryIsOwnerNote: true,
    checklist: [
      { text: "Collect the on-call phone", note: "Nurses' station, Ward 4B" },
      { text: "Introduce yourself to the nurse in charge" },
    ],
  },
  linkedDocumentIds: [],
  tags: [],
  isPersonal: false,
  includeOnCard: false,
  sortOrder: 0,
  lastVerifiedAt: NOW.toISOString(),
} as unknown as OnCallEntry;

describe("Orientation checklists", () => {
  it("renders the drawn steps with their notes", () => {
    render(<OnCallOrientationSection entries={[FIRST_FIFTEEN]} now={NOW} />);
    expect(screen.getByTestId("on-call-orientation-checklist-first-fifteen-minutes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collect the on-call phone/ })).toBeInTheDocument();
    expect(screen.getByText("Nurses' station, Ward 4B")).toBeInTheDocument();
  });

  it("ticks and unticks a step, and says so to assistive technology", () => {
    render(<OnCallOrientationSection entries={[FIRST_FIFTEEN]} now={NOW} />);
    const step = screen.getByRole("button", { name: /Collect the on-call phone/ });
    expect(step).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(step);
    expect(screen.getByRole("button", { name: /Collect the on-call phone/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Collect the on-call phone/ }));
    expect(screen.getByRole("button", { name: /Collect the on-call phone/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("ticks one step without ticking the other", () => {
    render(<OnCallOrientationSection entries={[FIRST_FIFTEEN]} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: /Collect the on-call phone/ }));
    expect(screen.getByRole("button", { name: /Introduce yourself/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the tick on this device only", () => {
    // The whole privacy argument for this store: a tick is a statement about a
    // person, and nothing here reaches a row, a column or the network.
    render(<OnCallOrientationSection entries={[FIRST_FIFTEEN]} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: /Collect the on-call phone/ }));
    const stored = window.localStorage.getItem(onCallChecklistStorageKey) ?? "";
    expect(stored).toContain(FIRST_FIFTEEN.id);
    // The item's words are never written down; only a derived key is.
    expect(stored.toLowerCase()).toContain("collect the on-call phone");
    expect(stored).not.toContain("Nurses' station");
  });

  it("renders no list for an entry that carries no checklist", () => {
    const plain = { ...FIRST_FIFTEEN, slug: "manual", details: { pinnedSummaryIsOwnerNote: true } } as OnCallEntry;
    render(<OnCallOrientationSection entries={[plain]} now={NOW} />);
    expect(screen.queryByTestId("on-call-orientation-checklist-manual")).not.toBeInTheDocument();
  });
});
