// tests/ward-composes-targets.test.ts
//
// The defect this catches, found for real the night of 2026-09-04: an adopter wrote
//
//     .screen { composes: wardTokens from "./ward-tokens.module.css"; }
//
// inside a file living in `src/components/ward-management/statistics/`. `"./"` resolves to
// `statistics/ward-tokens.module.css`, which does not exist — the real file is one level up.
//
// ⚠️ WHY NOTHING ELSE CAUGHT IT: vitest does not resolve CSS-module `composes` targets. So the
// stylesheet cannot build, the token layer silently does not apply, every `--ward-*` custom
// property that file uses becomes undeclared — invisible borders, or full-strength text colour
// where a fallback exists — AND EVERY CONTRACT TEST AND DOM TEST STILL PASSES, because none of
// them ever ask the bundler to actually build the CSS. The failure only surfaces at build time or
// in a browser, downstream of every gate an adopter is told to run. 8 of the 11 stylesheets being
// adopted as of tonight live in subfolders, so a wrong `./` versus `../` is a live, group-wide
// hazard, not a one-off.
//
// This file is a static resolver, not a bundler: it never builds CSS or loads a browser. It only
// proves that every `composes: <name> from "<path>";` target (a) resolves to a real file relative
// to the DECLARING file, and (b) that file actually defines the composed class. A path that
// resolves while naming a class the target does not define is the same silent failure one step
// further along — the composition simply does nothing.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/components/ward-management";

/**
 * ⚠️ STRIP COMMENTS BUT PRESERVE NEWLINES. Replacing a matched comment with the empty string (as
 * a simpler stripper would) shifts every line number after a multi-line comment, which breaks the
 * `<file>:<line>` failure report this test exists to produce. Replacing every non-newline
 * character inside the comment with a space keeps the string the same length and the same line
 * count, so an index computed against the stripped text still maps to the true line in the file.
 */
function stripCommentsKeepLines(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "));
}

function lineNumberAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10 /* \n */) line += 1;
  }
  return line;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// ⚠️ DISCOVERED FROM DISK, NEVER HAND-LISTED. A hand-picked file set has shipped a red test twice
// on this project already: it silently stops covering whatever file somebody adds tomorrow, and
// the suite keeps passing with one fewer file inside it.
const STYLESHEETS = walk(ROOT).filter((f) => f.endsWith(".module.css"));

/**
 * A `composes:` declaration that names a quoted path, e.g.
 *   composes: wardTokens from "./ward-tokens.module.css";
 * Multiple composed class names are space-separated (`composes: a b from "...";`), so group 1 is
 * captured as everything up to `from` and split on whitespace by the caller.
 *
 * ⚠️ REGEX DISCIPLINE: this is a plain regex literal, not a template literal or `new RegExp(str)`
 * built from an escaped string. Either of those loses backslash escapes silently and comes back
 * matching nothing — a clean, believable, WRONG zero. `String.raw` would work too; a literal is
 * simplest here because the pattern needs no interpolation.
 */
const COMPOSES_WITH_PATH = /composes\s*:\s*([A-Za-z0-9_\-\s]+?)\s+from\s+"([^"]+)"\s*;/gu;

/**
 * `composes: <name> from global;` is valid CSS-modules syntax (the composed class is expected to
 * exist as a plain, non-module global class, not another CSS-modules file) and carries no path to
 * resolve, so it is explicitly excluded from `COMPOSES_WITH_PATH` above and never counted by this
 * test. As of 2026-09-04 no file in this repository uses it (confirmed by a whole-tree search);
 * if one is ever added, it is deliberately outside this guard's job, which is path resolution.
 * A bare `composes: chip;` (no `from` clause at all, composing a class from the SAME file) is
 * likewise outside scope: there is no path to get wrong.
 */

interface ComposesDeclaration {
  file: string;
  line: number;
  names: string[];
  rawPath: string;
}

