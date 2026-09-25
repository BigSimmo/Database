/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { CmeEntryRouteClient } from "@/components/cme/cme-entry-route-client";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";
import type { CmeEntry, CmeYearClose } from "@/lib/cme/types";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("@/components/cme/cme-evidence-panel", () => ({
  CmeEvidencePanel: ({ readOnly }: { readOnly: boolean }) => (
    <section aria-label="Evidence">{readOnly ? "Evidence view only" : "Evidence uploads enabled"}</section>
  ),
}));

const set = createAustralianRanzcpPreset(2026, "2026-01-01");
const entry: CmeEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  date: "2026-09-01",
  title: "Synthetic activity",
  allocations: [{ category: "educational", hours: 2 }],
  formalPeerReviewHours: 0,
  reflection: "",
  costCents: null,
  transcribed: false,
  routineId: null,
  documentId: null,
  buckets: [],
};
const close: CmeYearClose = {
  closedAt: "2026-12-20T02:00:00Z",
  shortfallNote: "Parental leave from August",
  totalHours: 2,
  targetHours: set.totalHours,
  entryCount: 1,
  requirements: [{ requirementId: "total", label: "Total CPD hours", met: false, summary: "48 hours short" }],
  amendments: [
    {
      id: "a1",
      entryId: entry.id,
      amendedAt: "2027-01-10T02:00:00Z",
      reason: "Certificate shows 4 hours",
      before: { date: "2026-09-01", title: "Synthetic activity", allocations: [{ category: "educational", hours: 2 }] },
      after: { date: "2026-09-01", title: "Synthetic activity", allocations: [{ category: "educational", hours: 4 }] },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.refresh.mockReset();
  nav.push.mockReset();
});

describe("closing a year from the annual summary", () => {
  it("says when the year can be closed instead of offering the button early", () => {
    render(<CmeAnnualSummary set={set} entries={[entry]} now={new Date("2026-09-19T02:00:00Z")} />);
    expect(screen.getByTestId("cme-year-close-not-yet")).toHaveTextContent("You can close 2026 from 17 December 2026.");
    expect(screen.queryByTestId("cme-year-close")).toBeNull();
  });

  it("is read-only in demo mode", () => {
    render(<CmeAnnualSummary set={set} entries={[entry]} demoMode now={new Date("2026-12-28T02:00:00Z")} />);
    expect(screen.getByText(/Demo mode is read-only/)).toBeInTheDocument();
    expect(screen.queryByTestId("cme-year-close")).toBeNull();
  });

  it("asks first, then closes with the note and refreshes the page", async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ close })));
    render(<CmeAnnualSummary set={set} entries={[entry]} now={new Date("2026-12-28T02:00:00Z")} />);
    expect(screen.getByLabelText(/Note on a shortfall/)).toHaveAccessibleDescription(/does not reduce the requirement/);
    await user.type(screen.getByLabelText(/Note on a shortfall/), "Parental leave from August");
    await user.click(screen.getByTestId("cme-year-close"));
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, close 2026" }));
    expect(fetcher).toHaveBeenCalledWith("/api/cme/year/close", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      year: 2026,
      shortfallNote: "Parental leave from August",
    });
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("shows a refusal from the server and does not pretend the year closed", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Your record changed while the year was being closed." }), {
        status: 409,
      }),
    );
    render(<CmeAnnualSummary set={set} entries={[entry]} now={new Date("2026-12-28T02:00:00Z")} />);
    await user.click(screen.getByTestId("cme-year-close"));
    await user.click(screen.getByRole("button", { name: "Yes, close 2026" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/record changed/);
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("shows a closed year's snapshot, its note and every dated amendment", () => {
    render(
      <CmeAnnualSummary
        set={{ ...set, closedAt: close.closedAt }}
        entries={[{ ...entry, allocations: [{ category: "educational", hours: 4 }] }]}
        close={close}
        now={new Date("2027-01-12T02:00:00Z")}
      />,
    );
    const record = screen.getByTestId("cme-year-closed-record");
    expect(record).toHaveTextContent("2026 closed on 20 December 2026");
    expect(record).toHaveTextContent(`At closing: 2 of ${set.totalHours} hours from 1 activity.`);
    expect(record).toHaveTextContent("Parental leave from August");
    expect(record).toHaveTextContent("It does not reduce any requirement.");
    expect(screen.getByTestId("cme-year-amendments")).toHaveTextContent(
      "10 January 2027: Synthetic activity2 h on 1 September 2026 → 4 h on 1 September 2026Reason: Certificate shows 4 hours",
    );
    expect(screen.queryByTestId("cme-year-close")).toBeNull();
  });
});

describe("amending an activity in a closed year", () => {
  const closedSet = { ...set, closedAt: close.closedAt };

  it("offers Amend entry, not Edit entry, and keeps evidence view-only", () => {
    render(<CmeEntryRouteClient entry={entry} set={closedSet} edit={false} demoMode={false} />);
    expect(screen.getByRole("link", { name: "Amend entry" })).toHaveAttribute("href", `/cme/log/${entry.id}?edit=1`);
    expect(screen.queryByRole("link", { name: "Edit entry" })).toBeNull();
    expect(screen.getByText("Evidence view only")).toBeInTheDocument();
  });

  it("does not offer an amendment for an archived activity", () => {
    render(
      <CmeEntryRouteClient
        entry={{ ...entry, archivedAt: "2026-10-01" }}
        set={closedSet}
        edit={false}
        demoMode={false}
      />,
    );
    expect(screen.queryByRole("link", { name: "Amend entry" })).toBeNull();
  });

  it("requires a reason and sends it with the complete record", async () => {
    const user = userEvent.setup();
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ entry })));
    render(<CmeEntryRouteClient entry={entry} set={closedSet} edit demoMode={false} />);
    expect(screen.getByRole("heading", { name: "Amend activity" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record amendment" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(await screen.findByText("Give a reason for this amendment before recording it.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Reason for this amendment/), "Certificate shows 4 hours");
    await user.click(screen.getByRole("button", { name: "Record amendment" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(body).toMatchObject({ amendmentReason: "Certificate shows 4 hours", title: entry.title, date: entry.date });
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: "PATCH" });
  });
});
