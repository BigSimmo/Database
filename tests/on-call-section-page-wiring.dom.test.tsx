/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";
import { ON_CALL_SECTIONS, type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { modeSecondaryNavigationEntries } from "@/lib/mode-secondary-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/contacts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: true, isSaved: () => false, setFavourite: vi.fn(async () => true) }),
}));

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({
  AccountSetupDialog: () => null,
}));

vi.mock("@/lib/on-call/linked-documents", () => ({
  useOnCallLinkedDocuments: () => ({}),
}));

const storeState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  signedOut: false,
  cachedAt: null as string | null,
}));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => storeState,
  cacheOnCallEntries: vi.fn(),
}));

const FRESH = new Date("2026-06-01T00:00:00.000Z").toISOString();

/** One entry per section, each carrying the minimum its own schema needs. */
const DETAILS_BY_SECTION: Record<OnCallSection, Record<string, unknown>> = {
  contacts: { role: "Switchboard", phone: "9111 2222" },
  playbook: { trigger: "Owner-written trigger text", escalationSteps: [{ order: 1, whoToCall: "Registrar" }] },
  referrals: { accepts: [], exclusions: [], phone: "9333 4444" },
  orientation: {},
  education: { presenter: "Dr Example", nextOccurrence: "Thursday 1pm" },
  logistics: { category: "Parking", location: "Level B1" },
};

function entryFor(section: OnCallSection): OnCallEntry {
  return {
    id: `0000000${ON_CALL_SECTIONS.indexOf(section)}-0000-0000-0000-000000000000`,
    slug: `${section}-entry`,
    section,
    title: `${section} entry title`,
    subtitle: null,
    body: "Owner-written body text.",
    details: DETAILS_BY_SECTION[section],
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: FRESH,
  };
}

afterEach(() => {
  cleanup();
  Object.assign(storeState, { entries: [], loading: false, isOffline: false, signedOut: false, cachedAt: null });
});

describe("every section renders its own entries", () => {
  // The regression this pins: only Contacts was wired to the store, so the
  // other five list components were reachable from their tests and from
  // nothing else. Five of six pages said "no entries yet" no matter what the
  // owner had saved, and there was no way to add an entry to them at all.
  for (const section of ON_CALL_SECTIONS) {
    it(`shows a saved ${section} entry on the ${section} page`, () => {
      storeState.entries = [entryFor(section)];
      render(<OnCallSectionPage view={section} />);
      // `getAllByText`: Referrals renders its title in both the disclosure
      // summary and the expanded body, so one match is not guaranteed.
      expect(screen.getAllByText(`${section} entry title`).length).toBeGreaterThan(0);
      expect(screen.queryByTestId(`on-call-${section}-loading`)).toBeNull();
    });

    it(`does not assert an empty ${section} while the first fetch runs`, () => {
      storeState.entries = [];
      storeState.loading = true;
      render(<OnCallSectionPage view={section} />);
      expect(screen.getByTestId(`on-call-${section}-loading`)).toBeTruthy();
    });
  }
});

describe("the sections can reach each other", () => {
  // Before the mode had a rail, five of the six pages were orphans: the mode
  // registered destinations in the shared header bar, but every section route is
  // an information page, so `PageSecondaryNavigation` returned null and the bar
  // was never drawn. A reader could open Contacts and have no way to reach
  // Playbook. The page now mounts `RegistryModeNav` itself, which is what makes
  // the registry's destinations actually reachable.
  it("mounts the shared rail, carrying every registered destination", () => {
    storeState.entries = [];
    render(<OnCallSectionPage view="contacts" />);

    const rail = screen.getAllByTestId("mode-nav")[0];
    expect(rail).toBeTruthy();
    const hrefs = [...rail!.querySelectorAll("a[href]")].map((link) => link.getAttribute("href"));
    for (const entry of modeSecondaryNavigationEntries("on-call")) {
      expect(hrefs, `the rail does not link ${entry.label}`).toContain(entry.href);
    }
  });

  it("marks the page you are on, and only that one", () => {
    // The rail reads the pathname, not the view prop — in production the two are
    // the same fact, and deriving from the URL is what keeps a deep link marked
    // correctly. `usePathname` is mocked to /on-call/contacts at the top of this
    // file, so that is the page under test here.
    storeState.entries = [];
    render(<OnCallSectionPage view="contacts" />);

    const rail = screen.getAllByTestId("mode-nav")[0];
    const current = [...rail!.querySelectorAll("a[aria-current='page']")].map((link) => link.getAttribute("href"));
    expect(current).toEqual(["/on-call/contacts"]);
  });

  it("gives the rail its own landmark so it is not read as page content", () => {
    storeState.entries = [];
    render(<OnCallSectionPage view="contacts" />);
    expect(screen.getAllByRole("navigation", { name: "On Call pages" }).length).toBeGreaterThan(0);
  });
});
