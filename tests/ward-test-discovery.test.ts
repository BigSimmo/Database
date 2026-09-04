import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The problem this closes: every "full ward suite" figure has been derived from the FILENAME
 * PREFIX `tests/ward-*`, which is a naming convention nobody enforces, not a discovery rule.
 * `tests/pressure-strip.dom.test.tsx` and `tests/tracker-derivations.test.ts` both statically
 * import from `src/components/ward-management/` and are named after the component/module under
 * test -- the more natural convention -- which makes them invisible to any count or floor built
 * on the `ward-*` prefix.
 *
 * Scope: this walks `tests/**\/*.test.ts` and `tests/**\/*.dom.test.tsx`, i.e. exactly the two
 * populations vitest.config.mts collects for the node and jsdom projects (the "113 node + 80
 * jsdom = 193" full ward suite figure this guard exists to keep honest). `tests/ui-*.spec.ts`
 * Playwright journeys are a separate runner and population and are deliberately out of scope.
 *
 * The distinction that makes this correct, and it was measured: IMPORTS, not MENTIONS.
 * `tests/dependency-drift-check.test.ts` and `tests/viewport-fill-contract.test.ts` both name
 * `src/components/ward-management` as a string (a path fixture / contract assertion) with zero
 * imports -- they are not ward guards and must not be flagged.
 */

const TESTS_ROOT = path.join(process.cwd(), "tests");
const TEST_FILE_RE = /\.test\.(ts|tsx)$/;
const WARD_STAR_RE = /^ward-/;

// Two tests exercise Ward Flow code and do not match `ward-*`. This list is an ACKNOWLEDGEMENT,
// not a permission: every entry needs a one-line reason, and a silently-growing list defeats the
// guard. A new offender should be renamed to `ward-*` where that is the more honest name, or
// added here with a reason -- never appended without one.
const EXCEPTIONS: Record<string, string> = {
  "pressure-strip.dom.test.tsx":
    "named for PressureStrip, the coordinator component under test, not the ward-management area",
  "tracker-derivations.test.ts":
    "named for tracker-derivations.ts, the module under test, not the ward-management area",
};

function walkTestFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__screenshots__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkTestFiles(full));
    } else if (TEST_FILE_RE.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Strips `//` and `/* *\/` comments while PRESERVING NEWLINES (so a commented-out import cannot
 * be mistaken for a live one, and line numbers stay true), and leaves the contents of every
 * string/template literal untouched so a comment marker that happens to sit inside a string is
 * never treated as the start of a real comment.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const twoChar = source.slice(i, i + 2);
    if (twoChar === "//") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (twoChar === "/*") {
      i += 2;
      while (i < n && source.slice(i, i + 2) !== "*/") {
        if (source[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i++;
      while (i < n && source[i] !== ch) {
        if (source[i] === "\\") {
          out += source[i] + (source[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += source[i] === "\n" ? "\n" : source[i];
        i++;
      }
      if (i < n) {
        out += source[i];
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// Matches a static `import ... from "<specifier>"` (default/named/type/namespace) whose
// specifier contains "ward-management" -- both the "@/components/ward-management/..." alias
// form and the "../src/components/ward-management/..." relative form this repo's ward tests use
// (both are confirmed present, e.g. tests/ward-eligibility.test.ts uses the relative form). A
// genuine regex literal, not a template literal or `new RegExp(string)`, so `\s` and friends
// keep their escapes rather than silently matching nothing. Bounded by the statement's own
// closing `;` so it cannot bleed across unrelated import statements.
const WARD_IMPORT_PATTERN = /import\s+[^;]*?from\s+["']([^"']*ward-management[^"']*)["']\s*;/g;

function importsWardManagement(filePath: string): boolean {
  const stripped = stripComments(fs.readFileSync(filePath, "utf8"));
  WARD_IMPORT_PATTERN.lastIndex = 0;
  return WARD_IMPORT_PATTERN.test(stripped);
}

const allTestFiles = walkTestFiles(TESTS_ROOT);
const importerRelPaths = allTestFiles
  .filter((file) => importsWardManagement(file))
  .map((file) => path.relative(TESTS_ROOT, file).replace(/\\/g, "/"));

describe("ward test discovery vs. the tests/ward-* naming convention", () => {
  it("walks a healthy population of test files (anti-vacuity floor)", () => {
    // A broken walk (wrong root, wrong extension filter) must fail loudly here, naming the
    // count it actually found, rather than passing silently over an empty or tiny tree.
    expect(allTestFiles.length).toBeGreaterThan(500);
  });

  it("finds a healthy population of ward-management importers (anti-vacuity floor)", () => {
    // A broken import matcher (e.g. one that matches nothing) must fail loudly here, naming the
    // count it actually found, rather than reporting the tree as clean.
    expect(importerRelPaths.length).toBeGreaterThan(150);
  });

  it("detects the two known importers named for their component, not the ward-management area", () => {
    // A known-good control, not only known-bad ones: without this, a matcher that detects
    // nothing would report the tree as clean.
    expect(importerRelPaths).toEqual(
      expect.arrayContaining(["pressure-strip.dom.test.tsx", "tracker-derivations.test.ts"]),
    );
  });

  it("does not flag files that only mention ward-management as a string, not an import", () => {
    // A false positive here is as believable as a false negative: a matcher that counts string
    // mentions as well as imports would flag these two contract/path-fixture tests, which import
    // nothing from ward-management.
    expect(importerRelPaths).not.toContain("dependency-drift-check.test.ts");
    expect(importerRelPaths).not.toContain("viewport-fill-contract.test.ts");
  });

  it("every ward-management importer matches tests/ward-*, or is a named exception", () => {
    const offenders = importerRelPaths.filter((rel) => {
      const base = path.basename(rel);
      return !WARD_STAR_RE.test(base) && !(base in EXCEPTIONS);
    });

    if (offenders.length > 0) {
      throw new Error(
        `${offenders.join(", ")} statically ${offenders.length === 1 ? "imports" : "import"} ` +
          `from src/components/ward-management/ but ${offenders.length === 1 ? "is" : "are"} not ` +
          `named tests/ward-* and not listed in the EXCEPTIONS map at the top of ` +
          `tests/ward-test-discovery.test.ts. Either rename the file to start with "ward-", or add ` +
          `it to EXCEPTIONS with a one-line reason -- a silently-growing exception list defeats ` +
          `this guard.`,
      );
    }

    expect(offenders).toHaveLength(0);
  });

  it("every named exception is still a real, current importer", () => {
    const stale = Object.keys(EXCEPTIONS).filter((base) => !importerRelPaths.includes(base));

    if (stale.length > 0) {
      throw new Error(
        `${stale.join(", ")} ${stale.length === 1 ? "is" : "are"} listed in the EXCEPTIONS map ` +
          `in tests/ward-test-discovery.test.ts but no longer import from ` +
          `src/components/ward-management/ -- remove the stale entry.`,
      );
    }

    expect(stale).toHaveLength(0);
  });
});
