/** @vitest-environment jsdom */

// Admin's Today (mode id `my-work`): the owner-approved order — a quiet
// greeting, the "Renew next" answer card, "Needs you", "Requirements" and,
// only once a start date is set, "New job progress". Nothing else renders
// here: no timeline, no Pay, no Help block, no ask box.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

const state = {
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  loadError: null as "offline" | "failed" | null,
  retry: vi.fn(),
  cachedAt: null,
  signedOut: false,
  demoMode: false,
};

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => state,
  cacheOnCallEntries: vi.fn(),
}));

let isAuthenticated = true;
vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated }),
}));

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({
  AccountSetupDialog: () => null,
}));

import { AdminTodayPage } from "@/components/admin/admin-today-page";

// 09:00 on Sat 26 Sep 2026 in Perth, the same fixed instant the selector tests use.
const NOW = new Date("2026-09-26T01:00:00Z");

const registration = complianceFixture("Medical registration", {
  category: "Registration",
  requirementId: "medical-registration-renewal",
  expiresOn: "2026-10-15", // opens 15 Sep (30-day default): inside its lead time, 19 days out
});
const wwc = complianceFixture("Working with Children card", {
  category: "Clearances",
  consequence: "stops-work",
  expiresOn: "2026-09-03", // passed, 23 days ago — further from today than registration's 19
});
const police = complianceFixture("Police check", { category: "Clearances" }); // no date
const indemnity = complianceFixture("Indemnity", { category: "Indemnity", expiresOn: "2027-06-30" });

beforeEach(() => {
  state.entries = [];
  state.loading = false;
  state.isOffline = false;
  state.loadError = null;
  state.signedOut = false;
  state.demoMode = false;
  isAuthenticated = true;
});
afterEach(cleanup);

describe("AdminTodayPage", () => {
  it("opens with a greeting and the date, no summary number, and no tabs", () => {
    state.entries = [registration, indemnity];
    render(<AdminTodayPage now={NOW} />);
    const greeting = screen.getByTestId("admin-today-greeting");
    expect(greeting.textContent).toContain("Good morning");
    expect(greeting.textContent).toContain("Sat 26 Sep 2026");
    expect(greeting.textContent).not.toMatch(/\d+ (items|renewals|due)/);
    expect(screen.queryByRole("navigation", { name: "Sections of this page" })).toBeNull();
  });

  it("shows static skeletons while loading, nothing ready-shaped", () => {
    state.loading = true;
    render(<AdminTodayPage now={NOW} />);
    expect(screen.getByTestId("admin-today-loading")).toBeTruthy();
    expect(screen.queryByTestId("admin-today-renew-next")).toBeNull();
  });

  it("never shows an empty page when the load failed, even with a cached copy", () => {
    state.entries = [registration];
    state.isOffline = true;
    state.loadError = "offline";
    render(<AdminTodayPage now={NOW} />);
    expect(screen.getByTestId("admin-today-load-failed")).toBeTruthy();
    expect(screen.queryByTestId("admin-today-renew-next")).toBeNull();
    expect(screen.queryByTestId("admin-today-needs-you")).toBeNull();
  });

  it("offers sign-in and a way to Help when the reader is signed out, nothing else", () => {
    state.signedOut = true;
    render(<AdminTodayPage now={NOW} />);
    expect(screen.getByTestId("admin-today-signed-out")).toBeTruthy();
    const help = screen.getByRole("link", { name: /Help/ });
    expect(help.getAttribute("href")).toBe("/admin/help");
    expect(screen.queryByTestId("admin-today-renew-next")).toBeNull();
  });

  it("shows the soonest date of any kind on the Renew next card, with the lead-time drawing and both actions", () => {
    state.entries = [registration, wwc];
    render(<AdminTodayPage now={NOW} />);
    const card = screen.getByTestId("admin-today-renew-next");
    expect(within(card).getByText("Medical registration")).toBeTruthy();
    expect(within(card).getByText("Expires 15 Oct 2026 · in 2 weeks")).toBeTruthy();
    expect(screen.getByTestId("admin-today-renew-next-window")).toBeTruthy();
    const renewed = within(card).getByTestId("admin-today-renew-next-renewed");
    expect(renewed.getAttribute("href")).toBe(`/admin/renewals#on-call-entry-${registration.id}`);
    const how = within(card).getByTestId("admin-today-renew-next-how");
    expect(how.getAttribute("href")).toBe("https://www.medicalboard.gov.au/registration/registration-renewal.aspx");
  });

  it("features the passed date on Needs you, excluding the entry already shown on Renew next, grouping undated rows", () => {
    state.entries = [registration, wwc, police];
    render(<AdminTodayPage now={NOW} />);
    // Renew next wins on registration (nearer today than wwc's passed date), so
    // Needs you's featured row is the next most urgent thing: the passed wwc row.
    const needsYou = screen.getByTestId("admin-today-needs-you");
    const featured = within(needsYou).getByTestId("admin-today-needs-you-featured");
    expect(featured.textContent).toContain("Working with Children card");
    expect(featured.textContent).toContain("Date passed");
    const rows = screen.queryByTestId("admin-today-needs-you-rows");
    expect(rows?.textContent).toContain("1 dates not recorded");
    expect(rows?.textContent).toContain("Police check");
  });

  it("always shows Requirements in words, with no score bars", () => {
    state.entries = [registration];
    render(<AdminTodayPage now={NOW} />);
    const requirements = screen.getByTestId("admin-today-requirements");
    expect(requirements.textContent).toMatch(/\d+ of \d+ recorded/);
    expect(requirements.textContent).toContain("Dates you entered, not a check");
    expect(requirements.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("shows New job progress only once a start date is set", () => {
    state.entries = [registration];
    const { unmount } = render(<AdminTodayPage now={NOW} />);
    expect(screen.queryByTestId("admin-today-new-job")).toBeNull();
    unmount();

    const step = onCallEntryFixture({
      section: "logistics",
      title: "Sign and return your contract",
      details: { category: "Logins", jobStartsOn: "2026-11-02" },
    });
    state.entries = [registration, step];
    render(<AdminTodayPage now={NOW} />);
    const newJob = screen.getByTestId("admin-today-new-job");
    expect(newJob.textContent).toContain("Starts 2 Nov 2026");
    expect(newJob.textContent).toContain("Sign and return your contract");
  });

  it("opens the setup sheet only while neither registration nor indemnity is recorded, and has no Add button", () => {
    state.entries = [];
    const { unmount } = render(<AdminTodayPage now={NOW} />);
    expect(screen.getByRole("dialog", { name: "Set up Admin" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Add/ })).toBeNull();
    unmount();

    state.entries = [indemnity];
    render(<AdminTodayPage now={NOW} />);
    expect(screen.queryByRole("dialog", { name: "Set up Admin" })).toBeNull();
  });

  it("renders nothing from the rest of Admin: no Pay, no Help block, no ask box", () => {
    state.entries = [registration, indemnity];
    render(<AdminTodayPage now={NOW} />);
    expect(screen.queryByText("Pay")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByTestId("admin-today-help")).toBeNull();
  });
});
