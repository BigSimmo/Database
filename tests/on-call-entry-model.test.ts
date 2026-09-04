import { describe, expect, it } from "vitest";
import {
  ON_CALL_REVIEW_INTERVAL_MONTHS,
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
} from "@/lib/on-call/entry-model";
import { selectCardEntries } from "@/lib/on-call/card-selection";

const NOW = new Date("2026-09-04T00:00:00.000Z");

describe("onCallEntryFreshness", () => {
  it("is stale when the entry has never been verified", () => {
    expect(onCallEntryFreshness({ lastVerifiedAt: null }, NOW)).toEqual({
      state: "stale",
      reason: "never-verified",
      lastVerifiedAt: null,
    });
  });

  it("is fresh one day inside the interval", () => {
    const justInside = new Date("2025-09-05T00:00:00.000Z").toISOString();
    expect(onCallEntryFreshness({ lastVerifiedAt: justInside }, NOW).state).toBe("fresh");
  });

  it("is stale exactly on the twelve-month boundary", () => {
    const onBoundary = new Date("2025-09-04T00:00:00.000Z").toISOString();
    expect(onCallEntryFreshness({ lastVerifiedAt: onBoundary }, NOW)).toEqual({
      state: "stale",
      reason: "overdue",
      lastVerifiedAt: onBoundary,
    });
  });

  it("uses a twelve-month interval", () => {
    expect(ON_CALL_REVIEW_INTERVAL_MONTHS).toBe(12);
  });

  it("does not let a leap-day entry stay fresh past its anniversary", () => {
    const leapDay = new Date("2024-02-29T00:00:00.000Z").toISOString();
    const dayAfterDue = new Date("2025-03-01T00:00:00.000Z");
    expect(onCallEntryFreshness({ lastVerifiedAt: leapDay }, dayAfterDue).state).toBe("stale");
    const onDue = new Date("2025-02-28T00:00:00.000Z");
    expect(onCallEntryFreshness({ lastVerifiedAt: leapDay }, onDue).state).toBe("stale");
  });
});

describe("onCallDetailsSchemaFor", () => {
  it("accepts a contact carrying only a role", () => {
    const parsed = onCallDetailsSchemaFor("contacts").safeParse({ role: "After-hours registrar" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a contact with no role", () => {
    expect(onCallDetailsSchemaFor("contacts").safeParse({ phone: "9999 9999" }).success).toBe(false);
  });

  it("rejects unknown keys, so a typo cannot be silently stored", () => {
    const parsed = onCallDetailsSchemaFor("contacts").safeParse({
      role: "Ward 4B",
      phne: "9999 9999",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an ordered escalation step to name who to call and when", () => {
    const parsed = onCallDetailsSchemaFor("playbook").safeParse({
      trigger: "Acute behavioural disturbance",
      escalationSteps: [{ order: 1, whoToCall: "In-house registrar", when: "Immediately" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("a date we cannot read", () => {
  // Fails to stale, never to fresh. `new Date("not-a-date").getTime()` is NaN,
  // and every comparison against NaN is false — so the overdue branch would
  // fall through and report a corrupt entry as freshly checked.
  it("treats an unparseable last-verified date as never verified", () => {
    const freshness = onCallEntryFreshness({ lastVerifiedAt: "not-a-date" }, new Date("2026-09-04T00:00:00.000Z"));
    expect(freshness.state).toBe("stale");
    expect(freshness.state === "stale" && freshness.reason).toBe("never-verified");
  });

  it("keeps an entry with an unreadable date off the printable card", () => {
    const entries = [
      {
        id: "a",
        slug: "corrupt",
        section: "contacts" as const,
        title: "Corrupt date",
        subtitle: null,
        body: null,
        details: { role: "Switchboard" },
        linkedDocumentIds: [],
        tags: [],
        isPersonal: false,
        includeOnCard: true,
        sortOrder: 0,
        lastVerifiedAt: "2026-13-45T99:99:99Z",
      },
    ];
    expect(selectCardEntries(entries, new Date("2026-09-04T00:00:00.000Z"))).toEqual([]);
  });
});
