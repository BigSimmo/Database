import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  RAG_IMPACT_HINT,
  RAG_IMPACT_PLACEHOLDER,
  formatPrAreaLines,
  prAreas,
} from "../scripts/organisation/pr-areas.mjs";
import { classifyPullRequestFiles, evaluatePullRequestPolicy, ragImpactDeclared } from "../scripts/pr-policy.mjs";

const HELPER = path.resolve(__dirname, "../scripts/organisation/pr-areas.mjs");
const TEMPLATE = path.resolve(__dirname, "../.github/pull_request_template.md");
const HANDOFF_SKILL = path.resolve(__dirname, "../.claude/skills/handoff/SKILL.md");
const roots: string[] = [];

type Files = Record<string, string>;

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "-C", root, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(root: string, files: Files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
}

// A small map in the real format: three areas, one shared file and one ignored folder.
const AREAS: Record<string, { name: string; paths: string[] }> = {
  "answer-engine": { name: "Answer engine", paths: ["src/lib/clinical-ask/**", "src/lib/rag/**"] },
  "source-intake": { name: "Source intake and indexing", paths: ["src/lib/chunking.ts"] },
  knowledge: { name: "Knowledge and records", paths: ["handbook/**"] },
};

function mapFiles(): Files {
  const files: Files = {};
  for (const [id, { name, paths }] of Object.entries(AREAS)) {
    files[`docs/organisation/systems/${id}.json`] = JSON.stringify({
      version: 1,
      id,
      kind: "area",
      name,
      owns: `what ${name} owns`,
      canonicalDocs: [],
      paths: [...paths].sort(),
    });
  }
  files["docs/organisation/shared.json"] = JSON.stringify({
    version: 1,
    entries: [{ path: "src/lib/both.ts", systems: ["answer-engine", "source-intake"], reason: "does both jobs" }],
  });
  files["docs/organisation/not-yet-placed.json"] = JSON.stringify({ version: 1, entries: [] });
  files["docs/organisation/ignored.json"] = JSON.stringify({
    version: 1,
    entries: [{ match: "retired/**", reason: "being removed" }],
  });
  files["docs/organisation/kinds.json"] = JSON.stringify({ version: 1, generated: [], records: [], historical: [] });
  files["docs/organisation/pins.json"] = JSON.stringify({ version: 1, pins: {} });
  return files;
}

const BASE_FILES: Files = {
  ...mapFiles(),
  "src/lib/rag/rag.ts": "export const a = 1;\n",
  "src/lib/chunking.ts": "export const c = 1;\n",
  "src/lib/clinical-ask/pipeline.ts": "export const p = 1;\n",
  "src/lib/both.ts": "export const b = 1;\n",
  "handbook/guide.md": "# Guide\n",
  "retired/old.ts": "export {};\n",
};

/** A repository whose `main` holds the base files, checked out on a `feature` branch. */
function repo(files: Files = BASE_FILES) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-pr-areas-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  write(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  git(root, "checkout", "-q", "-b", "feature");
  return root;
}

function change(root: string, files: Files, remove: string[] = []) {
  write(root, files);
  for (const file of remove) git(root, "rm", "-q", file);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "change");
}

