/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRecordsPage } from "@/components/admin/new-job/admin-records-page";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/new-job/records",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const registration = complianceFixture(
  "Medical registration",
  { category: "Registration", expiresOn: "2027-09-30", issuingBody: "Ahpra" },
  { isOwn: true, isPersonal: true },
);
const payslipGuide = onCallEntryFixture({
  section: "logistics",
  title: "Payslips and pay queries",
  details: { category: "Pay" },
  isOwn: true,
  isPersonal: false,
});
const sharedGuide = onCallEntryFixture({
  section: "logistics",
  title: "Shared guide, not the reader's own",
  details: { category: "Pay" },
  isOwn: false,
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

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => entryState,
}));

const NOW = new Date("2026-09-26T01:00:00Z");

beforeEach(() => {
  Object.assign(entryState, {
    entries: [registration, payslipGuide, sharedGuide],
    loading: false,
    isOffline: false,
    loadError: null,
    signedOut: false,
    demoMode: false,
    cachedAt: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminRecordsPage", () => {
  it("is an on-screen page, with a back link and no download", () => {
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByTestId("admin-records-main")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Your Admin records" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /New job/ })).toBeTruthy();
  });

  it("shows only the reader's own records, grouped into Renewals, Admin and Contacts", () => {
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByText(registration.title)).toBeTruthy();
    expect(screen.getByText(payslipGuide.title)).toBeTruthy();
    expect(screen.queryByText(sharedGuide.title)).toBeNull();
  });

  it("keeps Copy and Print behind the ••• menu, not on the page itself", () => {
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Print" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByTestId("admin-records-copy")).toBeTruthy();
    expect(screen.getByTestId("admin-records-print")).toBeTruthy();
  });

  it("shows each renewal's date, what is not recorded yet, and copies the dates too", async () => {
    const writeText = vi.fn(async (text: string) => {
      void text;
    });
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByText("Recorded as expiring 30 Sep 2027")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Not recorded yet" })).toBeTruthy();
    // An Admin guide is not a renewal: it never reads "Not recorded yet".
    expect(screen.getByTestId(`admin-records-row-${payslipGuide.id}`).textContent).not.toContain("Not recorded");
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByTestId("admin-records-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toContain("Recorded as expiring 30 Sep 2027");
  });

  it("shows a skeleton while loading and a sign-in line when signed out, never 'Nothing recorded yet' (M2)", () => {
    Object.assign(entryState, { loading: true });
    const { unmount } = render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByTestId("admin-records-loading")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(screen.queryByTestId("admin-records-empty")).toBeNull();
    unmount();
    Object.assign(entryState, { loading: false, signedOut: true, entries: [] });
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByTestId("admin-records-signed-out")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(screen.queryByTestId("admin-records-empty")).toBeNull();
  });

  it("shows the load-failed state when entries failed to load", () => {
    Object.assign(entryState, { isOffline: true, loadError: "offline" });
    render(<AdminRecordsPage now={NOW} />);
    expect(screen.getByTestId("admin-records-load-failed")).toBeTruthy();
  });
});
