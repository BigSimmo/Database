import { describe, expect, it } from "vitest";

import { adminMyDayItems, onCallMyDayItems } from "@/components/my-day/sources/entries";
import { teachingMyDayItems } from "@/components/my-day/sources/teaching";
import { withUnit } from "@/components/teaching/teaching-number";
import { selectNeedsYou } from "@/lib/admin/today-selectors";
import { deriveOnCallNotifications } from "@/lib/on-call/notifications";
import { DEFAULT_REMINDER_SETTINGS, updateReminderType } from "@/lib/reminders/settings";
import type { SessionRef, TeachRead } from "@/lib/teaching/depth-model";
import { complianceFixture, onCallEntryFixture } from "./helpers/on-call-entry-fixture";

// 09:00 on Sat 26 Sep 2026 in Perth, fixed in UTC so the Perth day never depends on the machine.
const NOW = new Date("2026-09-26T01:00:00Z");

const remindersOff = (type: "compliance-dates" | "on-call-checks" | "teaching") =>
  updateReminderType(DEFAULT_REMINDER_SETTINGS, type, { showInApp: false });

describe("adminMyDayItems", () => {
  const passed = complianceFixture("Fire training", { category: "Training", expiresOn: "2026-09-01" });
  const soon = complianceFixture("Medical registration", { category: "Registration", expiresOn: "2026-09-30" });
  const later = complianceFixture("Basic life support", { category: "Training", expiresOn: "2027-03-01" });

  it("lists every dated row with severity from its date and honest wording", () => {
    const items = adminMyDayItems([passed, soon, later], NOW);
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.get(`my-work:date:${passed.id}`)).toMatchObject({
      mode: "my-work",
      title: "Fire training",
      due: "2026-09-01",
      severity: "overdue",
      detail: "Date has passed",
      href: `/admin/renewals?item=${passed.id}`,
    });
    expect(byId.get(`my-work:date:${soon.id}`)).toMatchObject({ severity: "soon", detail: "Recorded date" });
    expect(byId.get(`my-work:date:${later.id}`)).toMatchObject({ severity: "info", detail: "Recorded date" });
  });

  it("never says expired, valid or compliant", () => {
    const text = adminMyDayItems([passed, soon, later], NOW)
      .map((item) => `${item.title} ${item.detail ?? ""}`)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/expired|valid|compliant/);
  });

  it("groups everything not recorded into one item with a correct count", () => {
    const expected = selectNeedsYou([], NOW)?.notRecordedCount ?? 0;
    expect(expected).toBeGreaterThan(1);

    const notRecorded = adminMyDayItems([], NOW).filter((item) => item.id === "my-work:not-recorded");
    expect(notRecorded).toHaveLength(1);
    expect(notRecorded[0]).toMatchObject({
      title: `${expected} dates not recorded yet`,
      due: null,
      severity: "info",
      href: "/admin/renewals?show=not-recorded",
    });
  });

  it("returns nothing when compliance-date reminders are switched off", () => {
    expect(adminMyDayItems([passed, soon], NOW, remindersOff("compliance-dates"))).toEqual([]);
  });

  it("returns nothing while compliance-date reminders are snoozed", () => {
    const snoozed = updateReminderType(DEFAULT_REMINDER_SETTINGS, "compliance-dates", { snoozedUntil: "2026-10-03" });
    expect(adminMyDayItems([passed], NOW, snoozed)).toEqual([]);
  });
});

