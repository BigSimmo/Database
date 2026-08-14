import { describe, expect, it } from "vitest";

import {
  classifyMergeLoss,
  isReconciliationMove,
  parseLogEntries,
  parsePullNumber,
} from "../scripts/audit-merge-loss.mjs";

const INBOX = "docs/outstanding-issues-inbox";

/** Tree-entry table keyed `<ref>:<path>`; a missing key means the path does not exist. */
const reader = (blobs: Record<string, string>) => (ref: string, file: string) => blobs[`${ref}:${file}`] ?? null;

const landing = (pullNumber: number, files: string[]) => ({
  sha: `sha${pullNumber}`,
  date: "2026-08-11T00:00:00+00:00",
  subject: `subject (#${pullNumber})`,
  pullNumber,
  preRef: "pre",
  files,
});

describe("merge-loss subject parsing", () => {
  it("reads a merge landing", () => {
    expect(parsePullNumber("Merge pull request #1935 from BigSimmo/codex/fix-ecg")).toBe(1935);
  });

  it("reads a squash landing", () => {
    expect(parsePullNumber("ci: speed iteration without weakening gates (#1926)")).toBe(1926);
  });

  it("prefers the trailing number when the subject also cites an issue", () => {
    // GitHub appends the PR number, so the last parenthesised number wins.
    expect(parsePullNumber("docs(issues): close #170 and (#309) partially (#1925)")).toBe(1925);
  });

  it("returns undefined for a commit that is not a pull request landing", () => {
    expect(parsePullNumber("Merge branch 'main' into claude/feature")).toBeUndefined();
    expect(parsePullNumber("wip")).toBeUndefined();
    expect(parsePullNumber("")).toBeUndefined();
  });

  it("parses tab-delimited log lines and keeps a subject containing tabs", () => {
    const entries = parseLogEntries("abc\t2026-08-14T06:00:11+08:00\tfix: thing\there (#12)\n\n");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ sha: "abc", pullNumber: 12 });
    expect(entries[0].subject).toBe("fix: thing\there (#12)");
  });
});

describe("merge-loss classification", () => {
  it("does not flag a file whose change is still present", () => {
    const entryAt = reader({ "pre:kept.ts": "aaa", "head:kept.ts": "bbb" });
    expect(classifyMergeLoss({ ref: "head", entryAt, landings: [landing(1, ["kept.ts"])] }).findings).toEqual([]);
  });

  it("flags a file that reverted to its pre-merge blob", () => {
    // The acf78bf case: the landing's contribution to this file is gone.
    const entryAt = reader({ "pre:lost.ts": "ccc", "head:lost.ts": "ccc" });
    const { findings } = classifyMergeLoss({ ref: "head", entryAt, landings: [landing(1803, ["lost.ts"])] });
    expect(findings).toHaveLength(1);
    expect(findings[0].pullNumber).toBe(1803);
    expect(findings[0].revertedFiles).toEqual([{ file: "lost.ts", absent: false }]);
  });

  it("flags a file the pull request added that is absent again", () => {
    // Absent before and absent now: the addition was undone.
    const { findings } = classifyMergeLoss({ ref: "head", entryAt: reader({}), landings: [landing(1, ["added.ts"])] });
    expect(findings[0].revertedFiles).toEqual([{ file: "added.ts", absent: true }]);
  });

  it("does not flag a deletion that survived", () => {
    // Present before, absent now — the pull request deleted it and it stayed deleted.
    const entryAt = reader({ "pre:removed.ts": "ddd" });
    expect(classifyMergeLoss({ ref: "head", entryAt, landings: [landing(1, ["removed.ts"])] }).findings).toEqual([]);
  });

  it("does not flag a surviving mode-only change", () => {
    const entryAt = reader({
      "pre:script.sh": "100644 blob aaa",
      "head:script.sh": "100755 blob aaa",
    });
    expect(classifyMergeLoss({ ref: "head", entryAt, landings: [landing(1, ["script.sh"])] }).findings).toEqual([]);
  });

  it("skips commits with no pull request number instead of dropping them silently", () => {
    const result = classifyMergeLoss({
      ref: "head",
      entryAt: reader({}),
      landings: [
        { sha: "x", date: "d", subject: "Merge branch 'main'", pullNumber: undefined, preRef: "pre", files: [] },
      ],
    });
    expect(result.findings).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.scannedLandings).toBe(0);
  });

  it("orders findings by how much of the landing is missing", () => {
    const entryAt = reader({ "pre:a.ts": "1", "head:a.ts": "1", "pre:b.ts": "2", "head:b.ts": "2" });
    const { findings } = classifyMergeLoss({
      ref: "head",
      entryAt,
      landings: [landing(10, ["a.ts"]), landing(20, ["a.ts", "b.ts"])],
    });
    expect(findings.map((finding) => finding.pullNumber)).toEqual([20, 10]);
  });
});

describe("merge-loss reconciliation exemption", () => {
  const request = `${INBOX}/11111111-1111-4111-8111-111111111111.json`;
  const applied = `${INBOX}/applied/11111111-1111-4111-8111-111111111111.json`;

  it("does not report an inbox request that reconcile moved to applied/", () => {
    // issues:reconcile moves the request verbatim; that is its lifecycle, not a loss.
    const result = classifyMergeLoss({
      ref: "head",
      entryAt: reader({ [`sha1915:${request}`]: "100644 blob eee", [`head:${applied}`]: "100644 blob eee" }),
      landings: [landing(1915, [request])],
    });
    expect(result.findings).toEqual([]);
    expect(result.filesExempted).toBe(1);
  });

  it("still reports an inbox request that vanished without an audit record", () => {
    // No applied/ counterpart means the request was genuinely lost.
    const result = classifyMergeLoss({ ref: "head", entryAt: reader({}), landings: [landing(1915, [request])] });
    expect(result.findings).toHaveLength(1);
    expect(result.filesExempted).toBe(0);
  });

  it("credits only a verbatim move to the matching request filename", () => {
    const entryAt = reader({ [`landing:${request}`]: "100644 blob eee", [`head:${applied}`]: "100644 blob eee" });
    expect(isReconciliationMove(request, "landing", "head", entryAt)).toBe(true);
    expect(isReconciliationMove(`${INBOX}/22222222-2222-4222-8222-222222222222.json`, "landing", "head", entryAt)).toBe(
      false,
    );
    expect(isReconciliationMove("src/lib/rag/rag.ts", "landing", "head", entryAt)).toBe(false);
    expect(isReconciliationMove(applied, "landing", "head", entryAt)).toBe(false);
  });

  it("reports a missing request when its applied record has different contents", () => {
    const result = classifyMergeLoss({
      ref: "head",
      entryAt: reader({ [`sha1915:${request}`]: "100644 blob original", [`head:${applied}`]: "100644 blob changed" }),
      landings: [landing(1915, [request])],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.filesExempted).toBe(0);
  });
});
