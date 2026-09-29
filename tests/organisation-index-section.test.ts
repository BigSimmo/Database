import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import prettier from "prettier";
import { afterEach, describe, expect, it } from "vitest";

import { coverageGaps, schemaTableGaps } from "../scripts/check-codebase-index-coverage.mjs";
import {
  INDEX_PATH,
  SECTION_END,
  SECTION_START,
  indexSectionDrift,
  readAreas,
  renderAreasSection,
  replaceSection,
  writeSection,
} from "../scripts/organisation/codebase-index-section.mjs";

const REPO = path.resolve(__dirname, "..");
const GENERATOR = path.join(REPO, "scripts/organisation/codebase-index-section.mjs");
const HOOK = path.join(REPO, ".githooks/pre-commit");
const roots: string[] = [];

type Area = { id: string; name: string; kind?: string; owns: string; canonicalDocs?: string[]; paths?: string[] };

function areaJson({ id, name, kind = "area", owns, canonicalDocs = [], paths = [] }: Area) {
  return `${JSON.stringify({ version: 1, id, kind, name, owns, canonicalDocs, paths }, null, 2)}\n`;
}

const AREAS: Area[] = [
  { id: "delivery", name: "Delivery and assurance", owns: "Getting a change to live.", canonicalDocs: ["docs/t.md"] },
  { id: "answer-engine", name: "Answer engine", owns: "Turning a question into a cited answer.", paths: ["src/x/**"] },
  { id: "design-system", name: "Design system", kind: "workstream", owns: "Tokens and primitives." },
];

const INDEX = [
  "# Index",
  "",
  "Intro.",
  "",
  SECTION_START,
  "stale",
  SECTION_END,
  "",
  "## Top-level layout",
  "",
  "Rest.",
  "",
].join("\n");

function tempRoot(areas: Area[] = AREAS, index = INDEX) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-index-section-"));
  roots.push(root);
  for (const area of areas) {
    fs.mkdirSync(path.join(root, "docs/organisation/systems"), { recursive: true });
    fs.writeFileSync(path.join(root, `docs/organisation/systems/${area.id}.json`), areaJson(area));
  }
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, INDEX_PATH), index);
  return root;
}

function readIndex(root: string) {
  return fs.readFileSync(path.join(root, INDEX_PATH), "utf8");
}

