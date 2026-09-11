import { describe, expect, it } from "vitest";
import {
  CONFIRMATION,
  createBatch,
  decide,
  eligibility,
  failureFingerprint,
  report,
  validTaskReference,
} from "../scripts/pr-batch-core.mjs";
import { runBatch } from "../scripts/pr-batch-runner.mjs";

const now = "2026-09-09T00:00:00.000Z";
const head = "a".repeat(40);
const base = "b".repeat(40);
function pr(number = 1, changes: Record<string, unknown> = {}) {
  return {
    number,
    head,
    base,
    headRef: `codex/change-${number}`,
    baseRef: "main",
    state: "open",
    title: "Document a focused change",
    body: "",
    createdAt: `${now.slice(0, 10)}T00:00:0${number}.000Z`,
    labels: [],
    files: ["docs/example.md"],
    filesComplete: true,
    complete: true,
    fork: false,
    draft: false,
    armed: false,
    enqueued: false,
    merged: false,
    mergeVerified: false,
    failures: [],
    threads: [],
    inFlight: false,
    behind: false,
    conflicting: false,
    busy: false,
    reviewsSatisfied: true,
    requiredGreen: true,
    mergeable: true,
    evidenceKey: "same",
    ...changes,
  };
}
function batch(prs = [pr()]) {
  return createBatch({
    prs,
    actor: "BigSimmo",
    authorization: "codex://threads/01a08595-0fc9-75b0-96e7-567c2c77dc2b",
    controllerHash: "code",
    id: "batch-1",
    now,
  });
}
function selected() {
  const state = batch();
  state.active = 1;
  state.entries[0].state = "preparing";
  return state;
}

function fakeApi(initial = batch([pr(1), pr(2)])) {
  let stored = structuredClone(initial);
  const evidence = new Map([
    [1, pr(1)],
    [2, pr(2)],
  ]);
  const effects: Array<{ kind: string; number: number }> = [];
  let clock = now;
  let repairRun: Record<string, unknown> | null = null;
  const api = {
    actor: "BigSimmo",
    runId: 1,
    now: () => clock,
    setNow: (value: string) => {
      clock = value;
    },
    enabled: async () => true,
    identity: async () => "BigSimmo",
    load: async () => ({ sha: String(stored.revision), state: structuredClone(stored) }),
    save: async (previous: { sha: string }, next: typeof stored) => {
      if (previous.sha !== String(stored.revision)) throw new Error("CAS mismatch");
      stored = structuredClone(next);
      return { sha: String(stored.revision), state: structuredClone(stored) };
    },
    protections: async () => ({ required: [], queue: false, mergeMethod: "merge" }),
    listOpen: async () => [...evidence.values()].filter((item) => !item.merged),
    inspect: async (number: number) => structuredClone(evidence.get(number)),
    main: async () => base,
    postMergeFailure: async () => null,
    execute: async (_state: unknown, pending: { kind: string; number: number }) => {
      effects.push({ kind: pending.kind, number: pending.number });
    },
    findRepair: async () => repairRun,
    verifySync: async () => true,
    recoverWorker: async () => undefined,
    evidence,
    effects,
    read: () => structuredClone(stored),
    setRun: (run: Record<string, unknown>) => {
      repairRun = run;
    },
  };
  return api;
}
const wake = (api: ReturnType<typeof fakeApi>) => runBatch(api, { codeHash: "code", repairAvailable: true });

