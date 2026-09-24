/** @vitest-environment jsdom */
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { CmeEntryRouteClient } from "@/components/cme/cme-entry-route-client";
import { CmeLogPage } from "@/components/cme/cme-log-page";
import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";
import { CmeAnnualSummary } from "@/components/cme/cme-annual-summary";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";
import type { CmeEntry } from "@/lib/cme/types";
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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.refresh.mockReset();
});
describe("Archive, annual record and learning journeys", () => {
  it("retains active controls after failed archive, then restores only after confirmed success", async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Try again" }), { status: 503 }))
      .mockResolvedValue(new Response(JSON.stringify({ entry: { ...entry, archivedAt: "now" } })));
    render(<CmeEntryRouteClient entry={entry} set={set} edit={false} demoMode={false} />);
    // Archiving asks first (2026-09-24): nothing is sent until it is confirmed.
    await user.click(screen.getByRole("button", { name: "Archive entry" }));
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Archive activity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByRole("link", { name: "Edit entry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive entry" }));
    await user.click(screen.getByRole("button", { name: "Archive activity" }));
    await screen.findByRole("button", { name: "Restore entry" });
    expect(screen.queryByRole("link", { name: "Edit entry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy for your CPD home" })).toBeDisabled();
    expect(screen.getByText("Evidence view only")).toBeInTheDocument();
    expect(screen.getByText(/2 hours recorded · excluded from totals/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore entry" }));
    await screen.findByRole("button", { name: "Archive entry" });
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({ archived: false });
  });
  it("closed year retains evidence viewing and disables both archive and restore", () => {
    render(
      <CmeEntryRouteClient
        entry={{ ...entry, archivedAt: "now" }}
        set={{ ...set, closedAt: "now" }}
        edit
        demoMode={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Restore entry" })).toBeDisabled();
    expect(screen.getByText("Evidence view only")).toBeInTheDocument();
  });
  it("log defaults active and filters actual uploaded evidence separately from sources", async () => {
    const user = userEvent.setup();
    render(
      <CmeLogPage
        set={set}
        entries={[
          { ...entry, sourceUrl: "/learning", evidenceCount: 0 },
          { ...entry, id: "b", title: "With evidence", evidenceCount: 1 },
          { ...entry, id: "c", title: "Archived record", archivedAt: "now" },
        ]}
      />,
    );
    expect(screen.queryByText("Archived record")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Missing evidence" }));
    expect(screen.queryByText("With evidence")).toBeNull();
    expect(screen.getByText("Synthetic activity")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show archived entries" }));
    expect(screen.getByText("Archived record")).toBeInTheDocument();
  });
  it("learning prefill requires explicit duration and allocations and never saves on opening", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    render(
      <CmeNewEntryRoute set={set} learningPrefill={{ title: "Handbook learning", sourceUrl: "/on-call/handbook" }} />,
    );
    expect(screen.getByDisplayValue("Handbook learning")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/on-call/handbook")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });
  it("prints the selected year only and invokes the browser print action", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <CmeAnnualSummary
        set={set}
        entries={[
          entry,
          { ...entry, id: "old", date: "2025-01-01", title: "Wrong year" },
          { ...entry, id: "archived", title: "Archived", archivedAt: "now" },
        ]}
      />,
    );
    expect(screen.queryByText(/Wrong year/)).toBeNull();
    expect(screen.queryByText("2026-09-01 — Archived")).toBeNull();
    expect(screen.getByText(/1 active activities/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Print annual summary" }));
    expect(print).toHaveBeenCalledOnce();
  });
});
