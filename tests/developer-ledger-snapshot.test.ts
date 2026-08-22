import { describe, expect, it } from "vitest";
import { loadLedgerSnapshot, openItemsByPriority, resolveFreshness } from "@/lib/developer-area/ledger-snapshot";

describe("ledger snapshot", () => {
  it("loads the generated snapshot and validates its version", () => {
    const snapshot = loadLedgerSnapshot();
    expect(snapshot.version).toBe("outstanding-issues-snapshot-v1");
    expect(snapshot.counts.open).toBeGreaterThan(0);
  });

  it("groups open items by priority without inventing acuity", () => {
    const grouped = openItemsByPriority(loadLedgerSnapshot());
    expect(grouped.P1.every((item) => item.priority === "P1")).toBe(true);
    expect(grouped.P1.every((item) => !("acuity" in item))).toBe(true);
  });

  it("reports a gap between ledger content and build", () => {
    const snapshot = {
      ...loadLedgerSnapshot(),
      ledger_revision: { sha: "a".repeat(40), committed_at: "2026-08-20T00:00:00Z" },
    };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.ageHours).toBe(24);
  });

  it("says the revision is unknown rather than fabricating a date", () => {
    const snapshot = { ...loadLedgerSnapshot(), ledger_revision: null };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.contentAt).toBeNull();
    expect(freshness.ageHours).toBeNull();
  });
});
