import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquirePrimaryCheckoutLease,
  inspectPrimaryCheckoutOwnership,
  primaryCheckoutGuardInternals,
} from "../scripts/primary-checkout-guard.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string) {
  const directory = path.join(os.tmpdir(), `${prefix}${process.pid}-${temporaryDirectories.length}`);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const cleanPrimary = {
  path: "C:/repo",
  branch: "main",
  statusEntries: 0,
  operations: [],
  inspectionErrors: [],
};

describe("primary checkout ownership guard", () => {
  it("blocks a second mutation while a live owner holds the lease", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-live-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquirePrimaryCheckoutLease({
      repositoryIdentity,
      baseDirectory,
      ownerWorktree: "C:/repo-task-a",
      inspectPrimary: () => cleanPrimary,
      processIsAlive: () => true,
    });

    expect(() =>
      acquirePrimaryCheckoutLease({
        repositoryIdentity,
        baseDirectory,
        ownerWorktree: "C:/repo-task-b",
        inspectPrimary: () => cleanPrimary,
        processIsAlive: () => true,
      }),
    ).toThrow(/primary-checkout mutation is active/i);

    first.release();
  });

  it("blocks mutation when the primary checkout is dirty and releases its provisional lease", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-dirty-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const lockPath = primaryCheckoutGuardInternals.lockPathFor(repositoryIdentity, baseDirectory);

    expect(() =>
      acquirePrimaryCheckoutLease({
        repositoryIdentity,
        baseDirectory,
        ownerWorktree: "C:/repo-task",
        inspectPrimary: () => ({ ...cleanPrimary, statusEntries: 2 }),
      }),
    ).toThrow(/primary checkout is dirty/i);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("fails closed on active Git operations or incomplete primary inspection", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-operation-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");

    expect(() =>
      acquirePrimaryCheckoutLease({
        repositoryIdentity,
        baseDirectory,
        inspectPrimary: () => ({ ...cleanPrimary, operations: ["sequencer"] }),
      }),
    ).toThrow(/active Git operation/i);
    expect(() =>
      acquirePrimaryCheckoutLease({
        repositoryIdentity,
        baseDirectory,
        inspectPrimary: () => ({ ...cleanPrimary, statusEntries: null, inspectionErrors: ["status-unreadable"] }),
      }),
    ).toThrow(/could not be inspected completely/i);
  });

  it("recovers a dead owner without letting the stale token release its replacement", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-stale-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const stale = acquirePrimaryCheckoutLease({
      repositoryIdentity,
      baseDirectory,
      ownerWorktree: "C:/repo-task-a",
      processId: 2_147_483_647,
      inspectPrimary: () => cleanPrimary,
    });
    const replacement = acquirePrimaryCheckoutLease({
      repositoryIdentity,
      baseDirectory,
      ownerWorktree: "C:/repo-task-b",
      inspectPrimary: () => cleanPrimary,
      processIsAlive: () => false,
    });

    stale.release();
    expect(existsSync(path.join(replacement.path, "owner.json"))).toBe(true);
    replacement.release();
  });

  it("fails closed for a fresh unreadable ownership record", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-invalid-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const lockPath = primaryCheckoutGuardInternals.lockPathFor(repositoryIdentity, baseDirectory);
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(path.join(lockPath, "owner.json"), "not-json", "utf8");

    expect(() =>
      acquirePrimaryCheckoutLease({
        repositoryIdentity,
        baseDirectory,
        ownerWorktree: "C:/repo-task",
        inspectPrimary: () => cleanPrimary,
      }),
    ).toThrow(/ownership record is unreadable/i);
  });

  it("keeps read-only status available when ownership or dirt exists", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-primary-status-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const lease = acquirePrimaryCheckoutLease({
      repositoryIdentity,
      baseDirectory,
      ownerWorktree: "C:/repo-task-a",
      inspectPrimary: () => cleanPrimary,
      processIsAlive: () => true,
    });

    const status = inspectPrimaryCheckoutOwnership({
      repositoryIdentity,
      baseDirectory,
      inspectPrimary: () => ({ ...cleanPrimary, statusEntries: 1 }),
      processIsAlive: () => true,
    });

    expect(status).toMatchObject({ mutationAllowed: false, primary: { statusEntries: 1 }, owner: { live: true } });
    expect(existsSync(lease.path)).toBe(true);
    lease.release();
  });
});
