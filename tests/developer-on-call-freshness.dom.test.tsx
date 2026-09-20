/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnCallFreshnessPanel } from "@/components/developer-area/hub/on-call-freshness-panel";
import {
  ON_CALL_SECTION_HREFS,
  ON_CALL_SECTION_TITLES,
  ON_CALL_VIEW_HREFS,
  ON_CALL_VIEW_TITLES,
  onCallViewForEntry,
  type OnCallPageView,
} from "@/components/on-call/on-call-section-identity";
import { partitionLogisticsEntries } from "@/lib/on-call/compliance";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
import { partitionContactsEntries } from "@/lib/on-call/who-is-who";

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

  it("never reports an all-clear when every row was unreadable", async () => {
    // Codex P2 on PR #2806. Dropping an unparseable row keeps the panel useful
    // when one entry is malformed, but during a client/API schema skew EVERY row
    // is rejected and the panel then said "Nothing is overdue" about a response
    // it could not read. That is the false all-clear this panel's own error
    // state exists to prevent -- a maintainer acts on it by doing nothing.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: [{ id: "not-a-uuid" }, { nope: 1 }] })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-error")).toBeInTheDocument());
    expect(screen.queryByTestId("developer-on-call-freshness-clear")).toBeNull();
  });

  it("says how many rows it could not read rather than quietly undercounting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ entries: [NEVER, { id: "not-a-uuid" }, { also: "broken" }] })),
    );

    render(<OnCallFreshnessPanel />);

    const skipped = await screen.findByTestId("developer-on-call-freshness-skipped");
    expect(skipped).toHaveTextContent("2");
    // The count it does show is still shown, because a partial answer beats none.
    expect(screen.getByTestId("developer-on-call-freshness-count-overdue")).toHaveTextContent("1");
  });

  it("says nothing about skipped rows when every row parsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: [NEVER, FRESH] })));

    render(<OnCallFreshnessPanel />);

    await waitFor(() => expect(screen.getByTestId("developer-on-call-freshness-count-overdue")).toHaveTextContent("1"));
    expect(screen.queryByTestId("developer-on-call-freshness-skipped")).toBeNull();
  });
});

/**
 * The overdue list must route by VIEW, not by stored section.
 *
 * Two of this mode's pages are views over a stored section behind
 * `details.kind` — Compliance over `logistics`, Who's who over `contacts`. Read
 * off `entry.section`, a never-confirmed registration was labelled "Admin" and
 * linked to `/on-call/logistics`, where the Admin page correctly refuses to
 * render it. Of every list in the app this is the worst place for a dead end:
 * its entire purpose is to send a maintainer to the row nobody has confirmed.
 *
 * The rows below are the real demo corpus, not invented fixtures, so the test
 * also fails if the corpus stops carrying the case. No label or href is
 * retyped here: every expectation is read from the view maps, and which row is
 * which is asked of the partition functions that own those splits.
 */
function demoEntry(slug: string): OnCallEntry {
  const found = DEMO_ON_CALL_ENTRIES.find((row) => row.slug === slug);
  if (!found) throw new Error(`The demo corpus no longer carries "${slug}".`);
  return found;
}

/** Compliance, never confirmed — already in this panel's list as it stands. */
const DEMO_CLEARANCE = demoEntry("demo-national-police-clearance");
/** An ordinary Admin row, also never confirmed: the control. */
const DEMO_LEAVE = demoEntry("demo-annual-and-parental-leave");
/**
 * A real role explainer with its confirmation cleared. Every explainer in the
 * corpus is confirmed recently, so there is no never-confirmed one to borrow —
 * this is the smallest possible departure from the corpus rather than a
 * fixture built to suit the assertion.
 */
const DEMO_ROLE_EXPLAINER: OnCallEntry = { ...demoEntry("demo-role-registrar"), lastVerifiedAt: null };

const VIEW_ROWS = [DEMO_CLEARANCE, DEMO_LEAVE, DEMO_ROLE_EXPLAINER];

async function expectOverdueRowFiledUnder(row: OnCallEntry, view: OnCallPageView) {
  const rendered = await screen.findByTestId(`developer-on-call-freshness-row-${row.id}`);
  expect(within(rendered).getByRole("link", { name: row.title })).toHaveAttribute("href", ON_CALL_VIEW_HREFS[view]);
  expect(rendered).toHaveTextContent(ON_CALL_VIEW_TITLES[view]);
}

/** The fixture is only a test of the defect while the two maps disagree on it. */
function expectViewDisagreesWithSection(row: OnCallEntry, view: OnCallPageView) {
  expect(ON_CALL_VIEW_HREFS[view]).not.toBe(ON_CALL_SECTION_HREFS[row.section]);
  expect(ON_CALL_VIEW_TITLES[view]).not.toBe(ON_CALL_SECTION_TITLES[row.section]);
}

describe("OnCallFreshnessPanel — overdue rows are routed by view", () => {
  it("has a never-confirmed compliance requirement in the demo corpus to route", () => {
    const { compliance, admin } = partitionLogisticsEntries(VIEW_ROWS);
    expect(compliance).toEqual([DEMO_CLEARANCE]);
    expect(admin).toEqual([DEMO_LEAVE]);
    expect(partitionContactsEntries(VIEW_ROWS).roleExplainers).toEqual([DEMO_ROLE_EXPLAINER]);
    // All three are in this panel's list, which is what puts them at risk.
    for (const row of VIEW_ROWS) {
      expect(onCallEntryFreshness(row, new Date())).toEqual({
        state: "stale",
        reason: "never-verified",
        lastVerifiedAt: null,
      });
    }
  });

  it("sends an overdue compliance requirement to Compliance, and names it Compliance", async () => {
    const view = onCallViewForEntry(DEMO_CLEARANCE);
    expectViewDisagreesWithSection(DEMO_CLEARANCE, view);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: VIEW_ROWS })));
    render(<OnCallFreshnessPanel />);

    await expectOverdueRowFiledUnder(DEMO_CLEARANCE, view);
    // The name of the page it is not on must not appear on the row at all.
    expect(screen.getByTestId(`developer-on-call-freshness-row-${DEMO_CLEARANCE.id}`)).not.toHaveTextContent(
      ON_CALL_SECTION_TITLES[DEMO_CLEARANCE.section],
    );
  });

  it("sends an overdue role explainer to Who's who, and names it Who's who", async () => {
    const view = onCallViewForEntry(DEMO_ROLE_EXPLAINER);
    expectViewDisagreesWithSection(DEMO_ROLE_EXPLAINER, view);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: VIEW_ROWS })));
    render(<OnCallFreshnessPanel />);

    await expectOverdueRowFiledUnder(DEMO_ROLE_EXPLAINER, view);
    expect(screen.getByTestId(`developer-on-call-freshness-row-${DEMO_ROLE_EXPLAINER.id}`)).not.toHaveTextContent(
      ON_CALL_SECTION_TITLES[DEMO_ROLE_EXPLAINER.section],
    );
  });

  it("leaves an ordinary Admin row pointing at the Admin page", async () => {
    const view = onCallViewForEntry(DEMO_LEAVE);
    // For a row that is not a view, the two maps must still agree.
    expect(ON_CALL_VIEW_HREFS[view]).toBe(ON_CALL_SECTION_HREFS[DEMO_LEAVE.section]);
    expect(ON_CALL_VIEW_TITLES[view]).toBe(ON_CALL_SECTION_TITLES[DEMO_LEAVE.section]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entries: VIEW_ROWS })));
    render(<OnCallFreshnessPanel />);

    await expectOverdueRowFiledUnder(DEMO_LEAVE, view);
  });
});
