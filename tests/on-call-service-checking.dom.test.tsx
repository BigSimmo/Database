/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceCheckingPanel } from "@/components/on-call/service-checking-panel";
import type { ServiceDetail, ServiceEntry, ServiceReport } from "@/lib/on-call/service-model";

// Synthetic ids and content only (plan GC9).
const SITE = "30000000-0000-4000-8000-00000000000a";
const OTHER_SITE = "30000000-0000-4000-8000-00000000000b";
const NOW = new Date("2026-09-26T04:00:00Z");

function published(id: string, title: string, updatedAt: string, over: Partial<ServiceEntry> = {}): ServiceEntry {
  const content = {
    siteId: SITE,
    section: "contacts" as const,
    kind: "operational" as const,
    title,
    body: "Synthetic example only",
    phone: "9000 0001",
    sources: [],
    orientationPhase: "first_shift" as const,
  };
  return {
    id,
    revision: 1,
    publishedRevision: 1,
    content,
    publishedContent: content,
    status: "published",
    authorId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: "",
    updatedAt,
    ...over,
  };
}

function report(entryId: string, reason: string, status: ServiceReport["status"] = "open"): ServiceReport {
  return {
    id: `report-${entryId}-${reason.length}-${status}`,
    entryId,
    reason,
    status,
    resolution: "",
    createdAt: "2026-09-25T00:00:00Z",
  };
}

function detail(entries: ServiceEntry[], reports: ServiceReport[] = []): Pick<ServiceDetail, "entries" | "reports"> {
  return { entries, reports };
}

afterEach(() => cleanup());

describe("ServiceCheckingPanel", () => {
  it("lists published entries oldest first with open reports and dated lines, and never says Checked", () => {
    const d = detail(
      [
        published("new", "Switchboard", "2026-09-20T00:00:00Z"),
        published("old", "ICU: Registrar", "2025-07-01T00:00:00Z"),
      ],
      [report("old", "Number not in service"), report("new", "Reaches the wrong department", "resolved")],
    );
    render(<ServiceCheckingPanel detail={d} onEdit={vi.fn()} now={NOW} />);
    const rows = screen.getAllByTestId(/^service-checking-row-/).map((row) => row.getAttribute("data-testid"));
    expect(rows).toEqual(["service-checking-row-old", "service-checking-row-new"]);
    const old = screen.getByTestId("service-checking-row-old");
    expect(within(old).getByText("1 open report")).toBeInTheDocument();
    expect(within(old).getByText("Number not in service")).toBeInTheDocument();
    expect(within(old).getByTestId("on-call-updated-date").textContent).toBe("Updated 1 Jul 2025 · 1 year ago");
    expect(within(screen.getByTestId("service-checking-row-new")).queryByText(/open report/)).toBeNull();
    expect(screen.queryByText(/checked/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Check these/ })).toHaveAttribute("href", "/on-call/check");
  });

  it("keeps to this site and leaves out withdrawn and never-published entries", () => {
    const d = detail([
      published("here", "Switchboard", "2026-09-20T00:00:00Z"),
      published("wide", "Service-wide line", "2026-09-19T00:00:00Z", {
        content: { ...published("x", "Service-wide line", "").content, siteId: null },
        publishedContent: { ...published("x", "Service-wide line", "").content, siteId: null },
      }),
      published("there", "Other site", "2026-09-20T00:00:00Z", {
        content: { ...published("x", "Other site", "").content, siteId: OTHER_SITE },
        publishedContent: { ...published("x", "Other site", "").content, siteId: OTHER_SITE },
      }),
      published("gone", "Withdrawn line", "2026-09-20T00:00:00Z", { status: "withdrawn" }),
      published("draft", "Draft line", "2026-09-20T00:00:00Z", { status: "draft", publishedContent: null }),
    ]);
    render(<ServiceCheckingPanel detail={d} siteId={SITE} onEdit={vi.fn()} now={NOW} />);
    expect(screen.getAllByTestId(/^service-checking-row-/).map((row) => row.getAttribute("data-testid"))).toEqual([
      "service-checking-row-wide",
      "service-checking-row-here",
    ]);
  });

  it("filters to open reports or entries updated over 12 months ago", async () => {
    const d = detail(
      [
        published("new", "Switchboard", "2026-09-20T00:00:00Z"),
        published("old", "ICU: Registrar", "2025-07-01T00:00:00Z"),
        published("reported", "Ward: 4B", "2026-09-01T00:00:00Z"),
      ],
      [report("reported", "Reaches the wrong department")],
    );
    render(<ServiceCheckingPanel detail={d} onEdit={vi.fn()} now={NOW} />);
    const ids = () => screen.getAllByTestId(/^service-checking-row-/).map((row) => row.getAttribute("data-testid"));
    await userEvent.click(screen.getByRole("button", { name: "Has open reports" }));
    expect(ids()).toEqual(["service-checking-row-reported"]);
    await userEvent.click(screen.getByRole("button", { name: "Updated over 12 months ago" }));
    expect(ids()).toEqual(["service-checking-row-old"]);
  });

  it("opens the entry in the editor from its Edit button", async () => {
    const onEdit = vi.fn();
    const entry = published("old", "ICU: Registrar", "2025-07-01T00:00:00Z");
    render(<ServiceCheckingPanel detail={detail([entry])} onEdit={onEdit} now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit ICU: Registrar" }));
    expect(onEdit).toHaveBeenCalledWith(entry);
  });
});
