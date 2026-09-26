import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CHECKER = path.resolve(__dirname, "../scripts/check-organisation.mjs");
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

function area(id: string, paths: string[], { sort = true } = {}) {
  return JSON.stringify({
    version: 1,
    id,
    kind: "area",
    name: id,
    owns: `what ${id} owns`,
    canonicalDocs: [],
    paths: sort ? [...paths].sort() : paths,
  });
}

function mapFiles(areas: Record<string, string[]>, lists: Partial<Record<string, unknown[]>> = {}): Files {
  const files: Files = {};
  for (const [id, paths] of Object.entries(areas)) files[`docs/organisation/systems/${id}.json`] = area(id, paths);
  files["docs/organisation/shared.json"] = JSON.stringify({ version: 1, entries: lists.shared ?? [] });
  files["docs/organisation/not-yet-placed.json"] = JSON.stringify({ version: 1, entries: lists.nyp ?? [] });
  files["docs/organisation/ignored.json"] = JSON.stringify({ version: 1, entries: lists.ignored ?? [] });
  files["docs/organisation/kinds.json"] = JSON.stringify({ version: 1, generated: [], records: [], historical: [] });
  files["docs/organisation/pins.json"] = JSON.stringify({ version: 1, pins: {} });
  return files;
}

const MAP_RULE = "docs/organisation/**";

function repo(files: Files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  write(root, files);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  return root;
}

function commit(root: string, files: Files, remove: string[] = []) {
  write(root, files);
  for (const file of remove) fs.rmSync(path.join(root, file));
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "change");
  return git(root, "rev-parse", "HEAD");
}

