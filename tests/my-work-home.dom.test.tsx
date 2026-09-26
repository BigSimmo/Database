/** @vitest-environment jsdom */

// My Work gathers the paperwork pages that used to sit on the On Call home.
// Every page keeps its own address, so each card must point at that page's
// existing route. The What's next list reports recorded dates and checks due,
// and never reads an empty or unloaded account as "nothing due".

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";

const state = {
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  loadError: null,
  retry: vi.fn(),
  cachedAt: null,
  signedOut: false,
  demoMode: false,
};

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => state,
}));

import { MyWorkHome, selectComplianceDueSoon } from "@/components/my-work/my-work-home";

function entry(overrides: Partial<OnCallEntry> & Pick<OnCallEntry, "id" | "section">): OnCallEntry {
  return {
    slug: overrides.id,
    title: `Entry ${overrides.id}`,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

// Midday Perth time, so the local day is unambiguous.
const NOW = new Date("2026-09-26T04:00:00Z");
const RECENTLY_CHECKED = "2026-06-01T00:00:00Z";

const registration = entry({
  id: "registration",
  section: "logistics",
  title: "AHPRA registration",
  details: { kind: "compliance", expiresOn: "2026-10-10" },
  lastVerifiedAt: RECENTLY_CHECKED,
});
const passed = entry({
  id: "indemnity",
  section: "logistics",
  title: "Indemnity insurance",
  details: { kind: "compliance", expiresOn: "2026-09-01" },
  lastVerifiedAt: RECENTLY_CHECKED,
});
const later = entry({
  id: "bls",
  section: "logistics",
  title: "Basic life support",
  details: { kind: "compliance", expiresOn: "2027-03-12" },
  lastVerifiedAt: RECENTLY_CHECKED,
});
const neverChecked = entry({ id: "switchboard", section: "contacts", title: "Switchboard" });

beforeEach(() => {
  state.entries = [];
  state.loading = false;
  state.isOffline = false;
  state.signedOut = false;
});
afterEach(cleanup);

describe("MyWorkHome", () => {
  it("links every gathered page to its existing address", () => {
    render(<MyWorkHome now={NOW} />);

    expect(screen.getByRole("heading", { level: 1, name: "My Work" })).toBeTruthy();
    const pages = screen.getByTestId("my-work-pages");
    const hrefs = within(pages)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/on-call/logistics",
      "/on-call/compliance",
      "/on-call/check",
      "/on-call/shifts",
      "/on-call/calendar",
      "/on-call/orientation",
      "/?settings=open",
    ]);
  });

  it("lists recorded dates due soon or passed, soonest first, then the checks due", () => {
    state.entries = [later, registration, passed, neverChecked];
    render(<MyWorkHome now={NOW} />);

    const list = screen.getByRole("list", { name: "What's next" });
    const rows = within(list).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "my-work-next-compliance-indemnity",
      "my-work-next-compliance-registration",
      "my-work-next-check",
    ]);
    expect(rows[0]).toHaveTextContent("Recorded as expiring 1 Sep 2026 — that date has passed");
    expect(rows[0]).toHaveAttribute("href", "/on-call/compliance");
    expect(rows[1]).toHaveTextContent("Recorded as expiring 10 Oct 2026");
    expect(rows[1]).not.toHaveTextContent("that date has passed");
    expect(rows[2]).toHaveTextContent("1 entry due a check");
    expect(rows[2]).toHaveAttribute("href", "/on-call/check");
  });

  it("does not read an unloaded or signed-out account as nothing due", () => {
    state.loading = true;
    const { unmount } = render(<MyWorkHome now={NOW} />);
    expect(screen.getByTestId("my-work-next-empty")).toHaveTextContent("Loading your entries.");
    unmount();

    state.loading = false;
    state.signedOut = true;
    render(<MyWorkHome now={NOW} />);
    expect(screen.getByTestId("my-work-next-empty")).toHaveTextContent("Sign in to see what is due.");
  });

  it("says nothing is recorded as due only when entries were loaded", () => {
    state.entries = [later];
    render(<MyWorkHome now={NOW} />);
    expect(screen.getByTestId("my-work-next-empty")).toHaveTextContent("Nothing recorded as due in the next 30 days.");
  });
});

describe("selectComplianceDueSoon", () => {
  it("leaves out admin rows, rows with no recorded date, and dates beyond thirty days", () => {
    const admin = entry({
      id: "leave",
      section: "logistics",
      title: "Leave form",
      details: { expiresOn: "2026-10-01" },
    });
    const undated = entry({ id: "cpr", section: "logistics", title: "CPR", details: { kind: "compliance" } });
    expect(selectComplianceDueSoon([admin, undated, later, registration], NOW).map((row) => row.id)).toEqual([
      "registration",
    ]);
  });
});
