import { describe, expect, it } from "vitest";

import { ON_CALL_REVIEW_INTERVAL_MONTHS, type OnCallEntry } from "@/lib/on-call/entry-model";
import { summariseOnCallFreshness } from "@/lib/on-call/freshness-summary";
import { ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";

/**
 * The summary must carry `onCallEntryFreshness`'s answers, not re-derive them.
 * So the cases pinned here are the ones where a second implementation would
 * drift: the exact twelve-month boundary, a day either side of it, an entry
 * nobody has ever checked, and a date string nothing can read.
 */

const NOW = new Date("2026-09-16T00:00:00.000Z");

/** `months` before NOW, to the day, as the ISO string an entry actually stores. */
function monthsBefore(months: number, dayOffset = 0): string {
  const at = new Date(NOW.getTime());
  at.setUTCMonth(at.getUTCMonth() - months);
  at.setUTCDate(at.getUTCDate() + dayOffset);
  return at.toISOString();
}

let seq = 0;
function entry(overrides: Partial<OnCallEntry> & { section: OnCallEntry["section"] }): OnCallEntry {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${`${seq}`.padStart(12, "0")}`,
    slug: `entry-${seq}`,
    title: `Entry ${seq}`,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("summariseOnCallFreshness — the twelve-month boundary", () => {
  it("counts an entry verified exactly the review interval ago as stale", () => {
    const onTheDay = entry({ section: "contacts", lastVerifiedAt: monthsBefore(ON_CALL_REVIEW_INTERVAL_MONTHS) });
    const summary = summariseOnCallFreshness([onTheDay], NOW);
    expect(summary.staleCount).toBe(1);
    expect(summary.stale[0]?.freshness.reason).toBe("overdue");
  });

  it("counts an entry verified a day earlier than the interval as stale", () => {
    const dayBefore = entry({
      section: "contacts",
      lastVerifiedAt: monthsBefore(ON_CALL_REVIEW_INTERVAL_MONTHS, -1),
    });
    expect(summariseOnCallFreshness([dayBefore], NOW).staleCount).toBe(1);
  });

  it("leaves an entry verified a day later than the interval out of the summary", () => {
    const dayAfter = entry({
      section: "contacts",
      lastVerifiedAt: monthsBefore(ON_CALL_REVIEW_INTERVAL_MONTHS, 1),
    });
    const summary = summariseOnCallFreshness([dayAfter], NOW);
    expect(summary.staleCount).toBe(0);
    expect(summary.stale).toEqual([]);
  });

  it("treats a never-verified entry as stale, with the reason the badge uses", () => {
    const never = entry({ section: "playbook", lastVerifiedAt: null });
    const summary = summariseOnCallFreshness([never], NOW);
    expect(summary.staleCount).toBe(1);
    expect(summary.stale[0]?.freshness).toEqual({ state: "stale", reason: "never-verified", lastVerifiedAt: null });
    expect(summary.neverVerifiedCount).toBe(1);
    expect(summary.overdueCount).toBe(0);
  });

  it("treats an unparseable date as never verified rather than fresh", () => {
    const unreadable = entry({ section: "logistics", lastVerifiedAt: "sometime last winter" });
    const summary = summariseOnCallFreshness([unreadable], NOW);
    expect(summary.staleCount).toBe(1);
    expect(summary.stale[0]?.freshness).toEqual({ state: "stale", reason: "never-verified", lastVerifiedAt: null });
  });
});

describe("summariseOnCallFreshness — what it reports", () => {
  it("returns a zeroed summary rather than null for no entries", () => {
    const summary = summariseOnCallFreshness([], NOW);
    expect(summary.staleCount).toBe(0);
    expect(summary.neverVerifiedCount).toBe(0);
    expect(summary.overdueCount).toBe(0);
    expect(summary.stale).toEqual([]);
    expect(summary.sections).toEqual([]);
    expect(summary.bySection.size).toBe(0);
  });

  it("breaks the stale count down by section and leaves fresh sections out", () => {
    const summary = summariseOnCallFreshness(
      [
        entry({ section: "contacts", lastVerifiedAt: null }),
        entry({ section: "contacts", lastVerifiedAt: monthsBefore(24) }),
        entry({ section: "referrals", lastVerifiedAt: null }),
        entry({ section: "education", lastVerifiedAt: NOW.toISOString() }),
      ],
      NOW,
    );
    expect(summary.staleCount).toBe(3);
    expect(summary.bySection.get("contacts")).toBe(2);
    expect(summary.bySection.get("referrals")).toBe(1);
    expect(summary.bySection.has("education")).toBe(false);
    // Worst section first, so a capped strip shows the sections that matter.
    expect(summary.sections).toEqual(["contacts", "referrals"]);
  });

  it("orders stale entries worst-first: never verified, then oldest overdue", () => {
    const summary = summariseOnCallFreshness(
      [
        entry({ section: "contacts", title: "Recently overdue", lastVerifiedAt: monthsBefore(13) }),
        entry({ section: "contacts", title: "Long overdue", lastVerifiedAt: monthsBefore(40) }),
        entry({ section: "contacts", title: "Never checked", lastVerifiedAt: null }),
      ],
      NOW,
    );
    expect(summary.stale.map((row) => row.entry.title)).toEqual(["Never checked", "Long overdue", "Recently overdue"]);
  });

  it("breaks ties deterministically by sortOrder, then title", () => {
    const summary = summariseOnCallFreshness(
      [
        entry({ section: "contacts", title: "Beta", sortOrder: 5, lastVerifiedAt: null }),
        entry({ section: "contacts", title: "Alpha", sortOrder: 5, lastVerifiedAt: null }),
        entry({ section: "contacts", title: "Zulu", sortOrder: 1, lastVerifiedAt: null }),
      ],
      NOW,
    );
    expect(summary.stale.map((row) => row.entry.title)).toEqual(["Zulu", "Alpha", "Beta"]);
  });

  it("counts role explainers, because a wrong description of a role misleads like a wrong number", () => {
    const explainer = entry({
      section: "contacts",
      title: "What the psych registrar covers",
      details: { role: "Psych registrar", kind: ROLE_EXPLAINER_KIND },
      lastVerifiedAt: null,
    });
    const summary = summariseOnCallFreshness([explainer], NOW);
    expect(summary.staleCount).toBe(1);
    expect(summary.bySection.get("contacts")).toBe(1);
  });

  it("defaults `now` to the present, so a caller that passes nothing still gets an answer", () => {
    const summary = summariseOnCallFreshness([entry({ section: "orientation", lastVerifiedAt: null })]);
    expect(summary.staleCount).toBe(1);
  });
});
