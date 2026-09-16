/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type OnCallEntry } from "@/lib/on-call/entry-model";

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: true, isSaved: () => false, setFavourite: vi.fn(async () => true) }),
}));

// The page menu drags in the whole navigation chrome, which is covered by its
// own tests. This file is about what the home lays out, and in what order.
vi.mock("@/components/on-call/on-call-page-menu", () => ({ OnCallPageMenu: () => null }));

const storeState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  signedOut: false,
  cachedAt: null as string | null,
}));

const recentState = vi.hoisted(() => ({ items: [] as { id: string; title: string; at: string }[] }));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => storeState,
  cacheOnCallEntries: vi.fn(),
}));

vi.mock("@/lib/on-call/recent-storage", () => ({
  useOnCallRecent: () => recentState.items,
  recordOnCallRecent: vi.fn(),
  clearOnCallRecent: vi.fn(),
}));

const { OnCallHome } = await import("@/components/on-call/on-call-home");

const VERIFIED = new Date().toISOString();

function dualLineContact(): OnCallEntry {
  return {
    ...contact("bed-manager", "Bed manager", ["call-first"], "9224 1111"),
    details: { role: "Bed manager", phone: "9224 1111", afterHoursPhone: "9224 2222" },
  } as unknown as OnCallEntry;
}

function recurringSession(): OnCallEntry {
  return {
    id: "journal-club",
    slug: "journal-club",
    section: "education",
    title: "Journal club",
    subtitle: null,
    body: null,
    // Anchored months in the past on purpose: before recurrence, this block went
    // blank the afternoon the stored date passed and stayed blank until someone
    // edited the entry by hand.
    details: {
      nextOccurrence: "Thursday 1pm",
      nextOccurrenceDate: "2026-01-08",
      recurrenceRule: { frequency: "weekly" },
      presenter: "Registrar",
      topics: [],
    },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED,
  } as unknown as OnCallEntry;
}

function staleContact(slug: string, title: string): OnCallEntry {
  return { ...contact(slug, title, [], "9224 9999"), lastVerifiedAt: null } as unknown as OnCallEntry;
}

function contact(slug: string, title: string, tags: string[], phone: string): OnCallEntry {
  return {
    id: slug,
    slug,
    section: "contacts",
    title,
    subtitle: null,
    body: null,
    details: { role: title, phone },
    linkedDocumentIds: [],
    tags,
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED,
  } as unknown as OnCallEntry;
}

beforeEach(() => {
  storeState.entries = [];
  storeState.loading = false;
  recentState.items = [];
});

afterEach(cleanup);