function check(root: string, args: string[] = [], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [CHECKER, "--root", root, "--no-report", "--json", ...args], {
    encoding: "utf8",
    env: { ...process.env, ORGANISATION_CHECK_MODE: "", GITHUB_STEP_SUMMARY: "", ...env },
  });
  const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{"), result.stdout.lastIndexOf("}") + 1));
  return { code: result.status, report, blocking: report.findings.filter((f: { blocking: boolean }) => f.blocking) };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("check-organisation", () => {
  it("passes a clean map and counts every file", () => {
    const root = repo({
      ...mapFiles({ app: ["src/app/pages/**"], knowledge: [MAP_RULE, "README.md"] }),
      "src/app/pages/a.ts": "",
      "README.md": "",
    });
    const { code, report } = check(root);
    expect(code).toBe(0);
    expect(report.totals).toMatchObject({ unplaced: 0, ambiguous: 0 });
    expect(report.systems.find((s: { id: string }) => s.id === "app").files).toBe(1);
  });

  it("warns about an unplaced file but does not fail (owner decision: soundness only)", () => {
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE] }), "stray.txt": "" });
    const { code, report } = check(root);
    expect(code).toBe(0);
    expect(report.findings).toContainEqual(expect.objectContaining({ key: "unplaced:stray.txt", level: "warning" }));
  });

  it("fails on an exact rule that names a missing file", () => {
    const root = repo(mapFiles({ knowledge: [MAP_RULE, "gone.md"] }));
    const { code, blocking } = check(root);
    expect(code).toBe(1);
    expect(blocking).toContainEqual(expect.objectContaining({ key: "dead-rule:knowledge:gone.md" }));
  });

  it("reports both paths when an exactly mapped file is renamed without its rule", () => {
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE, "old.md"] }), "old.md": "" });
    fs.renameSync(path.join(root, "old.md"), path.join(root, "new.md"));
    git(root, "add", "-A");
    const { code, report } = check(root);
    expect(code).toBe(1);
    const keys = report.findings.map((f: { key: string }) => f.key);
    expect(keys).toContain("dead-rule:knowledge:old.md");
    expect(keys).toContain("unplaced:new.md");
  });

  it("fails when two areas tie for a file, and passes once the file is declared shared", () => {
    const files = { ...mapFiles({ a: ["lib/x-*"], b: ["lib/x-*.ts"], knowledge: [MAP_RULE] }), "lib/x-1.ts": "" };
    const tied = check(repo(files));
    expect(tied.code).toBe(1);
    expect(tied.blocking).toContainEqual(expect.objectContaining({ key: "tie:lib/x-1.ts" }));

    const shared = { path: "lib/x-1.ts", systems: ["a", "b"], reason: "Serves both areas equally." };
    const ok = check(
      repo({
        ...files,
        ...mapFiles({ a: ["lib/x-*"], b: ["lib/x-*.ts"], knowledge: [MAP_RULE] }, { shared: [shared] }),
      }),
    );
    expect(ok.code).toBe(0);
    expect(ok.report.totals.shared).toBe(1);
  });

  it("lets the longer fixed part win before a tie is declared", () => {
    const root = repo({
      ...mapFiles({ ui: ["tests/ui-*"], phone: ["tests/ui-phone-*"], knowledge: [MAP_RULE] }),
      "tests/ui-phone-a.spec.ts": "",
    });
    const { code, report } = check(root);
    expect(code).toBe(0);
    expect(report.systems.find((s: { id: string }) => s.id === "phone").files).toBe(1);
  });

  it("treats route brackets and parentheses literally and keeps * inside one folder", () => {
    const root = repo({
      ...mapFiles({
        app: ["src/app/(search-app)/**", "src/app/api/[id]/route.ts"],
        other: ["src/lib/abc-*"],
        knowledge: [MAP_RULE],
      }),
      "src/app/(search-app)/page.tsx": "",
      "src/app/api/[id]/route.ts": "",
      "src/lib/abc-deep/nested.ts": "",
    });
    const { report } = check(root);
    expect(report.findings.map((f: { key: string }) => f.key)).toContain("unplaced:src/lib/abc-deep/nested.ts");
    expect(report.systems.find((s: { id: string }) => s.id === "app").files).toBe(2);
  });

  it("rejects an over-broad rule inside a mixed folder", () => {
    const root = repo({ ...mapFiles({ lib: ["src/lib/**"], knowledge: [MAP_RULE] }), "src/lib/a.ts": "" });
    const { code, blocking } = check(root);
    expect(code).toBe(1);
    expect(blocking[0].message).toMatch(/too broad/);
  });

  it("fails on a superseded not-yet-placed entry and on unsorted rules", () => {
    const nyp = [{ path: "a.md", reason: "Could be knowledge or delivery." }];
    const files = mapFiles({ knowledge: [] }, { nyp });
    files["docs/organisation/systems/knowledge.json"] = area("knowledge", [MAP_RULE, "b.md", "a.md"], { sort: false });
    const root = repo({ ...files, "a.md": "", "b.md": "" });
    const keys = check(root).blocking.map((f: { key: string }) => f.key);
    expect(keys).toContain("nyp-superseded:a.md");
    expect(keys).toContain("map-sort:docs/organisation/systems/knowledge.json");
  });

  it("rejects reasons that contain links", () => {
    const nyp = [{ path: "a.md", reason: "See https://example.invalid for context" }];
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE] }, { nyp }), "a.md": "" });
    expect(check(root).code).toBe(1);
  });

  it("exits 2 when it cannot check: not a repo, no map, or a newer map version", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-bare-"));
    roots.push(bare);
    expect(check(bare).code).toBe(2);
    expect(check(repo({ "a.md": "" })).code).toBe(2);
    const newer = mapFiles({ knowledge: [MAP_RULE] });
    newer["docs/organisation/pins.json"] = JSON.stringify({ version: 99, pins: {} });
    expect(check(repo(newer)).code).toBe(2);
  });

  it("--staged reads the map from the index, not the working tree", () => {
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE, "a.md"] }), "a.md": "" });
    write(root, { "docs/organisation/systems/knowledge.json": area("knowledge", [MAP_RULE, "a.md", "missing.md"]) });
    git(root, "add", "docs/organisation/systems/knowledge.json");
    write(root, { "docs/organisation/systems/knowledge.json": area("knowledge", [MAP_RULE, "a.md"]) });
    expect(check(root).code).toBe(0);
    expect(check(root, ["--staged"]).code).toBe(1);
  });

  it("in CI blocks only what the change introduced, never inherited debt", () => {
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE, "a.md", "b.md", "gone.md"] }), "a.md": "", "b.md": "" });
    const base = git(root, "rev-parse", "HEAD");
    const ci = (head: string) => check(root, [], { ORGANISATION_CHECK_MODE: "ci", BASE_SHA: base, HEAD_SHA: head });

    const unrelated = commit(root, { "new.txt": "" });
    const inherited = ci(unrelated);
    expect(inherited.code).toBe(0);
    expect(inherited.report.findings).toContainEqual(
      expect.objectContaining({ key: "dead-rule:knowledge:gone.md", blocking: false }),
    );

    const deleting = commit(root, {}, ["b.md"]);
    const introduced = ci(deleting);
    expect(introduced.code).toBe(1);
    expect(introduced.blocking.map((f: { key: string }) => f.key)).toEqual(["dead-rule:knowledge:b.md"]);
  });

  it("writes a paired report selected by a pointer file", () => {
    const root = repo({ ...mapFiles({ knowledge: [MAP_RULE] }) });
    const result = spawnSync(process.execPath, [CHECKER, "--root", root, "--quiet"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const dir = path.join(root, "output/organisation");
    const pointer = JSON.parse(fs.readFileSync(path.join(dir, "latest.json"), "utf8"));
    expect(fs.existsSync(path.join(dir, pointer.json))).toBe(true);
    expect(fs.readFileSync(path.join(dir, pointer.md), "utf8")).toMatch(/Organisation check: exit 0/);
    expect(fs.existsSync(path.join(dir, ".lock"))).toBe(false);
  });
});
