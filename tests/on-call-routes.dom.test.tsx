/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// The dialog's own contract (fields, submit, error/notice) is covered by its own
// tests; this file only needs to know whether the "Sign in" action opens it.
vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({
  AccountSetupDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="on-call-account-setup-dialog-open" /> : null,
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

  it.each(routes.map((route) => [route.title, route] as const))(
    "%s names the generic section but renders no entry content when signed out",
    async (_title, route) => {
      accountState.isAuthenticated = false;
      render(<route.Route />);

      // The generic section name is always shown — it is not entry content.
      expect(screen.getByRole("heading", { level: 1, name: route.title })).toBeInTheDocument();
      expect(screen.getAllByText(route.title).length).toBeGreaterThan(0);

      const signedOut = screen.getByTestId(`on-call-${route.section}-signed-out`);
      expect(screen.queryByTestId(`on-call-${route.section}-empty`)).toBeNull();

      const signIn = within(signedOut).getByRole("button", { name: "Sign in" });
      expect(screen.queryByTestId("on-call-account-setup-dialog-open")).toBeNull();

      const user = userEvent.setup();
      await user.click(signIn);
      expect(screen.getByTestId("on-call-account-setup-dialog-open")).toBeInTheDocument();
    },
  );
});
