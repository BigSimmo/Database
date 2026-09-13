/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";
import { onCallPageSections } from "@/components/on-call/on-call-page-sections";
import { ON_CALL_SECTIONS, type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";

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

/** One contact, filed under a single area tag — the page's grouping key. */
function contact(id: string, slug: string, title: string, tags: string[]): OnCallEntry {
  return {
    id,
    slug,
    section: "contacts",
    title,
    subtitle: null,
    body: null,
    details: { role: title, phone: "0000 000 001" },
    linkedDocumentIds: [],
    tags,
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: new Date().toISOString(),
  } as unknown as OnCallEntry;
}

describe("the second header row is about THIS page", () => {
  // The mode pill opens On Call's nine pages. The section pages briefly carried
  // the shared `ModeNav` rail listing the same nine underneath it — two
  // controls doing one job, while nothing at all helped a reader move around
  // the page in front of them. Contacts runs to six groups and several screens.
  //
  // So the rail is gone and the page mounts the in-page header instead, whose
  // list is the CURRENT PAGE's groups. These tests pin that division: no rail,
  // and the header names the page's own anchors.
  it("mounts no section rail", () => {
    storeState.entries = [];
    render(<OnCallSectionPage view="contacts" />);
    expect(screen.queryAllByTestId("mode-nav")).toHaveLength(0);
    expect(screen.queryAllByRole("navigation", { name: "On Call pages" })).toHaveLength(0);
  });

  it("names the page, with a way back to the hub", () => {
    storeState.entries = [];
    render(<OnCallSectionPage view="contacts" />);
    const header = screen.getByTestId("on-call-section-detail-header");
    expect(header).toBeTruthy();
    const back = within(header).getByRole("link", { name: /back to on call/i });
    expect(back.getAttribute("href")).toBe("/on-call");
  });

  it("drops back to a plain title on a page with no groups", () => {
    // Referrals is a flat list. A jump list of one row is furniture, so the
    // disclosure is simply absent rather than opening an empty sheet.
    storeState.entries = [];
    render(<OnCallSectionPage view="referrals" />);
    expect(screen.getByTestId("on-call-section-detail-header")).toBeTruthy();
    expect(screen.queryByTestId("on-call-section-section-trigger")).toBeNull();
  });

  it("names the page for a screen reader without painting it a second time", () => {
    // An eyebrow reading "On Call", a display-size "Contacts" and a list
    // heading reading "Contacts" all sat under a sticky header already saying
    // "Contacts". Both headings survive — the `<h1>` for the document outline,
    // the `<h2>` to label the list region — and neither is painted.
    storeState.entries = [];
    const { container } = render(<OnCallSectionPage view="contacts" />);

    const headings = Array.from(container.querySelectorAll("h1, h2, h3")).filter(
      (node) => node.textContent?.trim() === "Contacts",
    );
    expect(headings.map((node) => node.tagName)).toEqual(["H1", "H2"]);
    for (const heading of headings) {
      expect(heading.className, `${heading.tagName} is painted`).toContain("sr-only");
    }
    expect(container.textContent).not.toContain("Filed by role first");

    const region = container.querySelector("#on-call-contacts-entries");
    const labelId = region?.getAttribute("aria-labelledby");
    expect(labelId).toBe("on-call-contacts-entries-heading");
    expect(container.querySelector(`#${labelId}`)?.textContent).toBe("Contacts");
  });

  it("declares only anchors the page actually renders", () => {
    // A declared section whose anchor is not on the page is a dead jump. The
    // declaration and the rendering are two files, so this asserts them against
    // each other on real DOM — never by grepping for `id=`.
    //
    // Resolution itself cannot be asserted here: `useResolvedPageSections`
    // tests visibility with `getClientRects()`, which jsdom reports empty for
    // everything, so no section ever resolves in this environment. That the
    // header then OPENS with those groups is proven in
    // `tests/ui-on-call-boards.spec.ts`, in a browser.
    const entries = [
      contact("aaaa1111-1111-4111-8111-111111111111", "ward-a", "Ward A", ["Wards"]),
      contact("aaaa2222-2222-4222-8222-222222222222", "service-a", "Service A", ["Services"]),
    ];
    storeState.entries = entries;
    const { container } = render(<OnCallSectionPage view="contacts" />);

    const declared = onCallPageSections({ view: "contacts", entries });
    expect(declared.length).toBeGreaterThan(0);
    for (const section of declared) {
      expect(
        container.querySelector(`#${section.id}`),
        `${section.label} declares #${section.id}, which is absent`,
      ).not.toBeNull();
    }
  });
});
