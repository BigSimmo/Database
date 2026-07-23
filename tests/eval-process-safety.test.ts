import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { getDescendantPids, terminateOwnedProcessTree, isWindows } from "../scripts/run-eval-safe.mjs";

// Mock taskkill calls in node:child_process
vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  return {
    ...original,
    spawnSync: vi.fn((cmd, args, options) => {
      if (cmd === "taskkill") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return original.spawnSync(cmd, args, options);
    }),
  };
});

describe("run-eval-safe process ownership safety", () => {
  const mockSnapshot = [
    // Our spawned child process tree
    { pid: 1000, parentPid: 999, createdAtMs: null },
    { pid: 1001, parentPid: 1000, createdAtMs: null },
    { pid: 1002, parentPid: 1001, createdAtMs: null },

    // Unrelated processes running in the repository
    { pid: 2000, parentPid: 500, createdAtMs: null },
    { pid: 2001, parentPid: 2000, createdAtMs: null },
    { pid: 3000, parentPid: 1, createdAtMs: null },
  ];

  it("correctly maps descendant PIDs including the root PID", () => {
    const descendants = getDescendantPids(1000, mockSnapshot);
    expect(descendants).toContain(1000);
    expect(descendants).toContain(1001);
    expect(descendants).toContain(1002);
    expect(descendants.length).toBe(3);

    expect(descendants).not.toContain(2000);
    expect(descendants).not.toContain(2001);
    expect(descendants).not.toContain(3000);
  });

  it("returns only the root PID if no descendants exist", () => {
    const descendants = getDescendantPids(1002, mockSnapshot);
    expect(descendants).toEqual([1002]);
  });

  it("does not target unrelated processes for termination", () => {
    if (!isWindows) {
      return;
    }

    // Reset the mock before call
    const mockedSpawnSync = spawnSync as import("vitest").Mock;
    mockedSpawnSync.mockClear();

    const killedCount = terminateOwnedProcessTree(1000, mockSnapshot);

    expect(mockedSpawnSync).toHaveBeenCalledTimes(3);
    expect(killedCount).toBe(3);

    const calledPids = mockedSpawnSync.mock.calls.map((call: unknown[]) => (call[1] as string[])?.[1]);
    expect(calledPids).toContain("1000");
    expect(calledPids).toContain("1001");
    expect(calledPids).toContain("1002");

    expect(calledPids).not.toContain("2000");
    expect(calledPids).not.toContain("2001");
    expect(calledPids).not.toContain("3000");
  });

  it("filters by command line without serializing command-line values", () => {
    const source = readFileSync(new URL("../scripts/run-eval-safe.mjs", import.meta.url), "utf8");

    expect(source).toContain("RUN_EVAL_GUARD_REPO_ROOTS_JSON");
    expect(source).toContain("$commandLine.Contains($root)");
    expect(source).toContain("Select-Object ProcessId, ParentProcessId, CreationDate");
    expect(source).not.toContain("Select-Object ProcessId, ParentProcessId, CommandLine");
    expect(source).not.toContain("commandLine: String(item?.CommandLine");
  });
});
