import { describe, expect, it } from "vitest";

import {
  selectNewJobProgress,
  selectNewJobStart,
  setNewJobStart,
  setNewJobStepDone,
} from "@/lib/admin/new-job-progress";
import { updateOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { onCallDetailsSchemaFor } from "@/lib/on-call/entry-model";
import { onCallEntryFixture } from "./helpers/on-call-entry-fixture";

/** A New job checklist row: `logistics` + a category `adminPlacementForEntry` places at "new-job". */
function newJobStep(
  title: string,
  overrides: Record<string, unknown> = {},
  entryOverrides: Record<string, unknown> = {},
) {
  return onCallEntryFixture({
    title,
    section: "logistics",
    details: { category: "Logins", ...overrides },
    ...entryOverrides,
  });
}

describe("selectNewJobProgress", () => {
  it("returns null when no own row has a start date set", () => {
    const own = [newJobStep("Email account"), newJobStep("Payroll setup")];
    expect(selectNewJobProgress({ own, shared: [] }, new Date("2026-09-26T01:00:00Z"))).toBeNull();
  });

  it("recomputes weeksAway across a Perth midnight, not a UTC one", () => {
    const own = [newJobStep("Email account", { jobStartsOn: "2026-11-02" })];
    // 2026-09-24T15:59Z is still 23:59 on 24 Sep in Perth (UTC+8): 39 days to 2 Nov.
    const beforePerthMidnight = selectNewJobProgress({ own, shared: [] }, new Date("2026-09-24T15:59:00Z"));
    // Two minutes later it is 00:01 on 25 Sep in Perth: 38 days to 2 Nov, one Perth day fewer.
    const afterPerthMidnight = selectNewJobProgress({ own, shared: [] }, new Date("2026-09-24T16:01:00Z"));
    expect(beforePerthMidnight?.weeksAway).toBe(6);
    expect(afterPerthMidnight?.weeksAway).toBe(5);
  });

  it("still shows exactly a week after the start date, but not a day beyond that", () => {
    const own = [newJobStep("Email account", { jobStartsOn: "2026-09-01" })];
    expect(selectNewJobProgress({ own, shared: [] }, new Date("2026-09-08T01:00:00Z"))).not.toBeNull();
    expect(selectNewJobProgress({ own, shared: [] }, new Date("2026-09-09T01:00:00Z"))).toBeNull();
  });

  it("returns null when the start date is more than 7 days in the past", () => {
    const own = [newJobStep("Email account", { jobStartsOn: "2026-09-01" })];
    expect(selectNewJobProgress({ own, shared: [] }, new Date("2026-09-10T01:00:00Z"))).toBeNull();
  });

  it("picks the start date from the most recently updated own row, and counts only own rows", () => {
    const own = [
      newJobStep("Email account", { jobStartsOn: "2026-11-02" }, { lastVerifiedAt: "2026-09-01T00:00:00Z" }),
      newJobStep("Payroll setup", { jobStartsOn: "2026-12-14" }, { lastVerifiedAt: "2026-09-20T00:00:00Z" }),
      newJobStep("Keycard", {}, { lastVerifiedAt: null }),
    ];
    const shared = [newJobStep("Ward orientation guide", { jobStartsOn: "2026-01-01", done: true }, { isOwn: false })];
    const result = selectNewJobProgress({ own, shared }, new Date("2026-09-26T01:00:00Z"));
    expect(result?.startsOn).toBe("2026-12-14");
    expect(result?.total).toBe(3);
    expect(result?.done).toBe(0);
  });

  it("orders nextStep the same way the New job page lists rows, skipping done ones", () => {
    const own = [
      newJobStep("Email account", { jobStartsOn: "2026-10-01", done: true }),
      newJobStep("Payroll setup", { done: false }),
      newJobStep("Keycard"),
    ];
    const result = selectNewJobProgress({ own, shared: [] }, new Date("2026-09-26T01:00:00Z"));
    expect(result).toMatchObject({ done: 1, total: 3, nextStep: "Payroll setup" });
  });

  it("gives a null nextStep once every own row is done", () => {
    const own = [newJobStep("Email account", { jobStartsOn: "2026-10-01", done: true })];
    const result = selectNewJobProgress({ own, shared: [] }, new Date("2026-09-26T01:00:00Z"));
    expect(result).toMatchObject({ done: 1, total: 1, nextStep: null });
  });
});

describe("selectNewJobStart (the New job page's own start line, M17)", () => {
  it("keeps the stored date past Today's seven-day window", () => {
    const own = [newJobStep("Email account", { jobStartsOn: "2026-09-01" })];
    expect(selectNewJobProgress({ own, shared: [] }, new Date("2026-10-01T01:00:00Z"))).toBeNull();
    expect(selectNewJobStart({ own, shared: [] })?.startsOn).toBe("2026-09-01");
  });

  it("names the row that holds the date, so a new date is written where it will be read", () => {
    const first = newJobStep("Email account", {}, { lastVerifiedAt: "2026-09-25T00:00:00Z" });
    const holder = newJobStep(
      "Payroll setup",
      { jobStartsOn: "2026-11-02" },
      { lastVerifiedAt: "2026-09-01T00:00:00Z" },
    );
    const start = selectNewJobStart({ own: [first, holder], shared: [] });
    expect(start?.entry).toBe(holder);
    expect(start?.startsOn).toBe("2026-11-02");
  });

  it("is null when no own row carries a date, and never reads a shared row's", () => {
    const shared = [newJobStep("Guide", { jobStartsOn: "2026-01-01" }, { isOwn: false })];
    expect(selectNewJobStart({ own: [newJobStep("Email account")], shared })).toBeNull();
  });
});

describe("setNewJobStepDone and setNewJobStart undo", () => {
  it("ticks a step and restores it exactly on undo", () => {
    const entry = newJobStep("Email account");
    const update = setNewJobStepDone(entry, true);
    expect(updateOnCallEntrySchema.safeParse(update.body).success).toBe(true);
    expect(onCallDetailsSchemaFor("logistics").safeParse(update.body.details).success).toBe(true);
    expect(update.body.details).toMatchObject({ done: true, category: "Logins" });
    expect(update.undo.details).toEqual(entry.details);
  });

  it("clears the tick rather than storing it as false", () => {
    const entry = newJobStep("Email account", { done: true });
    const update = setNewJobStepDone(entry, false);
    expect(update.body.details).not.toHaveProperty("done");
    expect(update.undo.details).toEqual(entry.details);
  });

  it("sets and clears the start date, and restores it exactly on undo", () => {
    const entry = newJobStep("Email account");
    const set = setNewJobStart(entry, "2026-11-02");
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.body.details).toMatchObject({ jobStartsOn: "2026-11-02" });
    expect(set.undo.details).toEqual(entry.details);

    const withDate = newJobStep("Email account", { jobStartsOn: "2026-11-02" });
    const cleared = setNewJobStart(withDate, null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.body.details).not.toHaveProperty("jobStartsOn");
    expect(cleared.undo.details).toEqual(withDate.details);
  });

  it("rejects a malformed start date without touching the row", () => {
    const entry = newJobStep("Email account");
    expect(setNewJobStart(entry, "02/11/2026")).toEqual({ ok: false, reason: "malformed" });
    expect(setNewJobStart(entry, "2026-13-40")).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("jobStartsOn on the logistics details schema", () => {
  it("rejects a date that is not YYYY-MM-DD", () => {
    const schema = onCallDetailsSchemaFor("logistics");
    expect(schema.safeParse({ category: "Logins", jobStartsOn: "02-11-2026" }).success).toBe(false);
    expect(schema.safeParse({ category: "Logins", jobStartsOn: "2026-11-02" }).success).toBe(true);
  });
});