describe("PR batch decisions", () => {
  it("accepts desktop and cloud task references without URL suffix injection", () => {
    expect(validTaskReference("codex://threads/01a08595-0fc9-75b0-96e7-567c2c77dc2b")).toBe(true);
    expect(validTaskReference("https://chatgpt.com/codex/cloud/tasks/task_abc123")).toBe(true);
    expect(validTaskReference("https://chatgpt.com/codex/cloud/tasks/task_abc123?redirect=bad")).toBe(false);
  });
  it("orders explicit dependencies before age and excludes cycles", () => {
    const state = batch([pr(1, { body: "Depends-on: #2" }), pr(2)]);
    expect(state.entries.map((entry) => entry.number)).toEqual([2, 1]);
    expect(
      batch([pr(1, { body: "Depends-on: #2" }), pr(2, { body: "Depends-on: #1" })]).entries.every(
        (entry) => entry.state === "excluded",
      ),
    ).toBe(true);
  });
  it.each([
    [{ draft: true }, "draft"],
    [{ fork: true }, "fork"],
    [{ labels: ["hold"] }, "opt-out"],
    [{ files: ["supabase/migrations/x.sql"] }, "protected-surface"],
    [{ files: [".github/workflows/ci.yml"] }, "protected-surface"],
    [{ files: ["src/app/auth/callback/route.ts"] }, "protected-surface"],
    [{ files: ["src/security/policy.ts"] }, "protected-surface"],
    [{ files: ["scripts/pr-batch-core.mjs"] }, "protected-surface"],
    [{ filesComplete: false }, "incomplete-file-evidence"],
    [{ files: ["src/lib/rag/rag.ts"] }, "rag-evidence-required"],
  ])("excludes unsafe or unproved candidates %j", (changes, reason) => {
    expect(eligibility(pr(1, changes))).toBe(reason);
  });
  it("fails closed on manifest tampering", () => {
    const state = selected();
    state.manifest.perPr = 100;
    expect(() => decide(state, pr(), now)).toThrow("manifest");
  });
  it("waits without repairing while CI is active, including advisory lanes", () => {
    expect(
      decide(selected(), pr(1, { inFlight: true, failures: [{ name: "lint", conclusion: "failure" }] }), now),
    ).toMatchObject({ action: "wait" });
  });
  it("combines sync with evidenced repair rather than publishing a sync first", () => {
    expect(decide(selected(), pr(1, { behind: true, threads: [{ id: "t1", revision: "1" }] }), now).action).toBe(
      "repair",
    );
    expect(decide(selected(), pr(1, { behind: true }), now).action).toBe("sync");
  });
  it("preserves missing checks and approvals as blockers", () => {
    expect(decide(selected(), pr(1, { requiredGreen: false }), now)).toMatchObject({
      action: "wait",
      reason: "required-checks-missing-or-pending",
    });
    expect(decide(selected(), pr(1, { reviewsSatisfied: false }), now).action).toBe("wait");
  });
  it("caps repeated blockers and repair sessions", () => {
    const state = selected();
    const evidence = pr(1, { threads: [{ id: "t", revision: "1" }] });
    state.entries[0].fingerprints.push(failureFingerprint(evidence));
    expect(decide(state, evidence, now)).toMatchObject({ action: "park", reason: "repeated-blocker-without-progress" });
    state.entries[0].fingerprints = [];
    state.entries[0].attempts = 3;
    expect(decide(state, evidence, now).reason).toBe("repair-budget-exhausted");
    state.entries[0].attempts = 0;
    state.repairs = 30;
    expect(decide(state, evidence, now).reason).toBe("repair-budget-exhausted");
  });
  it("never parks or rearms an armed PR", () => {
    const state = selected();
    state.entries[0].state = "merge_requested";
    expect(decide(state, pr(1, { armed: true, failures: [{ name: "CI" }] }), now).action).toBe("pause");
    expect(decide(state, pr(), now).reason).toBe("merge-request-disappeared");
    expect(decide(selected(), pr(1, { armed: true }), now).reason).toBe("external-merge-ownership");
  });
  it("requires actual merge inclusion on main", () => {
    expect(decide(selected(), pr(1, { merged: true, mergeVerified: false }), now).action).toBe("pause");
    expect(decide(selected(), pr(1, { merged: true, mergeVerified: true, mergeCommit: base }), now)).toMatchObject({
      action: "merged",
      commit: base,
    });
  });
});

describe("durable sequential runner", () => {
  it("requests exactly one PR merge, reconciles it, then updates the next PR against the new base", async () => {
    const api = fakeApi();
    await wake(api);
    expect(api.effects).toEqual([{ kind: "merge", number: 1 }]);
    api.evidence.set(1, pr(1, { armed: true }));
    await wake(api);
    await wake(api);
    expect(api.effects).toHaveLength(1);
    api.evidence.set(1, pr(1, { merged: true, mergeVerified: true, mergeCommit: base }));
    api.evidence.set(2, pr(2, { behind: true, base: "c".repeat(40) }));
    await wake(api);
    expect(api.effects).toEqual([
      { kind: "merge", number: 1 },
      { kind: "sync", number: 2 },
    ]);
    expect(api.read().pending?.base).toBe("c".repeat(40));
    expect(api.read().repairs).toBe(0);
  });
  it("does not dispatch twice when an acknowledgement is lost", async () => {
    const api = fakeApi();
    api.evidence.set(1, pr(1, { threads: [{ id: "t", revision: "1" }] }));
    await wake(api);
    await wake(api);
    await wake(api);
    expect(api.effects).toEqual([{ kind: "repair", number: 1 }]);
    expect(api.read().repairs).toBe(1);
  });
  it("never journals another transition for unchanged waiting evidence", async () => {
    const api = fakeApi();
    api.evidence.set(1, pr(1, { inFlight: true }));
    await wake(api);
    const revision = api.read().revision;
    await wake(api);
    await wake(api);
    expect(api.read().revision).toBe(revision);
    expect(api.effects).toHaveLength(0);
  });
  it("does not absorb newly opened PRs into an existing snapshot", async () => {
    const api = fakeApi();
    api.evidence.set(3, pr(3));
    await wake(api);
    expect(api.read().entries.map((entry) => entry.number)).toEqual([1, 2]);
  });
  it("pauses on outside auto-merge ownership before any mutation", async () => {
    const api = fakeApi();
    api.evidence.set(3, pr(3, { armed: true }));
    expect((await wake(api)).status).toBe("paused");
    expect(api.effects).toHaveLength(0);
  });
  it("pauses after the batch deadline without repeating work", async () => {
    const api = fakeApi();
    api.setNow("2026-09-10T00:00:00.000Z");
    expect(await wake(api)).toMatchObject({ reason: "batch-deadline" });
    expect(api.effects).toHaveLength(0);
  });
  it("requires a fresh authorization confirmation to resume", async () => {
    const api = fakeApi();
    await expect(runBatch(api, { operation: "resume", codeHash: "code", inputs: {} })).rejects.toThrow("confirmation");
    expect(CONFIRMATION).toContain("Railway deployments");
  });
  it("ships disabled and never mutates when disabled", async () => {
    const api = fakeApi();
    api.enabled = async () => false;
    expect((await wake(api)).status).toBe("disabled");
    expect(api.effects).toHaveLength(0);
  });
  it("reports unresolved work without claiming fully merged", () => {
    const state = batch([pr(1, { draft: true })]);
    state.status = "completed_with_unresolved";
    expect(report(state).counts.excluded).toBe(1);
    expect(report(state).deploymentHealth).toContain("Not established");
  });
});
