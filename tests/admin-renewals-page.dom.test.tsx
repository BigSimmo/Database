/** @vitest-environment jsdom */

// AdminRenewalsPage: the Checklist built from the statewide Requirements
// catalogue, crossed with the reader's own recorded dates, plus a Personal
// tab for items that aren't on the catalogue. Final design, screens-v3.
//
// This is the checklist-based redesign of Renewals; it supersedes the
// band-grouped page `OnCallComplianceSection` drew, which this lane's report
// explains under "Deviations from task-6-brief.md". That component's own
// tests (`tests/on-call-compliance-page.dom.test.tsx`) are left in place,
// covering code that still exists and is still directly exercised there.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

vi.mock("@/lib/admin/download-file", () => ({ downloadTextFile: vi.fn() }));
import { downloadTextFile } from "@/lib/admin/download-file";

const storeState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  loadError: null as string | null,
  signedOut: false,
  demoMode: false,
  cachedAt: null as string | null,
}));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => storeState,
  cacheOnCallEntries: (entries: OnCallEntry[]) => {
    storeState.entries = entries;
  },
}));

import { AdminRenewalsPage } from "@/components/admin/admin-renewals-page";

const NOW = new Date("2026-09-26T04:00:00.000Z"); // Perth calendar day 26 Sep 2026

const WWC = complianceFixture(
  "Working with Children Check",
  { category: "checks", expiresOn: "2026-09-03", requirementId: "working-with-children-check" },
  { slug: "wwc" },
);
const ALS = complianceFixture(
  "ALS course certification",
  { category: "training", expiresOn: "2026-10-14", requirementId: "als-course-certification" },
  { slug: "als" },
);
const INDEMNITY = complianceFixture(
  "Indemnity insurance declaration",
  { category: "registration", expiresOn: "2026-11-30", requirementId: "professional-indemnity-insurance" },
  { slug: "indemnity" },
);
const REGISTRATION = complianceFixture(
  "Medical registration renewal",
  { category: "registration", expiresOn: "2027-08-30", requirementId: "medical-registration-renewal" },
  { slug: "med-reg" },
);

const ALL = [WWC, ALS, INDEMNITY, REGISTRATION];

beforeEach(() => {
  Object.assign(storeState, {
    entries: [...ALL],
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

function renderPage() {
  render(<AdminRenewalsPage now={NOW} />);
}

describe("AdminRenewalsPage — the checklist", () => {
  it("groups by state under All: soonest first, then not recorded yet", () => {
    renderPage();
    const groups = screen.getByTestId("admin-renewals-checklist");
    const soonest = within(groups).getByTestId("admin-renewals-checklist-group-Soonest first");
    // WWC's date has passed and ALS is inside its own renewing window, so both
    // are "needs-action" rows; the catalogue's not-recorded items (no entry
    // above matches them) land in their own group.
    expect(within(soonest).getByText("Working with Children Check")).toBeInTheDocument();
    expect(within(soonest).getByText("ALS course certification")).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-checklist-group-Not recorded yet")).toBeInTheDocument();
  });

  it("draws urgency as grey shapes and words, with no red or amber anywhere on the page", () => {
    renderPage();
    expect(screen.getByText("Date passed")).toBeInTheDocument();
    expect(screen.getByText("Start renewing")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/--danger|--warning/);
  });

  it("filters the checklist to one kind", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-kind-checks"));
    const list = within(screen.getByTestId("admin-renewals-checklist"));
    expect(list.getByText("Working with Children Check")).toBeInTheDocument();
    expect(list.queryByText("ALS course certification")).toBeNull();
  });

  it("shows the confirmed rule, the source link, and never the word 'checked'", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-row-working-with-children-check"));
    const sheet = screen.getByTestId("admin-renewals-item-sheet");
    expect(within(sheet).getByText(/A WWC Card lasts three years/)).toBeInTheDocument();
    expect(within(sheet).getByText(/Source: WA Department of Communities/)).toBeInTheDocument();
    expect(sheet.textContent ?? "").not.toMatch(/\bchecked\b/i);
  });

  it("shows the unconfirmed line, not a rule, for a needs-checking item", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-row-professional-indemnity-insurance"));
    const sheet = screen.getByTestId("admin-renewals-item-sheet");
    expect(within(sheet).getByText("Check with your service")).toBeInTheDocument();
    expect(within(sheet).queryByText(/^Registration for medical practitioners/)).toBeNull();
  });

  it("links only the medical registration item to the CPD year check", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-row-medical-registration-renewal"));
    const link = screen.getByTestId("admin-renewals-cpd-link");
    expect(link.textContent).toBe("Open CPD year check");
    expect(link.getAttribute("href")).toBe("/cme/check");
  });
});