describe("onCallMyDayItems", () => {
  const passed = complianceFixture("Fire training", { category: "Training", expiresOn: "2026-09-01" });
  const unverified = onCallEntryFixture({ section: "contacts", title: "Registrar rota", lastVerifiedAt: null });
  const stale = onCallEntryFixture({
    section: "contacts",
    title: "Switchboard",
    lastVerifiedAt: "2020-01-01T00:00:00Z",
  });

  it("leaves compliance dates to Admin, so no row is duplicated", () => {
    const derived = deriveOnCallNotifications([passed, unverified, stale], NOW);
    expect(derived.some((notification) => notification.kind === "compliance-date-passed")).toBe(true);

    const items = onCallMyDayItems([passed, unverified, stale], NOW, DEFAULT_REMINDER_SETTINGS);
    expect(items.some((item) => item.id.includes("compliance-date-passed"))).toBe(false);
    expect(items.some((item) => item.title === "Fire training")).toBe(false);
  });

  it("maps a long-unconfirmed row to overdue and a never-confirmed row to info, undated", () => {
    const items = onCallMyDayItems([unverified, stale], NOW, DEFAULT_REMINDER_SETTINGS);
    const byTitle = new Map(items.map((item) => [item.title, item]));

    expect(byTitle.get("Switchboard")).toMatchObject({
      id: `on-call:${stale.id}:overdue`,
      mode: "on-call",
      severity: "overdue",
      due: null,
    });
    expect(byTitle.get("Registrar rota")).toMatchObject({
      id: `on-call:${unverified.id}:never-verified`,
      severity: "info",
      due: null,
    });
  });

  it("returns nothing when On Call checks are switched off", () => {
    expect(onCallMyDayItems([unverified, stale], NOW, remindersOff("on-call-checks"))).toEqual([]);
  });
});

describe("teachingMyDayItems", () => {
  const ref = (n: number, startsAt: string): SessionRef => ({
    occurrenceId: `00000000-0000-4000-8000-00000000030${n}`,
    serviceId: "00000000-0000-4000-8000-000000000999",
    title: `Talk ${n}`,
    startsAt,
    endsAt: startsAt,
  });
  const upcoming = (n: number, startsAt: string, over: Record<string, unknown> = {}) => ({
    ...ref(n, startsAt),
    venue: null,
    status: "scheduled" as const,
    items: [],
    deidConfirmedAt: null,
    ...over,
  });
  const teach = (...sessions: ReturnType<typeof upcoming>[]): TeachRead => ({ upcoming: sessions, taught: [] });

  it("says nothing when there is nothing to do or nothing has loaded", () => {
    expect(teachingMyDayItems({ unloggedCount: 0, teach: teach(), feedbackOpen: { sessions: [] } }, NOW)).toEqual([]);
    expect(teachingMyDayItems({ unloggedCount: null, teach: null, feedbackOpen: null }, NOW)).toEqual([]);
  });

  it("words and links the three rows, with plurals", () => {
    const items = teachingMyDayItems(
      {
        unloggedCount: 1,
        teach: teach(upcoming(1, "2026-09-29T00:00:00Z")),
        feedbackOpen: { sessions: [ref(2, "2026-09-24T03:00:00Z"), ref(3, "2026-09-25T03:00:00Z")] },
      },
      NOW,
    );
    expect(items.map((item) => item.href)).toEqual(["/teaching/review", "/teaching/teach", "/teaching/feedback"]);
    expect(items[0]).toMatchObject({
      title: `Review & log ${withUnit(1, "session")}`,
      due: null,
      severity: "info",
    });
    expect(items[2]).toMatchObject({ title: `Give feedback on ${withUnit(2, "sessions")}`, severity: "info" });
  });

  it("uses the plural for several unlogged sessions", () => {
    const [item] = teachingMyDayItems({ unloggedCount: 4, teach: null, feedbackOpen: null }, NOW);
    expect(item.title).toBe(`Review & log ${withUnit(4, "sessions")}`);
  });

  it("dates the presenter row from the next upcoming session, skipping cancelled and past ones", () => {
    const items = teachingMyDayItems(
      {
        unloggedCount: 0,
        teach: teach(
          upcoming(1, "2026-09-27T00:00:00Z", { status: "cancelled" }),
          upcoming(2, "2026-09-20T00:00:00Z"),
          upcoming(3, "2026-10-20T00:00:00Z"),
          upcoming(4, "2026-09-28T00:00:00Z"),
        ),
        feedbackOpen: null,
      },
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "teaching:prep:00000000-0000-4000-8000-000000000304",
      due: "2026-09-28T00:00:00Z",
      severity: "soon",
      href: "/teaching/teach",
    });
  });

  it("returns nothing when Teaching reminders are switched off", () => {
    const items = teachingMyDayItems(
      {
        unloggedCount: 3,
        teach: teach(upcoming(1, "2026-09-29T00:00:00Z")),
        feedbackOpen: { sessions: [ref(2, "2026-09-24T03:00:00Z")] },
      },
      NOW,
      remindersOff("teaching"),
    );
    expect(items).toEqual([]);
  });
});