function findComposesDeclarations(file: string, strippedCss: string): ComposesDeclaration[] {
  const found: ComposesDeclaration[] = [];
  for (const match of strippedCss.matchAll(COMPOSES_WITH_PATH)) {
    const [, namesGroup, rawPath] = match;
    found.push({
      file,
      line: lineNumberAt(strippedCss, match.index ?? 0),
      names: namesGroup.trim().split(/\s+/u).filter(Boolean),
      rawPath,
    });
  }
  return found;
}

/** Whether `className` is defined as a selector somewhere in `strippedCss`. */
function definesClass(strippedCss: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // A class selector token: preceded by start-of-string/whitespace/`,`/`{`/`}`, the literal
  // `.className`, then NOT immediately followed by another identifier character (so `wardTokens`
  // does not match inside `wardTokensExtra`).
  const pattern = new RegExp(String.raw`(^|[\s,{}])\.${escaped}(?![\w-])`, "u");
  return pattern.test(strippedCss);
}

const ALL_DECLARATIONS: ComposesDeclaration[] = STYLESHEETS.flatMap((file) =>
  findComposesDeclarations(file, stripCommentsKeepLines(readFileSync(file, "utf8"))),
);

describe("ward-management composes: targets resolve to real files and real classes", () => {
  /**
   * ⚠️ ANTI-VACUITY. This whole test passes trivially if the matcher finds nothing — a broken
   * regex (see the "regex discipline" note above) returns a clean, empty, WRONG result. Both
   * floors below name the number they actually found, so a broken matcher fails LOUDLY, saying
   * "found 3", rather than passing silently at zero.
   */
  it("is actually scanning the Ward Flow stylesheet tree", () => {
    expect(
      STYLESHEETS.length,
      `expected to discover more than 30 ward-management stylesheets, found ${STYLESHEETS.length}`,
    ).toBeGreaterThan(30);
  });

  it("is actually finding composes declarations to check", () => {
    expect(
      ALL_DECLARATIONS.length,
      `expected more than 10 composes-with-path declarations, found ${ALL_DECLARATIONS.length}: ` +
        ALL_DECLARATIONS.map((d) => `${d.file}:${d.line}`).join(", "),
    ).toBeGreaterThan(10);
  });

  /**
   * Sanity floor named in the brief: known-good instances that must always be found so a matcher
   * that silently stops working shows up as a missing member, not just a smaller number.
   * `ward-panel.module.css`, `ward-chip.module.css` and `ward-figure.module.css` each carry
   * exactly one `composes: wardTokens from "./ward-tokens.module.css"`, and the community/ed
   * adopters use `"../ward-tokens.module.css"`.
   */
  it("finds the known-good composes declarations this guard is built on", () => {
    const byFile = (name: string) => ALL_DECLARATIONS.filter((d) => d.file.endsWith(name));
    for (const name of [join("ward-panel.module.css"), join("ward-chip.module.css"), join("ward-figure.module.css")]) {
      expect(byFile(name).length, `expected exactly one composes declaration in ${name}`).toBe(1);
    }
    for (const name of [
      join("community", "community-home.module.css"),
      join("community", "community-team-hub.module.css"),
      join("community", "community-teams-table.module.css"),
      join("ed", "ed-home.module.css"),
      join("ed", "ed-service-bands.module.css"),
    ]) {
      expect(
        byFile(name).some((d) => d.rawPath === "../ward-tokens.module.css"),
        `expected ${name} to compose wardTokens from "../ward-tokens.module.css"`,
      ).toBe(true);
    }
  });

  /**
   * ⚠️ A KNOWN-GOOD CONTROL, NOT ONLY KNOWN-BAD ONES. The three mutations below all prove the
   * test CAN go red. None of them prove it can correctly STAY green on a valid path — and a
   * `composes` failure is silent, so a matcher that reports every file as broken (a false
   * positive) is just as believable and just as silent as one that reports nothing (a false
   * negative). Measured live during this task: a relayed claim asserted `officer.module.css`
   * composes `wardTokens from "../ward-tokens.module.css"` and that `out-of-area.module.css`
   * composes `wardTokens from "../ward-tokens.module.css"` too — neither is true. `officer`
   * composes `descendantKill` from `../ward-reduced-motion.module.css` instead, and
   * `out-of-area.module.css` carries no `composes` declaration of any kind (confirmed by
   * `grep -c composes` returning 0). Both claims were re-verified against the file contents
   * directly before being encoded here, rather than trusted from the relay — the two below are
   * the ones that actually check out.
   */
  it("confirms specific known-good composes targets actually resolve and their classes exist", () => {
    const cases: Array<{ file: string; rawPath: string; className: string }> = [
      {
        file: join(ROOT, "officer", "officer.module.css"),
        rawPath: "../ward-reduced-motion.module.css",
        className: "descendantKill",
      },
      {
        file: join(ROOT, "community", "community-home.module.css"),
        rawPath: "../ward-tokens.module.css",
        className: "wardTokens",
      },
      {
        file: join(ROOT, "ward-panel.module.css"),
        rawPath: "./ward-tokens.module.css",
        className: "wardTokens",
      },
    ];

    for (const { file, rawPath, className } of cases) {
      const resolvedPath = resolve(dirname(file), rawPath);
      expect(
        statSync(resolvedPath).isFile(),
        `${file} -> "${rawPath}" should resolve to a real file at ${resolvedPath}`,
      ).toBe(true);
      const targetCss = stripCommentsKeepLines(readFileSync(resolvedPath, "utf8"));
      expect(definesClass(targetCss, className), `${resolvedPath} should define .${className}`).toBe(true);
    }

    // The two specific declaration LINES named in the control, checked directly against the raw
    // file rather than through this test's own line-counting helper, so a bug in that helper
    // cannot also hide a bug here.
    const tokensLines = readFileSync(join(ROOT, "ward-tokens.module.css"), "utf8").split("\n");
    expect(
      tokensLines[13]?.trim().startsWith(".wardTokens"),
      "ward-tokens.module.css:14 should declare .wardTokens",
    ).toBe(true);
    const reducedMotionLines = readFileSync(join(ROOT, "ward-reduced-motion.module.css"), "utf8").split("\n");
    expect(
      reducedMotionLines[12]?.trim().startsWith(".descendantKill"),
      "ward-reduced-motion.module.css:13 should declare .descendantKill",
    ).toBe(true);
  });

  /**
   * The core guard. For every discovered declaration: resolve `rawPath` relative to the
   * DECLARING file's own directory (never relative to ROOT — that is exactly the bug this test
   * exists to catch, since `"./"` and `"../"` mean different things in a subfolder), assert the
   * target file exists, and assert every composed class name is actually defined there. Failures
   * are collected rather than thrown on the first one, so a single run reports every offender.
   */
  it("resolves every composes: target file and every composed class name", () => {
    const missingFiles: string[] = [];
    const missingClasses: string[] = [];

    for (const decl of ALL_DECLARATIONS) {
      const resolvedPath = resolve(dirname(decl.file), decl.rawPath);
      let targetExists = false;
      try {
        targetExists = statSync(resolvedPath).isFile();
      } catch {
        targetExists = false;
      }

      if (!targetExists) {
        missingFiles.push(`${decl.file}:${decl.line} -> ${decl.rawPath}`);
        continue;
      }

      const targetCss = stripCommentsKeepLines(readFileSync(resolvedPath, "utf8"));
      for (const className of decl.names) {
        if (!definesClass(targetCss, className)) {
          missingClasses.push(`${decl.file}:${decl.line} -> ${decl.rawPath} does not define .${className}`);
        }
      }
    }

    expect(missingFiles, `unresolved composes: target file(s):\n${missingFiles.join("\n")}`).toEqual([]);
    expect(
      missingClasses,
      `composes: target resolves but does not define the class:\n${missingClasses.join("\n")}`,
    ).toEqual([]);
  });
});