describe("AdminRenewalsPage — Add date on a not-recorded item", () => {
  it("opens the new-date sheet blank, with Save grey until a date is typed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entry: {
            ...WWC,
            id: "00000000-0000-4000-8000-000000000099",
            slug: "criminal-record-screening",
            title: "Criminal record screening",
            details: {
              kind: "compliance",
              category: "checks",
              requirementId: "criminal-record-screening",
              expiresOn: "2027-01-01",
            },
          },
        }),
      ),
    );
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-add-date-criminal-record-screening"));
    const save = screen.getByTestId("admin-renewed-save");
    expect(save).toBeDisabled();
    const sheet = within(screen.getByTestId("admin-renewed-sheet"));
    fireEvent.change(sheet.getByLabelText("New expiry date"), { target: { value: "2027-01-01" } });
    expect(screen.getByText("Fri 1 Jan 2027")).toBeInTheDocument();
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/on-call/entries");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.details.requirementId).toBe("criminal-record-screening");
    expect(await screen.findByText("Marked renewed.")).toBeInTheDocument();
  });
});

describe("AdminRenewalsPage — Renewed, from the item sheet", () => {
  it("echoes the typed date and offers Add to my calendar once saved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ entry: { ...ALS, details: { ...(ALS.details as object), expiresOn: "2030-10-14" } } }),
      ),
    );
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-row-als-course-certification"));
    fireEvent.click(screen.getByTestId("admin-renewals-item-sheet-renew"));
    expect(screen.getByText(/Renewed: ALS course certification/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New expiry date"), { target: { value: "2030-10-14" } });
    fireEvent.click(screen.getByTestId("admin-renewed-save"));
    await screen.findByText("Marked renewed.");
    fireEvent.click(screen.getByTestId("admin-renewed-calendar"));
    expect(downloadTextFile).toHaveBeenCalled();
  });
});

describe("AdminRenewalsPage — Not for this job", () => {
  it("moves the item to its own section, updates the count, and offers Undo", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entry: { ...INDEMNITY, details: { ...(INDEMNITY.details as object), notForThisJob: true } },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ entry: INDEMNITY })));
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-checklist-row-professional-indemnity-insurance"));
    fireEvent.click(screen.getByTestId("admin-renewals-item-sheet-not-for-this-job"));

    await waitFor(() =>
      expect(screen.getByTestId("admin-renewals-checklist-not-for-this-job-row-indemnity")).toBeInTheDocument(),
    );
    expect(screen.getByText(/not for this job/)).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-undo-bar")).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId("admin-renewals-undo-bar")).getByText("Undo"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByTestId("admin-renewals-checklist-not-for-this-job-row-indemnity")).toBeNull(),
    );
  });
});

describe("AdminRenewalsPage — Personal tab", () => {
  it("shows the empty state when nothing is off-catalogue", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Personal" }));
    expect(screen.getByText("No personal renewals")).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-personal-empty-add")).toBeInTheDocument();
  });

  it("lists an entry that matches no catalogue item", () => {
    storeState.entries = [
      ...ALL,
      complianceFixture("A car I lease for work", { category: "Personal", expiresOn: "2027-01-01" }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Personal" }));
    expect(screen.getByText("A car I lease for work")).toBeInTheDocument();
    expect(screen.queryByText("Working with Children Check")).toBeNull();
  });

  it("never lists the reader's rows from other On Call sections, or their logistics guides", () => {
    storeState.entries = [
      ...ALL,
      onCallEntryFixture({ section: "contacts", title: "Ward 4 switchboard", details: {} }),
      onCallEntryFixture({ section: "playbook", title: "Agitation first steps", details: {} }),
      onCallEntryFixture({ section: "logistics", title: "Staff car park", details: { category: "Facilities" } }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Personal" }));
    expect(screen.getByText("No personal renewals")).toBeInTheDocument();
    expect(screen.queryByText("Ward 4 switchboard")).toBeNull();
    expect(screen.queryByText("Agitation first steps")).toBeNull();
    expect(screen.queryByText("Staff car park")).toBeNull();
  });

  it("creates a new personal renewal from the Add sheet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entry: complianceFixture(
            "Car registration",
            { category: "Personal", expiresOn: "2027-02-01" },
            { slug: "car-rego" },
          ),
        }),
      ),
    );
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-add"));
    expect(screen.getByTestId("admin-quick-add-save")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Car registration" } });
    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2027-02-01" } });
    expect(screen.getByTestId("admin-quick-add-save")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("admin-quick-add-save"));
    await waitFor(() => expect(screen.queryByTestId("admin-quick-add-sheet")).toBeNull());
  });
});

describe("AdminRenewalsPage — Copy for workforce and Add all to my calendar", () => {
  it("copies the workforce text with its heading", async () => {
    const writeText = vi.fn(async (text: string) => {
      void text;
    });
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^Dates as I recorded them, copied .+; not checked with issuers\n/);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("downloads one calendar file for every dated renewal", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("admin-renewals-calendar-all"));
    expect(downloadTextFile).toHaveBeenCalledWith(
      expect.stringContaining("BEGIN:VCALENDAR"),
      "renewals.ics",
      "text/calendar;charset=utf-8",
    );
  });
});
