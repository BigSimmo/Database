import { describe, expect, it } from "vitest";

import { onCallCallNowPeriod, onCallCallNowScenarios, onCallCallNowSteps } from "@/lib/on-call/call-now";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { buildOnCallReviewQueue, onCallReviewDueAt } from "@/lib/on-call/review-queue";
import { isWaPublicHoliday, WA_PUBLIC_HOLIDAYS, WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/lib/on-call/wa-public-holidays";

function entry(overrides: Partial<OnCallEntry> & Pick<OnCallEntry, "id" | "section">): OnCallEntry {
  return {
    slug: overrides.id,
    title: `Entry ${overrides.id}`,
    subtitle: null,
    body: null,
    details: overrides.section === "contacts" ? { role: "Registrar" } : {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

const LADDER = entry({
  id: "ladder",
  section: "playbook",
  details: {
    trigger: "Agitated patient",
    escalationSteps: [
      { order: 1, whoToCall: "Nurse in charge", when: "First" },
      { order: 2, whoToCall: "Day consultant", when: "Weekdays", phone: "08 9000 0001", hours: "in-hours" },
      { order: 3, whoToCall: "Consultant on call", when: "Nights", phone: "08 9000 0002", hours: "after-hours" },
    ],
  },
});

// Working hours are read in the viewer's own zone (`isOnCallOutOfHours`), so
// these are local wall-clock times: 10:00 on a Tuesday, and 10:00 on the WA
// King's Birthday holiday.
const TUESDAY_MORNING = new Date(2026, 8, 22, 10, 0);
const KINGS_BIRTHDAY_MORNING = new Date(2026, 8, 28, 10, 0);

describe("who do I call now", () => {
  it("leads with the in-hours steps on a working morning, keeping the others below", () => {
    const steps = onCallCallNowSteps(LADDER, TUESDAY_MORNING);
    expect(steps.map((step) => step.whoToCall)).toEqual(["Nurse in charge", "Day consultant", "Consultant on call"]);
    expect(steps.map((step) => step.appliesNow)).toEqual([true, true, false]);
  });

  it("treats a WA public holiday as after hours", () => {
    expect(onCallCallNowPeriod(KINGS_BIRTHDAY_MORNING)).toBe("after-hours");
    const steps = onCallCallNowSteps(LADDER, KINGS_BIRTHDAY_MORNING);
    expect(steps.map((step) => step.whoToCall)).toEqual(["Nurse in charge", "Consultant on call", "Day consultant"]);
  });

  it("lists only playbook entries as scenarios, in the owner's order", () => {
    const contact = entry({ id: "c", section: "contacts" });
    const second = { ...LADDER, id: "second", title: "B", sortOrder: 2 };
    expect(onCallCallNowScenarios([second, contact, LADDER]).map((item) => item.id)).toEqual(["ladder", "second"]);
  });

  it("still parses a ladder saved before steps had hours", () => {
    const old = entry({
      id: "old",
      section: "playbook",
      details: { trigger: "x", escalationSteps: [{ order: 1, whoToCall: "A", when: "B" }] },
    });
    expect(onCallCallNowSteps(old, TUESDAY_MORNING)[0]).toMatchObject({ hours: "any", appliesNow: true });
  });
});

describe("WA public holidays", () => {
  it("reads the date in Perth, not UTC", () => {
    // 16:30Z on 27 September is 00:30 on 28 September in Perth.
    expect(isWaPublicHoliday(new Date("2026-09-27T16:30:00Z"))).toBe(true);
    expect(isWaPublicHoliday(new Date("2026-09-27T15:30:00Z"))).toBe(false);
  });

  it("covers every year up to the last listed one", () => {
    for (let year = 2026; year <= WA_PUBLIC_HOLIDAYS_LAST_YEAR; year += 1) {
      expect([...WA_PUBLIC_HOLIDAYS].filter((date) => date.startsWith(`${year}-`)).length).toBeGreaterThanOrEqual(11);
    }
  });
});

describe("review queue", () => {
  const NOW = new Date("2026-09-25T02:00:00Z");

  it("groups never checked, overdue and due within 30 days, and leaves the rest out", () => {
    const queue = buildOnCallReviewQueue(
      [
        entry({ id: "never", section: "contacts" }),
        entry({ id: "overdue", section: "contacts", lastVerifiedAt: "2025-08-01T00:00:00Z" }),
        entry({ id: "soon", section: "contacts", lastVerifiedAt: "2025-10-10T00:00:00Z" }),
        entry({ id: "fine", section: "contacts", lastVerifiedAt: "2026-06-01T00:00:00Z" }),
        entry({ id: "theirs", section: "contacts", isOwn: false }),
      ],
      NOW,
    );
    expect(queue.neverChecked.map((item) => item.entry.id)).toEqual(["never"]);
    expect(queue.overdue.map((item) => item.entry.id)).toEqual(["overdue"]);
    expect(queue.dueSoon.map((item) => item.entry.id)).toEqual(["soon"]);
    expect(queue.total).toBe(3);
  });

  it("leaves compliance records out", () => {
    const compliance = entry({
      id: "ahpra",
      section: "logistics",
      details: { category: "Registration", kind: "compliance" },
    });
    expect(buildOnCallReviewQueue([compliance], NOW).total).toBe(0);
  });

  it("clamps a leap-day check to the end of February", () => {
    expect(onCallReviewDueAt("2028-02-29T00:00:00Z")?.toISOString()).toBe("2029-02-28T00:00:00.000Z");
    expect(onCallReviewDueAt(null)).toBeNull();
  });
});
