import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { format as prettierFormat, resolveConfig as resolvePrettierConfig } from "prettier";
import { describe, expect, it } from "vitest";

import {
  compareRecordsByHash,
  dispersalKey,
  isSortedByHash,
  mergeLedgerRecords,
  parseLedgerShape,
  rebuildLedger,
  sortRecordsByHash,
  type LedgerShape,
} from "../scripts/merge-source-acquisitions";
import type { SourceAcquisitionRecord } from "../src/lib/sources/acquisition-ledger";
import {
  assertGithubAllowed,
  consecutivePairs,
  countHotFileConflicts,
  countMergeCommits,
  countMergeCommitsAcrossPRs,
  isMergeOrResolveHeadline,
  parseMergeTreeConflicts,
  preResolutionHead,
  prsTouchingFile,
  sortByMergedAt,
} from "../scripts/measure-hot-file-conflicts.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function record(overrides: Partial<SourceAcquisitionRecord> & { id: string }): SourceAcquisitionRecord {
  return {
    title: `Title for ${overrides.id}`,
    publisher: "Test Publisher",
    publisherCode: null,
    canonicalUrl: null,
    jurisdiction: "Australia/WA",
    version: "v1",
    publicationDate: "2026-01-01",
    datePrecision: "day",
    reviewDate: null,
    expiryDate: null,
    evidenceType: "guideline",
    documentStatus: "current",
    validationStatus: "unverified",
    contentMode: "link_only",
    topics: [],
    rung: 2,
    capturedAt: "2026-09-06",
    capturedFor: "Test capture",
    disposition: "candidate",
    dispositionReason: "Awaiting sign-off",
    supersededBy: [],
    notes: null,
    ...overrides,
  };
}

