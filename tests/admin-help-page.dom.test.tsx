/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminHelpPage } from "@/components/admin/admin-help-page";
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { onCallEntryFixture } from "./helpers/on-call-entry-fixture";

const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/help",
  useRouter: () => ({ push: vi.fn(), replace: routerReplace, back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: true, isSaved: () => false, setFavourite: vi.fn(async () => true) }),
}));

vi.mock("@/components/on-call/on-call-entry-editor", () => ({
  OnCallEntryEditor: (props: { open: boolean; entry: OnCallEntry | null }) =>
    props.open ? <div data-testid="mock-entry-editor">{props.entry?.title ?? "new entry"}</div> : null,
}));

const loginOwn = onCallEntryFixture({
  section: "logistics",
  title: "Demo logins, paging and remote access",
  details: { category: "Logins" },
  isOwn: true,
});
const onSiteOwn = onCallEntryFixture({
  section: "logistics",
  title: "Demo food after hours",
  details: { category: "Facilities", location: "Level 1" },
  isOwn: true,
});
const guideShared = onCallEntryFixture({
  section: "logistics",
  title: "Demo payslips and pay queries",
  details: { category: "Pay" },
  isOwn: false,
  isPersonal: false,
});
const workforceContact = onCallEntryFixture({
  section: "contacts",
  title: "Demo medical workforce unit",
  details: { kind: "role-explainer", role: "Medical workforce" },
  isOwn: true,
});

const entryState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  loadError: null as "offline" | "failed" | null,
  signedOut: false,
  demoMode: false,
  cachedAt: null as string | null,
  retry: vi.fn(),
}));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => entryState,
  cacheOnCallEntries: vi.fn(),
}));

beforeEach(() => {
  Object.assign(entryState, {
    entries: [loginOwn, onSiteOwn, guideShared, workforceContact],
    loading: false,
    isOffline: false,
    loadError: null,
    signedOut: false,
    demoMode: false,
    cachedAt: null,
  });
  routerReplace.mockClear();
  window.history.replaceState(null, "", "/admin/help");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NOW = new Date("2026-09-26T05:00:00Z"); // a Saturday: always "after hours" in Perth

describe("AdminHelpPage", () => {
  it("puts every crisis line at the top, with 000 the only emergency-tone number", () => {
    render(<AdminHelpPage now={NOW} />);
    const crisis = screen.getByTestId("admin-help-crisis");
    for (const contact of WA_CRISIS_CONTACTS) {
      expect(within(crisis).getByText(contact.name)).toBeTruthy();
      const call = within(crisis).getByTestId(`admin-help-crisis-${contact.id}-call`);
      expect(call.getAttribute("href")).toBe(`tel:${contact.telephoneUri}`);
    }
    const emergencyDots = crisis.querySelectorAll('[data-testid$="-emergency-dot"]');
    expect(emergencyDots).toHaveLength(1);
    expect(within(crisis).getAllByText(/^Updated [A-Z][a-z]{2} \d{4}$/).length).toBeGreaterThan(0);
  });

  it("puts the crisis lines ahead of the Find in Help box and Add your own (M4)", () => {
    render(<AdminHelpPage now={NOW} />);
    const crisis = screen.getByTestId("admin-help-crisis");
    for (const later of [screen.getByTestId("admin-help-filter"), screen.getByTestId("admin-help-add")]) {
      expect(crisis.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("shows a skeleton, not 'Nothing here yet', in a section still loading (M2)", () => {
    Object.assign(entryState, { loading: true, entries: [] });
    render(<AdminHelpPage now={NOW} />);
    expect(screen.getByTestId("admin-help-guides-loading")).toBeTruthy();
    expect(screen.queryByText(/^Nothing here yet/)).toBeNull();
    expect(screen.getByTestId("admin-help-crisis")).toBeTruthy();
  });

  it("files own and shared rows into On site and Guides, each with its entry anchor", () => {
    render(<AdminHelpPage now={NOW} />);
    const onSite = screen.getByRole("region", { name: "On site" });
    expect(within(onSite).getByText(onSiteOwn.title)).toBeTruthy();
    expect(document.getElementById(`on-call-entry-${onSiteOwn.id}`)).not.toBeNull();

    const guides = screen.getByRole("region", { name: "Guides" });
    expect(within(guides).getByText(guideShared.title)).toBeTruthy();
    expect(within(guides).getByText(/^Shared by another doctor · /)).toBeTruthy();

    const contacts = screen.getByRole("region", { name: "Contacts" });
    expect(within(contacts).getByText(workforceContact.title)).toBeTruthy();
  });

  it("shows the after-hours line on On site on a weekend", () => {
    render(<AdminHelpPage now={NOW} />);
    expect(screen.getByTestId("admin-help-on-site-after-hours")).toBeTruthy();
  });

  it("filters with everyday words in its own box, never the main search, and never hides the crisis lines", () => {
    render(<AdminHelpPage now={NOW} />);
    const filter = screen.getByLabelText("Find in Help");
    expect(screen.getByTestId("admin-help-filter")).toContainElement(filter);
    expect(screen.queryByRole("button", { name: /voice|microphone|dictate/i })).toBeNull();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fireEvent.change(filter, { target: { value: "hungry" } });
    expect(screen.getByText("Demo food after hours")).toBeTruthy();
    expect(screen.queryByText("Demo payslips and pay queries")).toBeNull();
    expect(screen.getByTestId("admin-help-crisis")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards an old login-row anchor to New job", () => {
    window.history.replaceState(null, "", `/admin/help#on-call-entry-${loginOwn.id}`);
    render(<AdminHelpPage now={NOW} />);
    expect(routerReplace).toHaveBeenCalledWith(`/admin/new-job#on-call-entry-${loginOwn.id}`);
  });

  it("offers Edit on the reader's own rows only, and an Add that is not the dark primary", () => {
    render(<AdminHelpPage now={NOW} />);
    expect(
      within(screen.getByRole("region", { name: "Guides" })).queryByRole("button", {
        name: `Edit ${guideShared.title}`,
      }),
    ).toBeNull();
    const onSite = screen.getByRole("region", { name: "On site" });
    expect(within(onSite).getByRole("button", { name: `Edit ${onSiteOwn.title}` })).toBeTruthy();
    expect(screen.getByTestId("admin-help-add").className).not.toContain("--command");
  });

  it("shows the load-failed state, not empty tabs, when entries failed to load", () => {
    Object.assign(entryState, { isOffline: true, loadError: "offline" });
    render(<AdminHelpPage now={NOW} />);
    expect(screen.getByTestId("admin-help-load-failed")).toBeTruthy();
    expect(screen.getByTestId("admin-help-crisis")).toBeTruthy();
  });
});
