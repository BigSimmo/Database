// tests/organisation-path-lists.test.ts
//
// Safety-list coverage checks (organisation framework suggestions 2 and 7): a rename that moves a
// file off a safety list is flagged loudly, a deleted safety-listed file gets a plain warning, and
// exact names on a list that match no tracked file are reported as dead. Most cases inject a small
// classifier or pattern list so they never depend on the real repository's lists.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  coverageLossFindings,
  deadEntryFindings,
  literalAlternatives,
  parseNameStatus,
} from "../scripts/organisation/path-lists.mjs";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "-C", root, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
}

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-path-lists-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  write(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  return root;
}

function commit(root: string, message = "change") {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
}

// Enough distinct text that git's similarity check pairs a moved file with its old path.
const BODY = Array.from({ length: 40 }, (_, line) => `export const line${line} = ${line};`).join("\n") + "\n";

// A small stand-in for pr-policy: two lists, one folder rule each plus one exact name.
const LISTS: Record<string, RegExp[]> = {
  ranking: [/^lib\/rank\//, /^lib\/scoring\.ts$/],
  clinical: [/^lib\/rank\//, /^lib\/clinical\//],
};
const classify = (file: string) =>
  Object.entries(LISTS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(file)))
    .map(([name]) => name);

describe("coverageLossFindings: renames", () => {
  it("flags loudly a rename that moves a file off a safety list", () => {
    const root = repo({ "lib/scoring.ts": BODY });
    fs.mkdirSync(path.join(root, "lib/util"), { recursive: true });
    git(root, "mv", "lib/scoring.ts", "lib/util/scoring.ts");
    commit(root);

    const findings = coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: "warning",
      level: "warning",
      loud: true,
      key: "coverage-lost:lib/util/scoring.ts",
      subject: "lib/util/scoring.ts",
      about: "lib/scoring.ts",
    });
    expect(findings[0].message).toContain("the ranking list");
    expect(findings[0].message).toContain("add `lib/util/scoring.ts` to ranking in scripts/pr-policy.mjs");
  });

  it("stays quiet when the new path keeps every list", () => {
    const root = repo({ "lib/rank/order.ts": BODY });
    git(root, "mv", "lib/rank/order.ts", "lib/rank/ordering.ts");
    commit(root);

    expect(coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify })).toEqual([]);
  });

  it("names only the lists the new path lost", () => {
    const root = repo({ "lib/rank/order.ts": BODY });
    fs.mkdirSync(path.join(root, "lib/clinical"), { recursive: true });
    git(root, "mv", "lib/rank/order.ts", "lib/clinical/order.ts");
    commit(root);

    const [finding] = coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify });
    expect(finding.key).toBe("coverage-lost:lib/clinical/order.ts");
    expect(finding.message).toContain("the ranking list");
    expect(finding.message).not.toContain("the clinical list");
  });

  it("follows a rename that also edits the file", () => {
    const root = repo({ "lib/scoring.ts": BODY });
    fs.mkdirSync(path.join(root, "lib/util"), { recursive: true });
    git(root, "mv", "lib/scoring.ts", "lib/util/scoring.ts");
    fs.appendFileSync(path.join(root, "lib/util/scoring.ts"), "export const extra = true;\n");
    commit(root);

    const findings = coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify });
    expect(findings.map((finding) => finding.key)).toEqual(["coverage-lost:lib/util/scoring.ts"]);
  });

  it("ignores renames of files that were on no list", () => {
    const root = repo({ "lib/misc.ts": BODY });
    git(root, "mv", "lib/misc.ts", "lib/other.ts");
    commit(root);

    expect(coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify })).toEqual([]);
  });

  it("asks pr-policy by default", () => {
    const root = repo({ "src/lib/rag/probe-module.ts": BODY });
    git(root, "mv", "src/lib/rag/probe-module.ts", "src/lib/probe-module.ts");
    commit(root);

    const [finding] = coverageLossFindings({ root, base: "HEAD~1", head: "HEAD" });
    expect(finding.key).toBe("coverage-lost:src/lib/probe-module.ts");
    expect(finding.message).toContain("ragRankingPatterns");
  });
});

describe("coverageLossFindings: deletions", () => {
  it("gives a plain warning for a deleted safety-listed file", () => {
    const root = repo({ "lib/scoring.ts": BODY, "lib/misc.ts": BODY.replace("line0", "misc0") });
    fs.rmSync(path.join(root, "lib/scoring.ts"));
    commit(root);

    const findings = coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: "warning",
      loud: false,
      key: "coverage-deleted:lib/scoring.ts",
      subject: "lib/scoring.ts",
    });
  });

  it("ignores deleted files that were on no list", () => {
    const root = repo({ "lib/misc.ts": BODY, "lib/keep.ts": "x\n" });
    fs.rmSync(path.join(root, "lib/misc.ts"));
    commit(root);

    expect(coverageLossFindings({ root, base: "HEAD~1", head: "HEAD", classify })).toEqual([]);
  });
});

