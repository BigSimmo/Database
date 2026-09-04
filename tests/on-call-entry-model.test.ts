import { describe, expect, it } from "vitest";
import {
  ON_CALL_REVIEW_INTERVAL_MONTHS,
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
} from "@/lib/on-call/entry-model";

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
