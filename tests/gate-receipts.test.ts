import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendReceipt,
  computeInputSignature,
  consultGateReceipt,
  environmentSignature,
  fileInScope,
  loadStore,
  MAX_RECEIPTS_PER_GATE,
  receiptKey,
  receiptsEnabled,
  recordGateReceipt,
  typecheckScopeAlias,
  withGateReceipt,
} from "../scripts/gate-receipts.mjs";

const temporaryRoots: string[] = [];

/** A throwaway git worktree, so signature behaviour is proven against real git plumbing. */
function gitFixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(os.tmpdir(), "gate-receipts-"));
  temporaryRoots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(root, name), contents);
  git("add", "-A");
  git("commit", "-qm", "fixture");
  return { root, write: (name: string, contents: string) => writeFileSync(path.join(root, name), contents) };
}

afterEach(() => {
  while (temporaryRoots.length > 0) rmSync(temporaryRoots.pop()!, { recursive: true, force: true, maxRetries: 3 });
});

describe("gate receipts — reuse boundaries", () => {
  it("never reuses a receipt in CI, because CI is the authoritative merge gate", () => {
    expect(receiptsEnabled({ CI: "true" }).enabled).toBe(false);
    expect(receiptsEnabled({ CI: "1", GATE_RECEIPTS: "on" }).enabled).toBe(false);
  });

  it("honours the explicit off and refresh switches", () => {
    expect(receiptsEnabled({ GATE_RECEIPTS: "off" }).enabled).toBe(false);
    expect(receiptsEnabled({ GATE_RECEIPTS: "false" }).enabled).toBe(false);
    expect(receiptsEnabled({ GATE_RECEIPTS: "refresh" })).toMatchObject({ enabled: true, refresh: true });
    expect(receiptsEnabled({})).toMatchObject({ enabled: true, refresh: false });
  });

  it("treats an unlisted gate as not memoisable", () => {
    const decision = consultGateReceipt({ projectRoot: process.cwd(), gate: "build", args: [] });
    expect(decision.reuse).toBe(false);
    expect(decision.key).toBeNull();
  });

  it("maps both typecheck wrappers onto one scope", () => {
    expect(typecheckScopeAlias("typecheck:source:internal")).toBe("typecheck:internal");
    expect(typecheckScopeAlias("lint:internal")).toBe("lint:internal");
  });
});

describe("gate receipts — input signature", () => {
  it("changes when tracked content changes and returns to the earlier hash when it is restored", () => {
    const { root, write } = gitFixture({ "a.ts": "export const a = 1;\n" });
    const before = computeInputSignature(root, null);
    write("a.ts", "export const a = 2;\n");
    const modified = computeInputSignature(root, null);
    write("a.ts", "export const a = 1;\n");
    const restored = computeInputSignature(root, null);

    expect(before?.hash).toBeTruthy();
    expect(modified?.hash).not.toBe(before?.hash);
    expect(restored?.hash).toBe(before?.hash);
  });

  it("counts an unstaged edit, so an uncommitted change can never be memoised away", () => {
    const { root, write } = gitFixture({ "a.ts": "1\n", "b.ts": "2\n" });
    const before = computeInputSignature(root, null);
    write("b.ts", "2 // edited\n");
    expect(computeInputSignature(root, null)?.hash).not.toBe(before?.hash);
  });

  it("counts a new untracked file", () => {
    const { root, write } = gitFixture({ "a.ts": "1\n" });
    const before = computeInputSignature(root, null);
    write("new.ts", "export const added = true;\n");
    const after = computeInputSignature(root, null);
    expect(after?.hash).not.toBe(before?.hash);
    expect(after?.fileCount).toBe((before?.fileCount ?? 0) + 1);
  });

  it("counts a deletion", () => {
    const { root } = gitFixture({ "a.ts": "1\n", "b.ts": "2\n" });
    const before = computeInputSignature(root, null);
    rmSync(path.join(root, "b.ts"));
    const after = computeInputSignature(root, null);
    expect(after?.hash).not.toBe(before?.hash);
    expect(after?.fileCount).toBe((before?.fileCount ?? 0) - 1);
  });

  it("restricts the signature to a declared scope", () => {
    const { root, write } = gitFixture({ "src.ts": "1\n", "docs.md": "unrelated\n" });
    const scoped = computeInputSignature(root, ["src.ts"]);
    write("docs.md", "still unrelated, but different\n");
    expect(computeInputSignature(root, ["src.ts"])?.hash).toBe(scoped?.hash);
    expect(computeInputSignature(root, null)?.hash).not.toBe(computeInputSignature(root, ["src.ts"])?.hash);
  });

  it("fails open rather than reusing when the directory is not a git worktree", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "gate-receipts-nogit-"));
    temporaryRoots.push(root);
    expect(computeInputSignature(root, null)).toBeNull();
  });

  it("fails open when a declared scope resolves to no files", () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    expect(computeInputSignature(root, ["nonexistent/"])).toBeNull();
  });

  it("matches directory scopes by path segment, not bare string prefix", () => {
    expect(fileInScope("src/lib/rag/rag.ts", ["src/"])).toBe(true);
    expect(fileInScope("srcx/other.ts", ["src/"])).toBe(false);
    expect(fileInScope("package.json", ["package.json"])).toBe(true);
    expect(fileInScope("docs/package.json", ["package.json"])).toBe(false);
  });
});

