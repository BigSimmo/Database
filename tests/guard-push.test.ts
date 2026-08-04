import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizedSchemaSha256 as driftSha } from "../scripts/check-drift";
import {
  autoMergeVerdict,
  driftVerdict,
  findPrettierBin,
  formatGuard,
  normalizedSchemaSha256 as guardSha,
  parsePushRanges,
} from "../scripts/guard-push.mjs";

const ZERO = "0".repeat(40);
const created: string[] = [];

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

function dependencyFixture(lockMarker: string, withPrettier = false) {
  const root = mkdtempSync(join(tmpdir(), "guard-push-dependencies-"));
  created.push(root);
  const lock = JSON.stringify({
    lockfileVersion: 3,
    marker: lockMarker,
    packages: { "node_modules/prettier": { version: "3.9.6" } },
  });
  writeFileSync(join(root, "package-lock.json"), lock);
  if (withPrettier) {
    mkdirSync(join(root, "node_modules", "prettier", "bin"), { recursive: true });
    writeFileSync(join(root, "node_modules", "prettier", "package.json"), JSON.stringify({ version: "3.9.6" }));
    writeFileSync(join(root, "node_modules", "prettier", "bin", "prettier.cjs"), "");
  }
  return root;
}

describe("guard-push sha parity", () => {
  it("guard-push's sha is byte-identical to check-drift's (they must never diverge)", () => {
    for (const sample of ["create table t();\n", "a\r\nb\r\n", "", "SELECT 1;"]) {
      expect(guardSha(sample)).toBe(driftSha(sample));
    }
  });

  it("normalizes CRLF to LF", () => {
    expect(guardSha("a\r\nb")).toBe(guardSha("a\nb"));
  });
});

describe("auto-merge verdict", () => {
  it("never blocks a non-claude branch", () => {
    expect(autoMergeVerdict("main", { autoMergeRequest: {}, state: "OPEN" }).block).toBe(false);
  });

  it("blocks a claude/* branch with an armed auto-merge on an open PR", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 7 });
    expect(v.block).toBe(true);
    expect(v.number).toBe(7);
  });

  it("does not block when auto-merge is not armed", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN" }).block).toBe(false);
  });

  it("does not block when there is no open PR", () => {
    expect(autoMergeVerdict("claude/x", null).block).toBe(false);
  });

  it("does not block when the PR is not OPEN", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: {}, state: "MERGED" }).block).toBe(false);
  });
});

describe("drift verdict", () => {
  const text = "create table t();\n";
  it("is fresh when the manifest sha matches", () => {
    expect(driftVerdict(text, { schema_sha256: guardSha(text) }).stale).toBe(false);
  });
  it("is stale when the manifest sha differs", () => {
    expect(driftVerdict(text, { schema_sha256: "deadbeef" }).stale).toBe(true);
  });
  it("never false-blocks when the manifest has no sha", () => {
    expect(driftVerdict(text, {}).stale).toBe(false);
  });
});

describe("push-range parsing", () => {
  it("parses a new-branch push (zero remote sha)", () => {
    const ranges = parsePushRanges(`refs/heads/x abc123 refs/heads/x ${ZERO}\n`);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].remoteSha).toBe(ZERO);
  });

  it("skips a branch-deletion push (zero local sha)", () => {
    expect(parsePushRanges(`refs/heads/x ${ZERO} refs/heads/x abc\n`)).toHaveLength(0);
  });

  it("ignores blank lines", () => {
    expect(parsePushRanges("\n  \n")).toHaveLength(0);
  });
});

describe("format dependency resolution", () => {
  it("reuses Prettier only from a byte-identical sibling lockfile", () => {
    const project = dependencyFixture("current");
    const stale = dependencyFixture("stale", true);
    const exact = dependencyFixture("current", true);

    expect(findPrettierBin(project, [stale, exact])).toBe(
      join(exact, "node_modules", "prettier", "bin", "prettier.cjs"),
    );
  });

  it("fails closed when no exact-lock Prettier installation is available", () => {
    const result = formatGuard([{ sha: "abc123", file: "README.md" }], () => {
      throw new Error("missing fixture dependency");
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("npm ci --include=dev");
    expect(result.message).toContain("SKIP_FORMAT_GUARD=1");
  });
});
