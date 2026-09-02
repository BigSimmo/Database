import { describe, expect, it } from "vitest";

import {
  assertRepoAwarenessVersion,
  documentsBySection,
  isQuarantineExpired,
  loadRepoAwarenessSnapshot,
  resolveRepoFreshness,
  reviewRecordsNewestFirst,
  reviewStateCounts,
} from "@/lib/developer-area/repo-awareness-snapshot";
import { REPO_AWARENESS_SNAPSHOT_VERSION } from "@/lib/developer-area/repo-awareness-types";

const NOW = new Date("2026-08-22T12:00:00.000Z");

describe("assertRepoAwarenessVersion", () => {
  it("accepts the version the committed snapshot declares", () => {
    expect(() => assertRepoAwarenessVersion({ version: REPO_AWARENESS_SNAPSHOT_VERSION })).not.toThrow();
  });

  it("throws loudly on an unrecognised version rather than rendering part of it", () => {
    expect(() => assertRepoAwarenessVersion({ version: "repo-awareness-snapshot-v0" })).toThrow(
      /repo-awareness-snapshot-v0.*snapshot:repo-awareness/s,
    );
  });
});

describe("loadRepoAwarenessSnapshot", () => {
  it("returns the committed snapshot with all four sections populated", () => {
    const snapshot = loadRepoAwarenessSnapshot();
    expect(snapshot.version).toBe(REPO_AWARENESS_SNAPSHOT_VERSION);
    expect(snapshot.routes.counts.pages).toBeGreaterThan(0);
    expect(snapshot.documentation.counts.documents).toBeGreaterThan(0);
    expect(snapshot.review_state.records.length).toBeGreaterThan(2_500);
  });

  it("keeps each stored count equal to the length of its own list", () => {
    const snapshot = loadRepoAwarenessSnapshot();
    expect(snapshot.routes.counts.pages).toBe(snapshot.routes.pages.length);
    expect(snapshot.documentation.counts.documents).toBe(snapshot.documentation.documents.length);
    expect(snapshot.test_health.counts.quarantined).toBe(snapshot.test_health.quarantined.length);
  });

  it("stores review records ordered by head, so concurrent appends merge cleanly", () => {
    // The committed corpus itself, not a fixture: this is the property that
    // stops a `ledger:append` on two branches conflicting on the same lines
    // (`#EFETZT`). A regenerated snapshot that clusters appends again fails here.
    const heads = loadRepoAwarenessSnapshot().review_state.records.map((record) => record.head);
    expect([...heads].sort((left, right) => left.localeCompare(right))).toEqual(heads);
  });

  it("carries no stored review-state aggregate, which could not merge", () => {
    expect(loadRepoAwarenessSnapshot().review_state).not.toHaveProperty("counts");
  });
});

describe("reviewStateCounts", () => {
  it("counts records and distinct refs from the list the page renders", () => {
    const records = loadRepoAwarenessSnapshot().review_state.records;
    const counts = reviewStateCounts(records);
    expect(counts.records).toBe(records.length);
    expect(counts.refs).toBe(new Set(records.map((record) => record.ref)).size);
    // One ref reviewed at several heads is one ref and several records, which
    // is exactly what the panel's two tiles exist to tell apart.
    expect(counts.refs).toBeLessThan(counts.records);
  });
});

describe("reviewRecordsNewestFirst", () => {
  it("puts the newest record first without mutating the shared snapshot", () => {
    const stored = loadRepoAwarenessSnapshot().review_state.records;
    const storedOrder = stored.map((record) => record.head);
    const sorted = reviewRecordsNewestFirst(stored);
    const dates = sorted.map((record) => record.date);
    expect([...dates].sort((left, right) => right.localeCompare(left))).toEqual(dates);
    // The snapshot is a module-level import shared by every request, so sorting
    // it in place would reorder it for every later reader.
    expect(stored.map((record) => record.head)).toEqual(storedOrder);
  });
});

describe("resolveRepoFreshness", () => {
  it("dates the page from the captured revision", () => {
    const snapshot = loadRepoAwarenessSnapshot();
    const freshness = resolveRepoFreshness(snapshot, NOW);
    expect(freshness.contentAt).toBe(snapshot.captured_revision?.committed_at ?? null);
    expect(freshness.viewedAt).toBe(NOW.toISOString());
  });
});

describe("isQuarantineExpired", () => {
  const entry = {
    id: "x",
    title: "t @quarantine",
    spec: "tests/ui-smoke.spec.ts",
    reason: "r",
    owner: "o",
    reproduction: "cmd",
    first_seen: "2026-08-01",
    last_seen: "2026-08-03",
    expires: "2026-08-22",
    tracking: "docs/process-hardening.md",
  };

  it("treats the expiry date itself as still current", () => {
    // A quarantine that expires today has not expired yet. Rounding this the
    // other way would show a red badge for a whole day the entry is still valid.
    expect(isQuarantineExpired(entry, NOW)).toBe(false);
  });

  it("reports expired the day after", () => {
    expect(isQuarantineExpired(entry, new Date("2026-08-23T00:00:01.000Z"))).toBe(true);
  });

  it("does not claim expiry for an unparseable date", () => {
    expect(isQuarantineExpired({ ...entry, expires: "not-a-date" }, NOW)).toBe(false);
  });

  it("does not normalize a calendar-invalid expiry date", () => {
    expect(isQuarantineExpired({ ...entry, expires: "2026-02-30" }, NOW)).toBe(false);
  });
});

describe("documentsBySection", () => {
  it("groups every document under its section, dropping none", () => {
    const snapshot = loadRepoAwarenessSnapshot();
    const grouped = documentsBySection(snapshot);
    const total = grouped.reduce((sum, section) => sum + section.documents.length, 0);
    expect(total).toBe(snapshot.documentation.counts.documents);
    expect(grouped.map((section) => section.name)).toEqual(snapshot.documentation.sections.map((s) => s.name));
  });
});
