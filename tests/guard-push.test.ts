import { describe, expect, it } from "vitest";
import { normalizedSchemaSha256 as driftSha } from "../scripts/check-drift";
import {
  autoMergeVerdict,
  driftVerdict,
  normalizedSchemaSha256 as guardSha,
  parsePushRanges,
} from "../scripts/guard-push.mjs";

const ZERO = "0".repeat(40);

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