function helper(root: string, args: string[] = ["--base", "main"]) {
  const result = spawnSync(process.execPath, [HELPER, "--root", root, ...args], { encoding: "utf8" });
  return { code: result.status, lines: result.stdout.trim().split("\n").filter(Boolean), stderr: result.stderr };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("RAG impact placeholder", () => {
  it("is declared but never satisfies pr-policy until a person replaces it", () => {
    const pasted = [RAG_IMPACT_PLACEHOLDER, RAG_IMPACT_HINT].join("\n");
    expect(ragImpactDeclared(RAG_IMPACT_PLACEHOLDER)).toEqual({ declared: true, satisfied: false });
    expect(ragImpactDeclared(pasted)).toEqual({ declared: true, satisfied: false });
    // The hint names both accepted forms, yet on its own line pr-policy never reads it as a declaration.
    expect(ragImpactDeclared(RAG_IMPACT_HINT).declared).toBe(false);
  });

  it("makes pr-policy warn on a pasted but unedited placeholder, and stops once it is replaced", () => {
    const policy = (rag: string) =>
      evaluatePullRequestPolicy({
        title: "Tune the retrieval candidate fan-out",
        body: `## Summary\n\n- Tune the fan-out.\n\nAreas touched: Answer engine\n${rag}\n${RAG_IMPACT_HINT}\n`,
        headRef: "feature",
        files: ["src/lib/rag/rag.ts"],
        fileStatuses: undefined,
        baseMigrationVersions: undefined,
        addedMigrationContents: undefined,
        changedWorkflowContents: undefined,
      }).warnings.filter((warning: string) => warning.includes("RAG impact"));

    expect(policy(RAG_IMPACT_PLACEHOLDER)).toHaveLength(1);
    expect(policy("RAG impact: no retrieval behaviour change — renames a local variable only")).toEqual([]);
    expect(policy("RAG impact: behaviour change — canary pair 101 -> 102")).toEqual([]);
  });

  it("refuses to print a placeholder that pr-policy would accept", () => {
    const lines = formatPrAreaLines({ fileCount: 1, areas: [{ name: "Answer engine" }], ragRanking: true });
    expect(lines).toEqual(["Areas touched: Answer engine", RAG_IMPACT_PLACEHOLDER, RAG_IMPACT_HINT]);
    expect(ragImpactDeclared(lines.join("\n")).satisfied).toBe(false);
  });
});

describe("areas touched line", () => {
  it("names each area a change touches, then the RAG impact placeholder for a ranking file", () => {
    const root = repo();
    change(root, { "src/lib/rag/rag.ts": "export const a = 2;\n", "handbook/guide.md": "# Guide v2\n" });
    const { code, lines } = helper(root);
    expect(code).toBe(0);
    expect(lines).toEqual([
      "Areas touched: Answer engine, Knowledge and records",
      RAG_IMPACT_PLACEHOLDER,
      RAG_IMPACT_HINT,
    ]);
    expect(ragImpactDeclared(lines.join("\n")).satisfied).toBe(false);
  });

  it("prints no RAG impact line when nothing ranking-protected changed", () => {
    const root = repo();
    change(root, { "handbook/guide.md": "# Guide v2\n", "handbook/new.md": "# New\n" });
    expect(classifyPullRequestFiles(["handbook/guide.md", "handbook/new.md"]).ragRanking).toBe(false);
    expect(helper(root).lines).toEqual(["Areas touched: Knowledge and records"]);
  });

  it("lets pr-policy, never the map, decide that ranking was touched", () => {
    // Placed in Answer engine by the map, but not on pr-policy's ranking list: no placeholder.
    expect(classifyPullRequestFiles(["src/lib/clinical-ask/pipeline.ts"]).ragRanking).toBe(false);
    const notRanking = repo();
    change(notRanking, { "src/lib/clinical-ask/pipeline.ts": "export const p = 2;\n" });
    expect(helper(notRanking).lines).toEqual(["Areas touched: Answer engine"]);

    // Placed outside Answer engine by the map, but on pr-policy's ranking list: placeholder.
    expect(classifyPullRequestFiles(["src/lib/chunking.ts"]).ragRanking).toBe(true);
    const ranking = repo();
    change(ranking, { "src/lib/chunking.ts": "export const c = 2;\n" });
    expect(helper(ranking).lines).toEqual([
      "Areas touched: Source intake and indexing",
      RAG_IMPACT_PLACEHOLDER,
      RAG_IMPACT_HINT,
    ]);
  });

  it("orders areas by how many files they touch and counts a shared file for each of its areas", () => {
    const root = repo();
    change(root, {
      "handbook/guide.md": "# Guide v2\n",
      "handbook/a.md": "# A\n",
      "src/lib/both.ts": "export const b = 2;\n",
    });
    expect(helper(root).lines).toEqual([
      "Areas touched: Knowledge and records, Answer engine, Source intake and indexing",
    ]);
  });

  it("places a deleted file by the map at the base and a renamed file by both of its paths", () => {
    const root = repo();
    change(root, {}, ["src/lib/clinical-ask/pipeline.ts"]);
    expect(helper(root).lines).toEqual(["Areas touched: Answer engine"]);

    const renamed = repo();
    git(renamed, "mv", "src/lib/rag/rag.ts", "handbook/rag-notes.md");
    git(renamed, "commit", "-q", "-m", "move");
    // The old path is ranking-protected, so moving a file out of the protected tree still asks.
    expect(helper(renamed).lines).toEqual([
      "Areas touched: Answer engine, Knowledge and records",
      RAG_IMPACT_PLACEHOLDER,
      RAG_IMPACT_HINT,
    ]);
  });

  it("reports files the map has not placed and skips ignored files", () => {
    const root = repo();
    change(root, {
      "handbook/guide.md": "# Guide v2\n",
      "loose/new.ts": "export {};\n",
      "retired/old.ts": "// gone\n",
    });
    expect(helper(root).lines).toEqual([
      "Areas touched: Knowledge and records (plus 1 file not yet placed in any area)",
    ]);

    const onlyUnplaced = repo();
    change(onlyUnplaced, { "loose/a.ts": "export {};\n", "loose/b.ts": "export {};\n" });
    expect(helper(onlyUnplaced).lines).toEqual(["Areas touched: none placed yet (2 files not yet placed in any area)"]);

    const onlyIgnored = repo();
    change(onlyIgnored, { "retired/old.ts": "// gone\n" });
    expect(helper(onlyIgnored).lines).toEqual(["Areas touched: none (only ignored files changed)"]);

    expect(helper(repo()).lines).toEqual(["Areas touched: none (no changed files)"]);
  });

  it("returns the same result through the exported function", () => {
    const root = repo();
    change(root, { "src/lib/rag/rag.ts": "export const a = 3;\n" });
    const result = prAreas({ root, base: "main" });
    expect(result.files).toEqual(["src/lib/rag/rag.ts"]);
    expect(result.ragRanking).toBe(true);
    expect(result.areas.map((area: { id: string }) => area.id)).toEqual(["answer-engine"]);
    expect(result.lines[0]).toBe("Areas touched: Answer engine");
  });
});

describe("compared range", () => {
  it("defaults the base to the merge-base with a local origin/main and never needs a fetch", () => {
    const root = repo();
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    change(root, { "handbook/guide.md": "# Guide v2\n" });
    // main moves on after the branch point; only the branch's own change counts.
    git(root, "checkout", "-q", "main");
    change(root, { "src/lib/rag/rag.ts": "export const a = 9;\n" });
    git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "main"));
    git(root, "checkout", "-q", "feature");
    expect(helper(root, []).lines).toEqual(["Areas touched: Knowledge and records"]);
  });

  it("stops with exit 2 and asks for --base when there is no local origin/main", () => {
    const root = repo();
    const { code, lines, stderr } = helper(root, []);
    expect(code).toBe(2);
    expect(lines).toEqual([]);
    expect(stderr).toContain("pass --base <ref>");
  });

  it("stops with exit 2 on a base that is not a commit", () => {
    const { code, stderr } = helper(repo(), ["--base", "no-such-branch"]);
    expect(code).toBe(2);
    expect(stderr).toContain("no-such-branch");
  });
});

describe("PR template and handoff skill", () => {
  it("keeps an unfilled summary visible to pr-policy while offering the areas line", () => {
    const template = fs.readFileSync(TEMPLATE, "utf8");
    const summary = template.slice(template.indexOf("## Summary"), template.indexOf("## Verification"));
    expect(summary).toContain("Areas touched");
    expect(summary).toContain("npm run pr:areas");
    // A bare `Areas touched:` line would count as summary text and silence the empty-summary warning.
    const warnings = evaluatePullRequestPolicy({
      title: "Improve the organisation helper output",
      body: template,
      headRef: "feature",
      files: ["docs/guide.md"],
      fileStatuses: undefined,
      baseMigrationVersions: undefined,
      addedMigrationContents: undefined,
      changedWorkflowContents: undefined,
    }).warnings;
    expect(warnings.some((warning: string) => warning.includes("`## Summary`"))).toBe(true);
  });

  it("tells the handoff skill to run the helper and replace the placeholder", () => {
    const skill = fs.readFileSync(HANDOFF_SKILL, "utf8");
    expect(skill).toContain("npm run pr:areas");
    expect(skill).toContain("RAG impact: ???");
  });
});