describe("On Call home layout", () => {
  it("puts Recent above the ward strip, because last shift predicts this shift", () => {
    const ward = contact("ward-4b", "Ward 4B", ["ward"], "9224 1000");
    const rung = contact("switch", "Switchboard", [], "9224 2000");
    storeState.entries = [ward, rung];
    recentState.items = [{ id: "switch", title: "Switchboard", at: new Date().toISOString() }];

    render(<OnCallHome />);

    const recent = screen.getByTestId("on-call-home-recent");
    const wards = screen.getByTestId("on-call-home-wards");
    // Node.DOCUMENT_POSITION_FOLLOWING === 4: `wards` comes after `recent`.
    expect(recent.compareDocumentPosition(wards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives an empty hub a first run block rather than a grid of zeroes", () => {
    storeState.entries = [];

    render(<OnCallHome />);

    expect(screen.getByTestId("on-call-home-first-run")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Contacts/i })).toBeInTheDocument();
  });

  it("does not show the first run block while the hub is still loading", () => {
    storeState.entries = [];
    storeState.loading = true;

    render(<OnCallHome />);

    expect(screen.queryByTestId("on-call-home-first-run")).toBeNull();
  });

  it("names the remaining home tags once there are entries but nothing is tagged", () => {
    storeState.entries = [contact("switch", "Switchboard", [], "9224 2000")];

    render(<OnCallHome />);

    const empty = screen.getByTestId("on-call-home-call-first-empty");
    expect(empty).toHaveTextContent(/switchboard/i);
    expect(empty).toHaveTextContent(/ward/i);
    expect(empty).toHaveTextContent(/pinned/i);
  });

  it("keeps the tag hint out of the way once the home is set up", () => {
    storeState.entries = [contact("reg", "After-hours registrar", ["call-first"], "9224 3000")];

    render(<OnCallHome />);

    expect(screen.queryByTestId("on-call-home-call-first-empty")).toBeNull();
  });

  it("offers the printable card from the home, not only from inside Contacts", () => {
    storeState.entries = [contact("reg", "After-hours registrar", ["call-first"], "9224 3000")];

    render(<OnCallHome />);

    expect(screen.getByRole("link", { name: /Printable card/i })).toHaveAttribute("href", "/on-call/card");
  });

  it("carries a search box, which stays out of the way until it is used", () => {
    storeState.entries = [contact("reg", "After-hours registrar", ["call-first"], "9224 3000")];

    render(<OnCallHome />);

    expect(screen.getByTestId("on-call-search")).toBeInTheDocument();
    // Nothing typed, so no results block pushes the shift modules down.
    expect(screen.queryByTestId("on-call-search-results")).toBeNull();
  });

  it("offers the daytime number during the working day", () => {
    storeState.entries = [dualLineContact()];

    // A Wednesday at 09:00 local.
    render(<OnCallHome now={new Date(2026, 8, 16, 9, 0, 0)} />);

    expect(screen.getByTestId("on-call-home-call-bed-manager")).toHaveTextContent("9224 1111");
  });

  it("offers the after-hours number at 22:00, which is when this page is read", () => {
    storeState.entries = [dualLineContact()];

    // The same Wednesday at 22:00 local.
    render(<OnCallHome now={new Date(2026, 8, 16, 22, 0, 0)} />);

    const card = screen.getByTestId("on-call-home-call-bed-manager");
    expect(card).toHaveTextContent("9224 2222");
    // Named for what it is, so the screen never shows a number under the wrong
    // label.
    expect(card).toHaveTextContent(/after hours/i);
  });

  it("rolls a weekly session forward rather than going blank once its date passes", () => {
    storeState.entries = [recurringSession()];

    // Months after the stored anchor of 8 January.
    render(<OnCallHome now={new Date(2026, 8, 16, 9, 0, 0)} />);

    const strip = screen.getByTestId("on-call-home-teaching-strip");
    expect(strip).toHaveTextContent("Journal club");
    // A date, never a countdown: it has to be checkable against a roster.
    expect(strip).toHaveTextContent(/Sep/);
    expect(screen.getByTestId("on-call-home-teaching-next-badge")).toBeInTheDocument();
  });

  it("says nothing about overdue entries, which are the developer hub's business", () => {
    // Removed on the owner's instruction 2026-09-16: a reader opening this page
    // is mid-shift and looking for a number, and overdue entries are a
    // maintenance fact. They are reported at
    // /mockups/development/on-call-freshness instead. This test exists so a
    // later "helpful" restoration goes red rather than shipping.
    storeState.entries = [staleContact("ward-4b", "Ward 4B")];

    render(<OnCallHome />);

    expect(screen.queryByTestId("on-call-home-stale")).toBeNull();
    expect(screen.queryByText(/needs? checking/i)).toBeNull();
  });

  it("moves to the after-hours number when 17:00 passes on a page nobody has touched", () => {
    // Codex P1 on PR #2806. React re-renders on state changes, and a phone lying
    // on a desk produces none, so a home opened at 16:55 went on offering the
    // daytime desk line all night. That is the wrong-number failure this whole
    // change exists to prevent, arriving by a different route.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 16, 16, 55, 0));
      storeState.entries = [dualLineContact()];

      render(<OnCallHome />);
      expect(screen.getByTestId("on-call-home-call-bed-manager")).toHaveTextContent("9224 1111");

      // Nothing is clicked, scrolled or typed. Only the clock moves.
      act(() => {
        vi.advanceTimersByTime(6 * 60 * 1000);
      });

      const card = screen.getByTestId("on-call-home-call-bed-manager");
      expect(card).toHaveTextContent("9224 2222");
      expect(card).toHaveTextContent(/after hours/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds a clock a caller pinned, so a test or a print view is not moved under it", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 16, 16, 55, 0));
      storeState.entries = [dualLineContact()];

      render(<OnCallHome now={new Date(2026, 8, 16, 9, 0, 0)} />);
      act(() => {
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      });

      expect(screen.getByTestId("on-call-home-call-bed-manager")).toHaveTextContent("9224 1111");
    } finally {
      vi.useRealTimers();
    }
  });
});
