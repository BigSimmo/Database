/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { partitionLogisticsEntries } from "@/lib/on-call/compliance";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";
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
  demoMode: false,
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
  storeState.signedOut = false;
  storeState.demoMode = false;
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

  it("puts a dated teaching card inside the Coming up module, as the browser board test looks for", () => {
    // A standing double for `tests/ui-on-call-boards.spec.ts` "dates the next
    // teaching session with a weekday". That spec went red on PR #2806 because
    // the card's test id moved from `on-call-home-upcoming-` to
    // `on-call-home-teaching-` when the row became a strip, and nothing offline
    // covered it. Same corpus, same nesting, same weekday assertion, no browser.
    storeState.entries = [...DEMO_ON_CALL_ENTRIES];

    render(<OnCallHome />);

    const comingUp = screen.getByTestId("on-call-home-upcoming");
    const cards = comingUp.querySelectorAll('[data-testid^="on-call-home-teaching-"]');
    expect(cards.length).toBeGreaterThan(0);
    // A date a reader can check against a roster, never a countdown.
    expect(cards[0]).toHaveTextContent(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });
});

describe("On Call home tiles for Admin and Compliance", () => {
  // Admin and Compliance are ONE stored section (`logistics`) split on
  // `details.kind`, because `section` is a database CHECK constraint and a
  // seventh value costs a migration that reaches the live clinical database
  // within seconds. `countOnCallEntriesBySection` counts by the stored section
  // and so knows nothing about that split: the Admin tile used to promise
  // every logistics row, including the requirements that are not on the Admin
  // page, and there was no Compliance tile at all.
  //
  // Both cases below ask `partitionLogisticsEntries` how many rows each page
  // holds rather than writing the numbers down — a test that restated them
  // would keep passing if the split itself were wrong, and would go red every
  // time the demo corpus gained a row.

  it("counts the Admin tile from the rows the Admin page actually renders", () => {
    const entries = [...DEMO_ON_CALL_ENTRIES];
    const { admin, compliance } = partitionLogisticsEntries(entries);
    const stored = entries.filter((entry) => entry.section === "logistics").length;
    // Without a compliance row in the corpus the two numbers are the same and
    // this test could not tell the fix from the bug.
    expect(compliance.length, "the demo corpus has no compliance rows to leave out").toBeGreaterThan(0);

    storeState.entries = entries;
    render(<OnCallHome />);

    const tile = screen.getByTestId("on-call-home-tile-logistics");
    expect(within(tile).getByText(String(admin.length))).toBeInTheDocument();
    // The stored-section total is the wrong number, and it is the number the
    // tile used to show.
    expect(within(tile).queryByText(String(stored)), "the Admin tile is counting compliance rows again").toBeNull();
  });

  it("gives Compliance its own tile, counted the same way", () => {
    const entries = [...DEMO_ON_CALL_ENTRIES];
    const { compliance } = partitionLogisticsEntries(entries);

    storeState.entries = entries;
    render(<OnCallHome />);

    const tile = screen.getByTestId("on-call-home-tile-compliance");
    expect(tile).toHaveAttribute("href", "/on-call/compliance");
    expect(tile).toHaveTextContent("Compliance");
    expect(within(tile).getByText(String(compliance.length))).toBeInTheDocument();
  });
});

describe("the example-content module", () => {
  // `OnCallDemoContentControl` renders nothing when signed out or in demo mode,
  // so the module around it must not render either. The demo case is not
  // hypothetical: in demo mode the example corpus IS the entries, so every slug
  // carries the `demo-` prefix and the "is any example content loaded?" test is
  // true for every reader. Gated on that alone, the public demo home — and the
  // home every `ui-*.spec.ts` renders — grew an "Example content" heading with
  // nothing underneath it.
  it("is absent in demo mode, where the corpus is the content and there is nothing to remove", () => {
    storeState.entries = [...DEMO_ON_CALL_ENTRIES];
    storeState.demoMode = true;

    render(<OnCallHome />);

    expect(screen.queryByTestId("on-call-home-example-content")).toBeNull();
    expect(screen.queryByText("Example content")).toBeNull();
  });

  it("is absent for a signed-out reader, who cannot remove anything either", () => {
    storeState.entries = [...DEMO_ON_CALL_ENTRIES];
    storeState.signedOut = true;

    render(<OnCallHome />);

    expect(screen.queryByTestId("on-call-home-example-content")).toBeNull();
  });

  it("is present for the signed-in owner whose account actually holds the rows", async () => {
    // Guard the two tests above: if the module never rendered at all they would
    // pass on a component that had simply been deleted.
    //
    // The owner-scoped answer has to be supplied, because that is now the only
    // thing that decides this. The entries in view do not: the shared read
    // returns every non-personal row across all accounts.
    storeState.entries = [...DEMO_ON_CALL_ENTRIES];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ loaded: DEMO_ON_CALL_ENTRIES.length, total: DEMO_ON_CALL_ENTRIES.length }),
    }) as unknown as typeof fetch;

    try {
      render(<OnCallHome />);
      expect(await screen.findByTestId("on-call-home-example-content")).toBeInTheDocument();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stays absent while the owner-scoped answer is still unknown", async () => {
    // A labelled HomeModule whose only child has decided to render nothing is
    // a heading with an empty body. That shipped once already, caught before
    // push; it is pinned here because the failure mode is invisible in the
    // markup a component test usually asserts on.
    storeState.entries = [...DEMO_ON_CALL_ENTRIES];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    try {
      render(<OnCallHome />);
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      expect(screen.queryByTestId("on-call-home-example-content")).toBeNull();
      expect(screen.queryByText("Example content")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
