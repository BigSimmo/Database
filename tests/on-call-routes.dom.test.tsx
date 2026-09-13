/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accountState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isAuthenticated: accountState.isAuthenticated,
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

const storeState = vi.hoisted(() => ({
  entries: [] as unknown[],
  loading: false,
  isOffline: false,
  signedOut: false,
  cachedAt: null as string | null,
}));

// A settled, empty hub. Without this the store starts `loading: true` and every
// section correctly renders its loading state instead of its empty one — which
// is the behaviour under test here.
vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => storeState,
  cacheOnCallEntries: vi.fn(),
}));

vi.mock("@/lib/on-call/linked-documents", () => ({
  useOnCallLinkedDocuments: () => ({}),
}));

import OnCallContactsRoute from "@/app/(search-app)/on-call/contacts/page";
import OnCallEducationRoute from "@/app/(search-app)/on-call/education/page";
import OnCallLogisticsRoute from "@/app/(search-app)/on-call/logistics/page";
import OnCallOrientationRoute from "@/app/(search-app)/on-call/orientation/page";
import OnCallPlaybookRoute from "@/app/(search-app)/on-call/playbook/page";
import OnCallReferralsRoute from "@/app/(search-app)/on-call/referrals/page";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { sectionTargetIds } from "@/components/in-page-nav/page-section-index";
import { onCallSectionNavSections } from "@/components/on-call/on-call-nav-header";
import { ON_CALL_SECTIONS, type OnCallSection } from "@/lib/on-call/entry-model";

type RouteCase = {
  section: OnCallSection;
  title: string;
  Route: () => ReactElement;
};

const routes: RouteCase[] = [
  { section: "contacts", title: "Contacts", Route: OnCallContactsRoute },
  { section: "playbook", title: "Playbook", Route: OnCallPlaybookRoute },
  { section: "referrals", title: "Referrals", Route: OnCallReferralsRoute },
  { section: "orientation", title: "Orientation", Route: OnCallOrientationRoute },
  // Titled "Teaching" everywhere a reader sees it, even though the section id
  // (route segment, database check constraint) stays "education".
  { section: "education", title: "Teaching", Route: OnCallEducationRoute },
  { section: "logistics", title: "Logistics", Route: OnCallLogisticsRoute },
];

// A contact verified today, so it sorts into an area group rather than the
// "needs checking" list and carries no verify control of its own. This fixture
// exists to test the edit affordance, not freshness.
const freshContact = {
  id: "00000000-0000-4000-8000-0000000000a1",
  section: "contacts" as const,
  slug: "switchboard",
  title: "Switchboard",
  subtitle: null,
  body: null,
  details: { role: "Switchboard operator", phone: "9999 9999", area: "Hospital" },
  linkedDocumentIds: [],
  tags: [],
  isPersonal: false,
  includeOnCard: true,
  sortOrder: 0,
  lastVerifiedAt: new Date().toISOString(),
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  // OnCallSectionPage now reads the entry store (task 11) for every section, so
  // every route render fetches. Stub it deterministically rather than letting a
  // real network attempt reach an unmocked relative URL from jsdom.
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [], signedOut: false }));
});

afterEach(() => {
  cleanup();
  accountState.isAuthenticated = true;
  storeState.entries = [];
});

