/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNewJobPage } from "@/components/admin/admin-new-job-page";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { onCallEntryFixture } from "./helpers/on-call-entry-fixture";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/new-job",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
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
  isPersonal: false,
});
const loginShared = onCallEntryFixture({
  section: "logistics",
  title: "Demo shared systems access",
  details: { category: "Systems" },
  isOwn: false,
  isPersonal: false,
});
const jobContact = onCallEntryFixture({
  section: "contacts",
  title: "Demo medical workforce unit",
  details: { role: "Medical workforce", phone: "(08) 9000 0012" },
  isOwn: true,
  isPersonal: false,
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

const cacheOnCallEntries = vi.fn();
vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => entryState,
  cacheOnCallEntries: (entries: OnCallEntry[]) => cacheOnCallEntries(entries),
}));

beforeEach(() => {
  Object.assign(entryState, {
    entries: [loginOwn, loginShared, jobContact],
    loading: false,
    isOffline: false,
    loadError: null,
    signedOut: false,
    demoMode: false,
    cachedAt: null,
  });
  cacheOnCallEntries.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NOW = new Date("2026-09-26T01:00:00Z");

describe("AdminNewJobPage", () => {
  it("renders the own login row under Before with its entry anchor", () => {
    render(<AdminNewJobPage now={NOW} />);
    const row = document.getElementById(`on-call-entry-${loginOwn.id}`);
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getAllByText(loginOwn.title).length).toBeGreaterThan(0);
  });

  it("shows the shared login row read-only, with no edit control or tick", () => {
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.getByText(/^Shared by another doctor · /)).toBeTruthy();
    expect(screen.queryByRole("button", { name: `Edit ${loginShared.title}` })).toBeNull();
    const sharedRow = screen.getByTestId(`admin-new-job-step-${loginShared.slug}`);
    expect(within(sharedRow).queryByRole("checkbox")).toBeNull();
  });

  it("shows the job's contacts with short in-hospital numbers", () => {
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.getByText(jobContact.title)).toBeTruthy();
    const link = screen.getByRole("link", { name: "9000 0012" });
    expect(link.getAttribute("href")).toBe("tel:0890000012");
  });

  it("shows no week timings anywhere on the page", () => {
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.queryByText(/week \d/i)).toBeNull();
  });

  it("shows N of M done and a matching N left for the one ticked group", () => {
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.getByTestId("admin-new-job-progress")).toHaveTextContent("0 of 1 done");
    expect(screen.getByTestId("admin-new-job-logins-left")).toHaveTextContent("1 left");
  });

  it("ticks an own step as a real saved toggle, with Undo", async () => {
    const saved = { ...loginOwn, details: { category: "Logins", done: true } };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ entry: saved }), { status: 200 }));
    render(<AdminNewJobPage now={NOW} />);
    const checkbox = screen.getByTestId(`admin-new-job-step-${loginOwn.slug}-checkbox`);
    fireEvent.click(checkbox);
    await waitFor(() => expect(cacheOnCallEntries).toHaveBeenCalled());
    expect(screen.getByTestId("admin-new-job-undo")).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/on-call/entries/${loginOwn.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("shows the load-failed state, not empty rows, when entries failed to load", () => {
    Object.assign(entryState, { isOffline: true, loadError: "offline" });
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.getByTestId("admin-new-job-load-failed")).toBeTruthy();
    expect(screen.queryByText(loginOwn.title)).toBeNull();
  });

  it("says its Leaving list is not saved, and ends with a link to Your Admin records", () => {
    render(<AdminNewJobPage now={NOW} />);
    expect(screen.getByTestId("admin-new-job-leaving-notice")).toHaveTextContent(
      "Nothing is saved. Ticks clear when you close this page.",
    );
    const link = screen.getByTestId("admin-new-job-records-link");
    expect(link.getAttribute("href")).toBe("/admin/new-job/records");
  });
});
