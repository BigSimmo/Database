import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../scripts/check-outstanding-issues-snapshot.mjs";

const BASE = {
  version: "outstanding-issues-snapshot-v1",
  ledger_revision: { sha: "a".repeat(40), committed_at: "2026-08-20T00:00:00Z" },
  counts: { open: 2, p1: 1, pending: 1 } as Record<string, number>,
  queue: [{ order: 1, ids: ["#1"] }],
  open: [{ id: "#1" }, { id: "#2" }],
  pending: [{ request_id: "r1", action: "add", summary: "s" }],
};

describe("compareSnapshots", () => {
  it("reports no differences when in step", () => {
    expect(compareSnapshots(BASE, structuredClone(BASE))).toEqual([]);
  });

  it("detects a stale snapshot", () => {
    const stale = structuredClone(BASE);
    stale.counts.open = 1;
    stale.open = [{ id: "#1" }];
    expect(compareSnapshots(stale, BASE).join(" ")).toMatch(/open/);
  });

  it("detects a version change", () => {
    const old = { ...structuredClone(BASE), version: "outstanding-issues-snapshot-v0" };
    expect(compareSnapshots(old, BASE).join(" ")).toMatch(/version/);
  });

  // The regression this test exists for: `ledger_revision` is the sha of the
  // commit that last touched the ledger, so committing a ledger edit changes it
  // as a side effect. Comparing it made the gate fail on every ledger change
  // with nothing stale, which would turn `main` red after each squash merge.
  it("ignores a differing ledger_revision, which changes as a side effect of committing", () => {
    const differentSha = structuredClone(BASE);
    differentSha.ledger_revision = { sha: "b".repeat(40), committed_at: "2026-08-21T00:00:00Z" };
    expect(compareSnapshots(differentSha, BASE)).toEqual([]);
  });

  it("still detects drift in queue, not just open", () => {
    const queueDrift = structuredClone(BASE);
    queueDrift.queue = [{ order: 1, ids: ["#999"] }];
    expect(compareSnapshots(queueDrift, BASE).join(" ")).toMatch(/queue/);
  });

  it("ignores pending inbox drift and counts.pending drift to isolate feature branch conflicts", () => {
    const pendingDrift = structuredClone(BASE);
    pendingDrift.pending = [];
    pendingDrift.counts = { ...pendingDrift.counts, pending: 99 };
    expect(compareSnapshots(pendingDrift, BASE)).toEqual([]);
  });

  it("notices a key the generator no longer emits", () => {
    const withExtra = { ...structuredClone(BASE), leftoverField: true };
    expect(compareSnapshots(withExtra, BASE).join(" ")).toMatch(/unexpected key/);
  });

  it("notices a count key missing from the committed snapshot", () => {
    const missingCount = structuredClone(BASE);
    delete (missingCount.counts as Record<string, number>).p1;
    expect(compareSnapshots(missingCount, BASE).join(" ")).toMatch(/counts\.p1/);
  });
});