describe("on-call section routes", () => {
  it("covers every declared on-call section, in order", () => {
    // Fails loudly if a section is added to the data model without a route
    // case here, rather than leaving the new section silently unguarded.
    expect(routes.map((route) => route.section)).toEqual([...ON_CALL_SECTIONS]);
  });

  it.each(routes.map((route) => [route.title, route] as const))(
    "%s renders exactly one first-level heading naming the section",
    (_title, route) => {
      render(<route.Route />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1, name: route.title })).toBeInTheDocument();
    },
  );

  it.each(routes.map((route) => [route.title, route] as const))(
    "%s renders an anchor, with the shared in-page scroll margin, for every declared section",
    (_title, route) => {
      const { container } = render(<route.Route />);
      const declared = onCallSectionNavSections(route.section);
      expect(declared.length).toBeGreaterThan(0);

      for (const section of declared) {
        const anchor = sectionTargetIds(section)
          .map((id) => container.querySelector(`#${CSS.escape(id)}`))
          .find((element): element is Element => element !== null);
        expect(anchor, `${route.title}: no element renders an anchor for "${section.id}"`).not.toBeNull();
        expect(anchor?.className, `${route.title}: "${section.id}" has no in-page scroll margin`).toContain(
          inPageAnchor,
        );
      }
    },
  );

  it.each(routes.filter((route) => route.section !== "contacts").map((route) => [route.title, route] as const))(
    "%s shows its own empty state and a way to add to it",
    (_title, route) => {
      accountState.isAuthenticated = true;
      render(<route.Route />);

      // These five once shared a placeholder "search the hub" empty state,
      // because only Contacts was wired to the store — so the pages could not
      // show entries and offered no way to create one. Each now renders its
      // own section component and its own add control.
      expect(screen.getByTestId(`on-call-${route.section}-empty`)).toBeTruthy();
      expect(screen.getByTestId(`on-call-${route.section}-add`)).toBeTruthy();
      expect(screen.queryByTestId(`on-call-${route.section}-signed-out`)).toBeNull();
    },
  );

  // Contacts is wired to the real entry store and editor (task 11): a signed-in
  // reader with no entries yet gets the section's own "add one" action, rather
  // than the other five sections' placeholder "search the hub" empty state.
  it("Contacts offers 'Add contact' for a signed-in reader with no entries yet", () => {
    accountState.isAuthenticated = true;
    render(<OnCallContactsRoute />);

    const empty = screen.getByTestId("on-call-contacts-empty");
    expect(within(empty).getByRole("button", { name: "Add contact" })).toBeInTheDocument();
    expect(within(empty).queryByRole("link", { name: "Search On Call" })).toBeNull();
    expect(screen.queryByTestId("on-call-contacts-signed-out")).toBeNull();
  });

  // Signed out no longer means walled off. The API has served every shared
  // (non-personal) entry to anonymous callers since the 2026-09-04 owner
  // decision — `fetchSharedOnCallEntries` — and this client gate was the last
  // thing still hiding them behind a "Sign in" empty state. Reading is open to
  // any visitor. Writing is not: the write routes require an account.
  it.each(routes.map((route) => [route.title, route] as const))(
    "%s renders its own list to a signed-out reader, with no sign-in wall and nothing to edit",
    (_title, route) => {
      accountState.isAuthenticated = false;
      render(<route.Route />);

      // The generic section name is still shown, as it always was.
      expect(screen.getByRole("heading", { level: 1, name: route.title })).toBeInTheDocument();
      expect(screen.queryByTestId(`on-call-${route.section}-signed-out`)).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();

      // The section's own component renders, so an empty hub reads as empty
      // rather than as locked.
      expect(screen.getByTestId(`on-call-${route.section}-empty`)).toBeTruthy();
      expect(screen.queryByTestId(`on-call-${route.section}-add`)).toBeNull();
    },
  );

  it("Contacts shows an entry to a signed-out reader with no edit control on it", () => {
    accountState.isAuthenticated = false;
    storeState.entries = [freshContact];
    render(<OnCallContactsRoute />);

    expect(screen.getByTestId("on-call-contact-row-switchboard")).toBeInTheDocument();
    expect(screen.queryByTestId("on-call-contact-edit-switchboard")).toBeNull();
  });

  // The paired assertion. Removing the wall must not remove editing for the
  // owner, which is what an over-eager deletion of the gate would do.
  it("Contacts offers the edit control on that same entry once signed in", () => {
    accountState.isAuthenticated = true;
    storeState.entries = [freshContact];
    render(<OnCallContactsRoute />);

    expect(screen.getByTestId("on-call-contact-row-switchboard")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-contact-edit-switchboard")).toBeInTheDocument();
  });
});