describe("gate receipts — keying", () => {
  it("separates gate, arguments, inputs and toolchain", () => {
    const base = { gate: "vitest", args: ["run"], inputHash: "i", environmentHash: "e" };
    const keys = new Set([
      receiptKey(base),
      receiptKey({ ...base, gate: "lint:internal" }),
      receiptKey({ ...base, args: ["run", "tests/x.test.ts"] }),
      receiptKey({ ...base, inputHash: "i2" }),
      receiptKey({ ...base, environmentHash: "e2" }),
    ]);
    expect(keys.size).toBe(5);
  });

  it("includes the install stamp, so a reinstall invalidates every receipt", () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    const before = environmentSignature(root);
    execFileSync("mkdir", ["-p", path.join(root, "node_modules")]);
    writeFileSync(path.join(root, "node_modules", ".package-lock.json"), JSON.stringify({ packages: {} }));
    expect(environmentSignature(root)).not.toBe(before);
  });
});

describe("gate receipts — recording", () => {
  it("never memoises a failure", () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    const decision = consultGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"] });
    expect(recordGateReceipt({ projectRoot: root, decision, exitCode: 1 }).recorded).toBe(false);
    expect(loadStore(root).gates.vitest ?? []).toHaveLength(0);
  });

  it("refuses to record when the tree changed while the gate was running", () => {
    const { root, write } = gitFixture({ "a.ts": "1\n" });
    const decision = consultGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"] });
    write("a.ts", "2\n"); // the edit a session makes while the suite is still running
    const result = recordGateReceipt({ projectRoot: root, decision, exitCode: 0 });
    expect(result.recorded).toBe(false);
    expect(result.reason).toContain("changed while the gate ran");
  });

  it("records a pass and reuses it for an identical tree", () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    const first = consultGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"] });
    expect(first.reuse).toBe(false);
    expect(recordGateReceipt({ projectRoot: root, decision: first, exitCode: 0 }).recorded).toBe(true);

    const second = consultGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"] });
    expect(second.reuse).toBe(true);
    expect(second.message).toContain("reused receipt, not a fresh run");
  });

  it("caps stored history per gate", () => {
    const store = { gates: {} as Record<string, { key: string; recordedAt: string }[]> };
    for (let index = 0; index < MAX_RECEIPTS_PER_GATE + 5; index += 1) {
      appendReceipt(store, "vitest", { key: `k${index}`, recordedAt: "2026-01-01T00:00:00.000Z" });
    }
    expect(store.gates.vitest).toHaveLength(MAX_RECEIPTS_PER_GATE);
  });
});

describe("gate receipts — wrapper contract", () => {
  it("runs once, then elides the second identical invocation", async () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    let runs = 0;
    const run = async () => {
      runs += 1;
      return 0;
    };
    const logs: string[] = [];
    const log = (message: string) => logs.push(message);

    expect(await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run, log })).toBe(0);
    expect(await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run, log })).toBe(0);
    expect(runs).toBe(1);
    expect(logs.some((line) => line.includes("REUSED"))).toBe(true);
  });

  it("re-runs after a failure instead of serving the earlier pass", async () => {
    const { root, write } = gitFixture({ "a.ts": "1\n" });
    let runs = 0;
    const failing = async () => {
      runs += 1;
      return 1;
    };
    await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run: failing, log: () => {} });
    write("a.ts", "2\n");
    await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run: failing, log: () => {} });
    expect(runs).toBe(2);
  });

  it("re-runs everything under GATE_RECEIPTS=refresh", async () => {
    const { root } = gitFixture({ "a.ts": "1\n" });
    let runs = 0;
    const run = async () => {
      runs += 1;
      return 0;
    };
    const env = { GATE_RECEIPTS: "refresh" };
    await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run, env, log: () => {} });
    await withGateReceipt({ projectRoot: root, gate: "vitest", args: ["run"], run, env, log: () => {} });
    expect(runs).toBe(2);
  });
});

describe("gate receipts — repository wiring", () => {
  it("passes its own self-test against this checkout", () => {
    const output = execFileSync(process.execPath, ["scripts/gate-receipts.mjs", "--self-test"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("self-test OK");
  });

  it("keeps the receipt store inside node_modules so it is never committed", async () => {
    const { RECEIPT_STORE_RELATIVE_PATH } = await import("../scripts/gate-receipts.mjs");
    expect(RECEIPT_STORE_RELATIVE_PATH.replaceAll("\\", "/")).toMatch(/^node_modules\//);
  });

  it("wires the consult/record pair into both heavy runners", async () => {
    const { readFileSync } = await import("node:fs");
    for (const runner of ["scripts/run-heavy.mjs", "scripts/run-vitest.mjs"]) {
      const source = readFileSync(runner, "utf8");
      expect(source).toContain("consultGateReceipt");
      expect(source).toContain("recordGateReceipt");
    }
  });

  it("excludes coverage, watch and snapshot-update runs from memoisation", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("scripts/run-vitest.mjs", "utf8");
    for (const flag of ["--coverage", "--watch", "--update"]) expect(source).toContain(flag);
  });
});
