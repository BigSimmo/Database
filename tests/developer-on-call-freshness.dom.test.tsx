/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallFreshnessPanel } from "@/components/developer-area/hub/on-call-freshness-panel";
import { type OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function entry(overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string }): OnCallEntry {
  return {
    section: "contacts",
    subtitle: null,
    body: null,
    details: { role: overrides.title },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as OnCallEntry;
}

// Real UUIDs: `onCallEntrySchema` requires one, and the panel drops a row it
// cannot parse rather than inventing a finding from it.
const NEVER_ID = "11111111-1111-4111-8111-111111111111";
const OVERDUE_ID = "22222222-2222-4222-8222-222222222222";
const FRESH_ID = "33333333-3333-4333-8333-333333333333";

const NEVER = entry({ id: NEVER_ID, slug: "ward-4b", title: "Ward 4B", lastVerifiedAt: null });
const OVERDUE = entry({
  id: OVERDUE_ID,
  slug: "bed-manager",
  title: "Bed manager",
  lastVerifiedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
});
const FRESH = entry({ id: FRESH_ID, slug: "switchboard", title: "Switchboard" });

describe("OnCallFreshnessPanel", () => {
  it("counts what is overdue and names each entry with the section it is in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: [NEVER, OVERDUE, FRESH] })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-count-overdue")).toHaveTextContent("2"));
    expect(screen.getByTestId("developer-on-call-freshness-count-never")).toHaveTextContent("1");
    expect(screen.getByTestId(`developer-on-call-freshness-row-${NEVER_ID}`)).toHaveTextContent("Ward 4B");
    expect(screen.getByTestId(`developer-on-call-freshness-row-${OVERDUE_ID}`)).toHaveTextContent("Bed manager");
    // A fresh entry is not a finding.
    expect(screen.queryByTestId(`developer-on-call-freshness-row-${FRESH_ID}`)).toBeNull();
  });

  it("says plainly when nothing is overdue rather than rendering an empty table", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: [FRESH] })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-clear")).toBeInTheDocument());
    expect(screen.queryByTestId(`developer-on-call-freshness-row-${FRESH_ID}`)).toBeNull();
  });

  it("degrades to an error rather than reporting zero overdue when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 500)));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-error")).toBeInTheDocument());
    // The whole point: a failed read must never look like a clean hub.
    expect(screen.queryByTestId("developer-on-call-freshness-clear")).toBeNull();
    expect(screen.queryByTestId("developer-on-call-freshness-count-overdue")).toBeNull();
  });

  it("degrades the same way when the response is a 200 of the wrong shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: "not an array" })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-error")).toBeInTheDocument());
    expect(screen.queryByTestId("developer-on-call-freshness-clear")).toBeNull();
  });

  it("says a signed-out read is partial rather than presenting it as the whole hub", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: [NEVER], signedOut: true })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-partial")).toBeInTheDocument());
  });
});