function between(text: string) {
  return text.slice(text.indexOf(SECTION_START), text.indexOf(SECTION_END) + SECTION_END.length);
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("Areas section content", () => {
  it("lists each area's name, id, job and canonical docs, areas first and workstreams after", () => {
    const lines = renderAreasSection(readAreas(tempRoot()));
    expect(lines[0]).toBe(SECTION_START);
    expect(lines.at(-1)).toBe(SECTION_END);
    const text = lines.join("\n");
    expect(text).toContain("## Areas (organisation map)");
    const answer = text.indexOf("- **Answer engine** (`answer-engine`): Turning a question into a cited answer.");
    const delivery = text.indexOf("- **Delivery and assurance** (`delivery`): Getting a change to live.");
    const workstream = text.indexOf("- **Design system** (`design-system`): Tokens and primitives.");
    expect(answer).toBeGreaterThan(0);
    expect(delivery).toBeGreaterThan(answer);
    expect(text.indexOf("Workstreams cut across the areas:")).toBeGreaterThan(delivery);
    expect(workstream).toBeGreaterThan(delivery);
    expect(text).toContain("  Canonical docs: docs/t.md");
    expect(text).toContain("  Canonical docs: none listed");
  });

  it("carries no file lists or counts, so path rules and file moves never change it", () => {
    const before = renderAreasSection(readAreas(tempRoot()));
    const moved = AREAS.map((area) => ({ ...area, paths: ["somewhere/else/**", "and/another.ts"] }));
    expect(renderAreasSection(readAreas(tempRoot(moved)))).toEqual(before);
    expect(before.join("\n")).not.toContain("src/x");
  });

  it("names canonical docs as plain text, so a moved doc never fails the docs link check", () => {
    const text = renderAreasSection(readAreas(tempRoot())).join("\n");
    expect(text).not.toContain("`docs/t.md`");
  });

  it("turns markdown links into their text and drops backticks, so it never carries a checkable link or path", () => {
    const root = tempRoot([
      {
        id: "linky",
        name: "Linky `area`",
        owns: "Owns [the guide](docs/guide.md), `src/lib/x.ts` and ![a picture](img.png).",
        canonicalDocs: ["`docs/a.md`", "[docs/b.md](docs/b.md)"],
      },
    ]);
    const text = renderAreasSection(readAreas(root)).join("\n");
    expect(text).toContain("- **Linky area** (`linky`): Owns the guide, src/lib/x.ts and a picture.");
    expect(text).toContain("  Canonical docs: docs/a.md, docs/b.md");
    expect(text).not.toMatch(/\]\(/);
  });

  it("is already in Prettier's markdown layout, for the real map and for awkward characters", async () => {
    const options = { ...(await prettier.resolveConfig(path.join(REPO, INDEX_PATH))), parser: "markdown" };
    const real = `${renderAreasSection(readAreas(REPO)).join("\n")}\n`;
    expect(await prettier.format(real, options)).toBe(real);
    const awkward = tempRoot([
      {
        id: "odd",
        name: "Odd area",
        owns: "Owns snake_case_names, 2 * 3 and [brackets].",
        canonicalDocs: ["docs/a_b.md"],
      },
    ]);
    const text = `${renderAreasSection(readAreas(awkward)).join("\n")}\n`;
    expect(await prettier.format(text, options)).toBe(text);
  });
});

describe("Areas section regeneration", () => {
  it("rewrites only the marked block and is idempotent", () => {
    const root = tempRoot();
    expect(writeSection(root)).toBe(true);
    const once = readIndex(root);
    expect(writeSection(root)).toBe(false);
    expect(readIndex(root)).toBe(once);
    expect(once.slice(0, once.indexOf(SECTION_START))).toBe(INDEX.slice(0, INDEX.indexOf(SECTION_START)));
    expect(once.slice(once.indexOf(SECTION_END))).toBe(INDEX.slice(INDEX.indexOf(SECTION_END)));
    expect(between(once)).toBe(renderAreasSection(readAreas(root)).join("\n"));
  });

  it("keeps Windows line endings when the index uses them", () => {
    const root = tempRoot(AREAS, INDEX.replaceAll("\n", "\r\n"));
    writeSection(root);
    const text = readIndex(root);
    expect(text.split("\r\n").length).toBe(text.split("\n").length);
    expect(writeSection(root)).toBe(false);
  });

  it("refuses without writing when the markers are missing, repeated or reversed", () => {
    const cases = [
      INDEX.replace(`${SECTION_START}\n`, ""),
      INDEX.replace(SECTION_END, `${SECTION_END}\n${SECTION_END}`),
      INDEX.replace(SECTION_START, "TMP").replace(SECTION_END, SECTION_START).replace("TMP", SECTION_END),
    ];
    for (const index of cases) {
      const root = tempRoot(AREAS, index);
      const result = spawnSync(process.execPath, [GENERATOR, "--write", "--root", root], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("exactly once each");
      expect(readIndex(root)).toBe(index);
    }
    expect(() => replaceSection("no markers here", ["x"])).toThrow(/exactly once each/);
  });

  it("refuses without writing when an area file cannot be read", () => {
    const root = tempRoot();
    fs.writeFileSync(path.join(root, "docs/organisation/systems/broken.json"), "{ not json");
    const result = spawnSync(process.execPath, [GENERATOR, "--write", "--root", root], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("broken.json is not valid JSON");
    expect(readIndex(root)).toBe(INDEX);
  });
});

describe("Areas section drift warning", () => {
  it("is null when current and a message, never an exception, otherwise", () => {
    const root = tempRoot();
    expect(indexSectionDrift({ root })).toContain("out of date");
    writeSection(root);
    expect(indexSectionDrift({ root })).toBeNull();

    fs.writeFileSync(
      path.join(root, "docs/organisation/systems/delivery.json"),
      areaJson({ ...AREAS[0], owns: "A new job description." }),
    );
    expect(indexSectionDrift({ root })).toContain("codebase-index-section.mjs --write");

    fs.writeFileSync(path.join(root, INDEX_PATH), "no markers");
    expect(indexSectionDrift({ root })).toContain("could not be checked");
  });
});

describe("Areas section placement in the real index", () => {
  it("sits outside every range the index coverage check reads, so it cannot satisfy that check", () => {
    const real = fs.readFileSync(path.join(REPO, INDEX_PATH), "utf8");
    expect(real.split(SECTION_START)).toHaveLength(2);
    expect(real.split(SECTION_END)).toHaveLength(2);
    // Put a mention of every kind of coverage target inside the block. Were the block inside any
    // bounded range, one of these made-up groups would count as covered.
    const poison = [
      SECTION_START,
      "`zz-probe-root/` `src/lib/zz-probe-lib/` `/zz-probe-route` `/api/zz-probe-api` `zz_probe_table`",
      SECTION_END,
    ];
    const probed = replaceSection(real, poison);
    const groups = [
      { kind: "root", dir: ".", name: "zz-probe-root" },
      { kind: "lib", dir: "src/lib", name: "zz-probe-lib" },
      { kind: "route", dir: "src/app", name: "zz-probe-route" },
      { kind: "api", dir: "src/app/api", name: "zz-probe-api" },
    ];
    expect(coverageGaps(probed, groups).map((gap: { full: string }) => gap.full)).toEqual(
      groups.map((group) => `${group.dir}/${group.name}`),
    );
    expect(schemaTableGaps(probed, "").stale).not.toContain("zz_probe_table");
  });
});

// The hook runs through POSIX sh, which Windows runners do not provide.
describe.skipIf(process.platform === "win32")("pre-commit docs sync", () => {
  function hookRepo({ withGenerator = true } = {}) {
    const root = tempRoot();
    const run = (...args: string[]) =>
      spawnSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "-C", root, ...args], {
        encoding: "utf8",
      });
    run("init", "-q", "-b", "main");
    if (withGenerator) {
      fs.mkdirSync(path.join(root, "scripts/organisation"), { recursive: true });
      fs.copyFileSync(GENERATOR, path.join(root, "scripts/organisation/codebase-index-section.mjs"));
    }
    // A staged index also triggers the module-map check, which runs through npm.
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "probe", private: true, scripts: { "docs:check-index": "node -e 0" } }),
    );
    run("add", "-A");
    run("commit", "-q", "-m", "base");
    const hook = () =>
      spawnSync("sh", [HOOK], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          SKIP_DOCS_SYNC_HOOK: "",
          PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      });
    return { root, run, hook };
  }

  function editArea(root: string, owns: string) {
    fs.writeFileSync(path.join(root, "docs/organisation/systems/delivery.json"), areaJson({ ...AREAS[0], owns }));
  }

  it("regenerates the section when an area file is staged, then stops the commit for review", () => {
    const { root, run, hook } = hookRepo();
    editArea(root, "A brand new job.");
    run("add", "docs/organisation/systems/delivery.json");

    const first = hook();
    expect(first.status).toBe(1);
    expect(first.stderr).toContain("Documentation changed or remains unstaged");
    expect(first.stderr).toContain(INDEX_PATH);
    expect(readIndex(root)).toContain("A brand new job.");

    run("add", INDEX_PATH);
    const second = hook();
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("Documentation is synchronized.");
  });

  it("refuses when another area file has unstaged edits the generator would read", () => {
    const { root, run, hook } = hookRepo();
    editArea(root, "Staged job.");
    run("add", "docs/organisation/systems/delivery.json");
    fs.writeFileSync(
      path.join(root, "docs/organisation/systems/answer-engine.json"),
      areaJson({ ...AREAS[1], owns: "Unstaged job." }),
    );
    const result = hook();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Documentation inputs have unstaged or untracked changes");
    expect(readIndex(root)).toBe(INDEX);
  });

  it("ignores unstaged files under the area folder that the generator never reads", () => {
    const { root, run, hook } = hookRepo();
    editArea(root, "A brand new job.");
    run("add", "docs/organisation/systems/delivery.json");
    fs.writeFileSync(path.join(root, "docs/organisation/systems/notes.md"), "Scratch notes.\n");
    fs.mkdirSync(path.join(root, "docs/organisation/systems/drafts"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/organisation/systems/drafts/next.json"), "{}\n");
    const result = hook();
    expect(result.stderr).not.toContain("Documentation inputs have unstaged or untracked changes");
    expect(result.stderr).toContain("Documentation changed or remains unstaged");
    expect(readIndex(root)).toContain("A brand new job.");
  });

  it("skips the sync on a branch that does not carry the generator yet", () => {
    const { root, run, hook } = hookRepo({ withGenerator: false });
    editArea(root, "A brand new job.");
    run("add", "docs/organisation/systems/delivery.json");
    const result = hook();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("absent from this worktree - skipping the Areas section sync");
    expect(readIndex(root)).toBe(INDEX);
  });
});
