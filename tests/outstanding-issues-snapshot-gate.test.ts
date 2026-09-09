import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../scripts/check-outstanding-issues-snapshot.mjs";

const BASE = {
  version: "outstanding-issues-snapshot-v1",
  ledger_revision: { sha: "a".repeat(40), committed_at: "2026-08-20T00:00:00Z" },
  counts: { open: 2, p1: 1, pending: 0 } as Record<string, number>,
  queue: [{ order: 1, ids: ["#1"] }],
  open: [{ id: "#1" }, { id: "#2" }],
  // Empty, because that is the shape a COMMITTED snapshot must have — see the
  // "refuses a committed snapshot" test below. Typed rather than inferred: an
  // empty literal infers `never[]`, which no test could then populate.
  pending: [] as { request_id: string; action: string; summary: string }[],
};

describe("compareSnapshots", () => {
  it("refuses a committed snapshot that carries inbox requests", () => {
    // Excluding `pending` from the value comparison is not the same as
    // permitting it in the committed file. Its value depends on every other
    // branch's queued requests, so committing it re-arms the conflict
    // `#Y090R5` exists to end — and a plain `npm run build` writes it, because
    // `prebuild` passes `--with-pending` so the built image can show the true
    // list. Without this the gate would wave that through.
    const committedWithPending = structuredClone(BASE);
    committedWithPending.pending = [{ request_id: "r1", action: "add", summary: "s" }];
    const differences = compareSnapshots(committedWithPending, BASE);
    expect(differences.join(" ")).toMatch(/pending: the committed snapshot carries 1 inbox request/);
    // The message has to name the way out, because the usual cause is a local
    // build rather than anything the author did on purpose.
    expect(differences.join(" ")).toMatch(/npm run build/);
  });

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
    // The REGENERATED side carries the live inbox; the committed side stays
    // empty. That divergence must not be reported, which is what isolates a
    // feature branch from every other branch's queued requests.
    const regeneratedWithInbox = structuredClone(BASE);
    regeneratedWithInbox.pending = [{ request_id: "r1", action: "add", summary: "s" }];
    regeneratedWithInbox.counts = { ...regeneratedWithInbox.counts, pending: 1 };
    pendingDrift.counts = { ...pendingDrift.counts, pending: 99 };
    expect(compareSnapshots(pendingDrift, regeneratedWithInbox)).toEqual([]);
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