function withField(source: SourceAcquisitionRecord, field: keyof SourceAcquisitionRecord, value: unknown) {
  return { ...source, [field]: value };
}

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, ["scripts/run-tsx.mjs", "scripts/merge-source-acquisitions.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error) {
    throw new Error(`CLI failed to start: ${result.error.message}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("mergeLedgerRecords", () => {
  it("merges disjoint additions from both sides cleanly", () => {
    const base = [record({ id: "shared-a" })];
    const ours = [base[0], record({ id: "added-by-ours" })];
    const theirs = [base[0], record({ id: "added-by-theirs" })];

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(errors).toEqual([]);
    expect(records.map((r) => r.id).sort()).toEqual(["added-by-ours", "added-by-theirs", "shared-a"]);
  });

  it("fails, naming the id, when the same id is changed differently on both sides", () => {
    const base = [record({ id: "contested", title: "Base title" })];
    const ours = [withField(base[0], "title", "Ours title")];
    const theirs = [withField(base[0], "title", "Theirs title")];

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(records).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("contested");
    expect(errors[0]).toContain("changed differently");
  });

  it("fails when one side deletes a record the other side edited", () => {
    const base = [record({ id: "doomed", title: "Base title" })];
    const ours: SourceAcquisitionRecord[] = []; // deleted on ours
    const theirs = [withField(base[0], "title", "Theirs edited title")]; // edited on theirs

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(records).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("doomed");
    expect(errors[0]).toContain("deleted on one side and changed on the other");
  });

  it("deletes a record cleanly when one side deletes it and the other leaves it unchanged", () => {
    const base = [record({ id: "kept" }), record({ id: "removed" })];
    const ours = [base[0]]; // deleted "removed"
    const theirs = [base[0], base[1]]; // unchanged

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(errors).toEqual([]);
    expect(records.map((r) => r.id)).toEqual(["kept"]);
  });

  it("merges an identical change on both sides once, not twice", () => {
    const base = [record({ id: "both-edit", title: "Base title" })];
    const editedSameWay = withField(base[0], "title", "Same new title");
    const ours = [editedSameWay];
    const theirs = [{ ...editedSameWay }]; // structurally identical, different object identity

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("Same new title");
  });

  it("fails, naming the id, when both sides add the same id with different content", () => {
    const base: SourceAcquisitionRecord[] = [];
    const ours = [record({ id: "new-id", title: "Ours version" })];
    const theirs = [record({ id: "new-id", title: "Theirs version" })];

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(records).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("new-id");
  });

  it("fails on a duplicate id within a single side", () => {
    const base: SourceAcquisitionRecord[] = [];
    const ours = [record({ id: "dup" }), record({ id: "dup", title: "second copy" })];
    const theirs: SourceAcquisitionRecord[] = [];

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(records).toEqual([]);
    expect(errors.some((e) => e.includes("dup") && e.includes("duplicate id"))).toBe(true);
  });

  it("returns the merged result already sorted by sha1(id)", () => {
    const base: SourceAcquisitionRecord[] = [];
    const ours = [record({ id: "zzz-last-alphabetically" }), record({ id: "aaa-first-alphabetically" })];
    const theirs: SourceAcquisitionRecord[] = [];

    const { records, errors } = mergeLedgerRecords(base, ours, theirs);

    expect(errors).toEqual([]);
    for (let i = 1; i < records.length; i++) {
      expect(compareRecordsByHash(records[i - 1], records[i])).toBeLessThanOrEqual(0);
    }
    expect(isSortedByHash(records)).toBe(true);
  });
});

describe("dispersalKey / sortRecordsByHash", () => {
  it("is not alphabetical order — it disperses ids by their hash", () => {
    const ids = ["alpha", "beta", "gamma", "delta", "epsilon"];
    const alphabetical = [...ids].sort();
    const hashOrder = [...ids].sort((a, b) => dispersalKey(a).localeCompare(dispersalKey(b)));
    expect(hashOrder).not.toEqual(alphabetical);
  });

  it("sorts records into sha1(id) order", () => {
    const records = ["c", "a", "b"].map((id) => record({ id }));
    const sorted = sortRecordsByHash(records);
    expect(isSortedByHash(sorted)).toBe(true);
    // Same set of ids preserved.
    expect(sorted.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("parseLedgerShape / rebuildLedger", () => {
  it("round-trips a bare array", () => {
    const records = [record({ id: "a" }), record({ id: "b" })];
    const { shape, records: parsed } = parseLedgerShape(records);
    expect(shape).toEqual({ kind: "array" });
    expect(rebuildLedger(shape, parsed)).toEqual(records);
  });

  it("round-trips an object wrapping the array", () => {
    const records = [record({ id: "a" })];
    const wrapped = { schemaVersion: 1, records };
    const { shape, records: parsed } = parseLedgerShape(wrapped);
    expect((shape as LedgerShape & { kind: "wrapped" }).key).toBe("records");
    expect(rebuildLedger(shape, parsed)).toEqual(wrapped);
  });
});

describe("--fix-order CLI", () => {
  function makeSandbox(records: SourceAcquisitionRecord[]) {
    const dir = mkdtempSync(path.join(tmpdir(), "source-acquisitions-fix-order-"));
    const file = path.join(dir, "source-acquisitions.json");
    writeFileSync(file, JSON.stringify(records, null, 2) + "\n");
    return { dir, file };
  }

  it("is idempotent: running it twice produces no further diff", () => {
    const { dir, file } = makeSandbox(["mmm", "aaa", "zzz", "bbb"].map((id) => record({ id })));
    try {
      const first = runCli(["--fix-order", "--file", file]);
      expect(first.status, first.stderr).toBe(0);
      const afterFirst = readFileSync(file, "utf8");

      const second = runCli(["--fix-order", "--file", file]);
      expect(second.status, second.stderr).toBe(0);
      const afterSecond = readFileSync(file, "utf8");

      expect(afterSecond).toBe(afterFirst);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("writes prettier-clean, sha1(id)-sorted output", async () => {
    const { dir, file } = makeSandbox(["mmm", "aaa", "zzz"].map((id) => record({ id })));
    try {
      const result = runCli(["--fix-order", "--file", file]);
      expect(result.status, result.stderr).toBe(0);

      const raw = readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as SourceAcquisitionRecord[];
      expect(isSortedByHash(parsed)).toBe(true);

      // Reformatting prettier-clean output must be a no-op.
      const options = (await resolvePrettierConfig(file)) ?? {};
      const reformatted = await prettierFormat(raw, { ...options, filepath: file, parser: "json" });
      expect(reformatted).toBe(raw);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("--check-order CLI exit code", () => {
  function makeSandbox(records: SourceAcquisitionRecord[]) {
    const dir = mkdtempSync(path.join(tmpdir(), "source-acquisitions-check-order-"));
    const file = path.join(dir, "source-acquisitions.json");
    writeFileSync(file, JSON.stringify(records, null, 2) + "\n");
    return { dir, file };
  }

  it("exits 0 when the file is already in sha1(id) order", () => {
    const sorted = sortRecordsByHash(["a", "b", "c"].map((id) => record({ id })));
    const { dir, file } = makeSandbox(sorted);
    try {
      const result = runCli(["--check-order", "--file", file]);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("exits 1 when the file is not in sha1(id) order", () => {
    // Deliberately not hash-sorted: insertion order, not sha1(id) order.
    const unsorted = ["mmm", "aaa", "zzz"].map((id) => record({ id }));
    const { dir, file } = makeSandbox(unsorted);
    try {
      const result = runCli(["--check-order", "--file", file]);
      expect(result.status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("real source-acquisitions.json", () => {
  it("preserves the exact record set (sorted-by-id equality) through an in-memory fix-order", () => {
    const raw = readFileSync(path.join(repoRoot, "src/data/source-acquisitions.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const { records } = parseLedgerShape(parsed);

    const sorted = sortRecordsByHash(records);

    expect(sorted).toHaveLength(records.length);
    const byId = (list: SourceAcquisitionRecord[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(sorted)).toEqual(byId(records));
    expect(isSortedByHash(sorted)).toBe(true);
  });
});

describe("measure-hot-file-conflicts pure counting", () => {
  const filePath = "src/data/source-acquisitions.json";

  it("filters PRs to those touching the hot file", () => {
    const prs = [
      { number: 1, files: [{ path: filePath }] },
      { number: 2, files: [{ path: "src/other-file.ts" }] },
      { number: 3, files: [{ path: "src/other-file.ts" }, { path: filePath }] },
    ];
    expect(prsTouchingFile(prs, filePath).map((pr: { number: number }) => pr.number)).toEqual([1, 3]);
  });

  it("pairs up consecutive items in list order", () => {
    const items = [{ number: 1 }, { number: 2 }, { number: 3 }];
    expect(consecutivePairs(items)).toEqual([
      [{ number: 1 }, { number: 2 }],
      [{ number: 2 }, { number: 3 }],
    ]);
    expect(consecutivePairs([{ number: 1 }])).toEqual([]);
  });

  it("parses git merge-tree --name-only output for conflicted paths", () => {
    // Captured verbatim from `git merge-tree --write-tree --name-only <a> <b>`
    // on two branches that both touch f1.txt and f2.txt.
    const conflictOutput =
      "57f294359452faca41987f6127d5e245b0df7a5a\n" +
      "f1.txt\n" +
      "f2.txt\n" +
      "\n" +
      "Auto-merging f1.txt\n" +
      "CONFLICT (content): Merge conflict in f1.txt\n" +
      "Auto-merging f2.txt\n" +
      "CONFLICT (content): Merge conflict in f2.txt\n";
    expect(parseMergeTreeConflicts(conflictOutput)).toEqual(["f1.txt", "f2.txt"]);

    // A clean merge prints only the resulting tree OID — no blank line, no paths.
    const cleanOutput = "8e58d60c892ceec26013d14cd2ff7bf91ef23ae7\n";
    expect(parseMergeTreeConflicts(cleanOutput)).toEqual([]);
  });

  it("counts pairs that actually conflict on the hot file, using an injected merge-tree lookup", () => {
    const pairs = [
      [
        { number: 1, headRefOid: "a1" },
        { number: 2, headRefOid: "a2" },
      ],
      [
        { number: 2, headRefOid: "a2" },
        { number: 3, headRefOid: "a3" },
      ],
    ];
    const fakeMergeTree = (headA: string, headB: string) => {
      if (headA === "a1" && headB === "a2") return [filePath, "unrelated.txt"];
      return ["unrelated.txt"]; // no conflict on the hot file
    };

    const result = countHotFileConflicts(pairs, filePath, fakeMergeTree);
    expect(result.total).toBe(2);
    expect(result.conflicting).toBe(1);
    expect(result.details[0].conflict).toBe(true);
    expect(result.details[1].conflict).toBe(false);
  });

  it("recognizes merge/resolve commit headlines case-insensitively, anchored to the start", () => {
    expect(isMergeOrResolveHeadline("Merge branch 'main' into feature")).toBe(true);
    expect(isMergeOrResolveHeadline("resolve merge conflicts in ledger")).toBe(true);
    expect(isMergeOrResolveHeadline("RESOLVED the ledger conflict")).toBe(true);
    expect(isMergeOrResolveHeadline("fix(sources): add a new merge helper")).toBe(false);
    expect(isMergeOrResolveHeadline(undefined)).toBe(false);
  });

  it("counts merge/resolve commits per PR and across PRs", () => {
    const prs = [
      {
        number: 10,
        commits: [{ messageHeadline: "Merge branch 'main'" }, { messageHeadline: "feat: add source" }],
      },
      {
        number: 11,
        commits: [{ messageHeadline: "resolve conflicts" }, { messageHeadline: "resolve again" }],
      },
      { number: 12, commits: [{ messageHeadline: "feat: unrelated" }] },
    ];
    expect(countMergeCommits(prs[0])).toBe(1);
    expect(countMergeCommits(prs[1])).toBe(2);
    expect(countMergeCommits(prs[2])).toBe(0);

    const across = countMergeCommitsAcrossPRs(prs);
    expect(across.total).toBe(3);
    expect(across.perPr).toEqual([
      { number: 10, mergeCommits: 1 },
      { number: 11, mergeCommits: 2 },
      { number: 12, mergeCommits: 0 },
    ]);
  });

  it("refuses to query GitHub without explicit --allow-github", () => {
    expect(() => assertGithubAllowed({ since: "2026-08-01" })).toThrow(/--allow-github/);
    expect(() => assertGithubAllowed({ since: "2026-08-01", allowGithub: true })).not.toThrow();
  });

  it("orders merged PRs by mergedAt before pairing, whatever order gh returned", () => {
    const prs = [
      { number: 7, mergedAt: "2026-09-03T00:00:00Z" },
      { number: 5, mergedAt: "2026-09-01T00:00:00Z" },
      { number: 6, mergedAt: "2026-09-02T00:00:00Z" },
    ];
    expect(sortByMergedAt(prs).map((pr: { number: number }) => pr.number)).toEqual([5, 6, 7]);
    expect(prs.map((pr) => pr.number)).toEqual([7, 5, 6]);
  });

  it("measures the head before the first merge-in commit, not the resolved final head", () => {
    const pr = {
      headRefOid: "final",
      commits: [
        { oid: "c1", messageHeadline: "feat: add source" },
        { oid: "c2", messageHeadline: "feat: add another" },
        { oid: "m1", messageHeadline: "Merge branch 'main' into feature" },
        { oid: "final", messageHeadline: "fix: after merge" },
      ],
    };
    expect(preResolutionHead(pr)).toBe("c2");
    expect(preResolutionHead({ headRefOid: "h", commits: [{ oid: "h", messageHeadline: "feat: x" }] })).toBe("h");
    expect(preResolutionHead({ headRefOid: "h" })).toBe("h");
  });

  it("counts an uncomputable merge as unavailable, never as clean", () => {
    const pairs = [
      [
        { number: 1, headRefOid: "a1" },
        { number: 2, headRefOid: "missing" },
      ],
    ];
    const result = countHotFileConflicts(pairs, filePath, () => null);
    expect(result.conflicting).toBe(0);
    expect(result.unavailable).toBe(1);
    expect(result.details[0].unavailable).toBe(true);
  });
});