describe("coverageLossFindings: refuses what it cannot check", () => {
  it("throws when the base cannot be read", () => {
    const root = repo({ "lib/misc.ts": BODY });
    expect(() => coverageLossFindings({ root, base: "no-such-ref", head: "HEAD", classify })).toThrow(
      /git diff failed/,
    );
  });

  it("throws on a revision that looks like an option", () => {
    const root = repo({ "lib/misc.ts": BODY });
    expect(() => coverageLossFindings({ root, base: "--output=x", head: "HEAD", classify })).toThrow(/git revision/);
  });
});

describe("parseNameStatus", () => {
  it("reads renames, deletions and additions from -z output", () => {
    expect(parseNameStatus("R087\0a/old.ts\0b/new.ts\0D\0gone.ts\0A\0added.ts\0")).toEqual([
      { status: "R", from: "a/old.ts", path: "b/new.ts" },
      { status: "D", path: "gone.ts" },
      { status: "A", path: "added.ts" },
    ]);
  });
});

describe("deadEntryFindings: exact names", () => {
  it("splits a grouped alternation and reports only the missing names", () => {
    const findings = deadEntryFindings({
      trackedFiles: ["src/lib/alpha.ts"],
      lists: { ragRanking: [/^src\/lib\/(?:alpha|beta)\.ts$/] },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: "warning",
      loud: false,
      key: "dead-entry:ragRanking:src/lib/beta.ts",
      subject: "src/lib/beta.ts",
      about: "scripts/pr-policy.mjs",
    });
    expect(findings[0].message).toContain("ragRankingPatterns");
  });

  it("splits nested groups into single names", () => {
    const findings = deadEntryFindings({
      trackedFiles: ["tests/a-one.test.ts", "tests/helpers/c.ts"],
      lists: { clinicalRisk: [/^tests\/(?:a-(?:one|two)\.test|b\.test|helpers\/c)\.ts$/] },
    });
    expect(findings.map((finding) => finding.subject)).toEqual(["tests/a-two.test.ts", "tests/b.test.ts"]);
  });

  it("respects a case-insensitive pattern", () => {
    expect(
      deadEntryFindings({ trackedFiles: ["src/lib/Alpha.ts"], lists: { ranking: [/^src\/lib\/alpha\.ts$/i] } }),
    ).toEqual([]);
  });

  it("reads tracked files from git, ignoring untracked ones", () => {
    const root = repo({ "src/lib/alpha.ts": "a\n" });
    write(root, { "src/lib/beta.ts": "untracked\n" });
    const findings = deadEntryFindings({ root, lists: { ranking: [/^src\/lib\/(?:alpha|beta)\.ts$/] } });
    expect(findings.map((finding) => finding.subject)).toEqual(["src/lib/beta.ts"]);
  });
});

describe("deadEntryFindings: folders and keyword patterns", () => {
  it("reports a folder prefix no tracked file sits under", () => {
    const findings = deadEntryFindings({
      trackedFiles: ["src/lib/rank/a.ts"],
      lists: { ranking: [/^src\/lib\/rank\//, /^src\/lib\/gone\//] },
    });
    expect(findings.map((finding) => finding.key)).toEqual(["dead-entry:ranking:src/lib/gone/"]);
  });

  it("expands an optional group into each folder", () => {
    const findings = deadEntryFindings({
      trackedFiles: ["src/lib/contacts/a.ts"],
      lists: { clinicalRisk: [/^src\/lib\/contacts(?:-server)?\//] },
    });
    expect(findings.map((finding) => finding.subject)).toEqual(["src/lib/contacts-server/"]);
  });

  it("does not split a keyword pattern, and warns only when it matches nothing", () => {
    const keyword = /^src\/lib\/.*(?:auth|privacy)/i;
    expect(deadEntryFindings({ trackedFiles: ["src/lib/auth-guard.ts"], lists: { clinicalRisk: [keyword] } })).toEqual(
      [],
    );
    const findings = deadEntryFindings({ trackedFiles: ["src/lib/other.ts"], lists: { clinicalRisk: [keyword] } });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ key: `dead-pattern:clinicalRisk:${keyword.source}`, loud: false });
  });

  it("requires tracked files or a root", () => {
    expect(() => deadEntryFindings({ lists: {} })).toThrow(/root or trackedFiles/);
  });
});

describe("literalAlternatives", () => {
  it("expands anchored literal patterns", () => {
    expect(literalAlternatives(/^src\/lib\/chunking\.ts$/)).toEqual({
      anchoredEnd: true,
      texts: ["src/lib/chunking.ts"],
    });
    expect(literalAlternatives(/^(?:src\/data|data)\//)).toEqual({ anchoredEnd: false, texts: ["src/data/", "data/"] });
    expect(literalAlternatives(/^a\$$/)).toEqual({ anchoredEnd: true, texts: ["a$"] });
    expect(literalAlternatives(/^a\$/)).toEqual({ anchoredEnd: false, texts: ["a$"] });
  });

  it("returns null for anything that is not literal text", () => {
    for (const pattern of [
      /^src\/lib\/.*rank/,
      /^src\/lib\/differential[^/]*\.ts$/,
      /^src\/app\/(?!api\/)/,
      /^src\/\bx/,
      /^a+/,
      /^a|b$/,
      /src\/lib\//,
    ]) {
      expect(literalAlternatives(pattern), String(pattern)).toBeNull();
    }
  });
});
