import { readFileSync, readdirSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * ⚠️ **A CLOCK BUG THE COMMUNITY ROUTE SURVIVES BY CONSTRUCTION, NOT BY LUCK.**
 *
 * `ward-flow-provider.tsx` seeds its session date with `demoDayZero(new Date())` — the real,
 * unpinned system clock — while neighbouring lines in the same file honour a pinned time.
 * Anything downstream that turns that session date into a printed CALENDAR DATE drifts with the
 * real calendar even inside a test that thought it had pinned time.
 *
 * The community route (`src/components/ward-management/community/`) is immune: it renders
 * DURATIONS — "3 days", "day 4 of this demonstration" — and never a calendar date. Verified here:
 * `ward-clock.ts` exports exactly two calendar-date-producing functions, `calendarDateOf` and
 * `formatSheetMoment`, and `handover-page.tsx` genuinely calls `formatSheetMoment` to print one
 * (this file's positive control). No file under `community/` references either function, or any
 * of the raw `Date` APIs that could print one directly.
 *
 * That immunity currently rests on nobody adding such a call — a habit, not a rule. This file
 * turns it into a catcher.
 *
 * ⚠️ **READ WITH THE TYPESCRIPT PARSER, NEVER STRING-MATCHED.** `ts.createSourceFile` yields no
 * identifier nodes for text inside comments, so a rule built on the AST cannot be satisfied — or
 * defeated — by prose. Three date-adjacent guards in this repository were beaten by exactly that
 * substitution in one day; this file follows the shape of
 * `tests/ward-community-team-single-source.test.ts`, which took the same precaution.
 *
 * ⚠️ **THIS FILE CANNOT BE SELECTED BY `npm run test:focused`.** It reads source with
 * `readFileSync`/`readdirSync` rather than importing it, so vitest's import-graph selection
 * cannot see the relationship to the files it inspects. It runs in the full suite only.
 */

const COMMUNITY_DIR = "src/components/ward-management/community";

/** Calendar-date-producing identifiers: the two named exports from `ward-clock.ts`, plus the
 *  standard library members and constructor that could print a calendar date directly without
 *  going through either of them. */
const BANNED_IDENTIFIERS = [
  "formatSheetMoment",
  "calendarDateOf",
  "toLocaleDateString",
  "toLocaleString",
  "toDateString",
  "toISOString",
];

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/**
 * Counts executable references to a calendar-date-producing construct in one module: any
 * identifier (declaration, import, or use — including a property-access member name such as
 * `.toLocaleDateString`) whose text is in `BANNED_IDENTIFIERS`, plus every `new Date(...)`
 * expression. A bare `Date` used only as a type annotation (e.g. a `dayZero: Date` parameter) is
 * deliberately not counted — the rule is about producing a calendar-date value, not naming the
 * type — so `new Date(...)` is matched structurally via `NewExpression`, never via the identifier
 * "Date" on its own.
 *
 * Built entirely on `ts.forEachChild` traversal of the parsed AST: text inside a comment never
 * becomes a node, so this function is immune in both directions to what the source *says* about
 * itself.
 */
function dateConstructCount(source: string, fileName: string): number {
  const file = parse(fileName, source);
  let count = 0;

  const walk = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.includes(node.text)) count += 1;
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date") {
      count += 1;
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  return count;
}

/** The community route's `.ts`/`.tsx` files, discovered from disk rather than hardcoded — a
 *  hardcoded list silently stops guarding the day a new file lands under this directory. */
function communitySourceFiles(): string[] {
  return readdirSync(COMMUNITY_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => `${COMMUNITY_DIR}/${entry.name}`)
    .sort();
}

describe("the community route prints durations, never calendar dates", () => {
  it("has a non-empty, disk-derived population of community files to guard", () => {
    // Anti-vacuity on the POPULATION: a guard that walks zero files passes forever regardless of
    // what those files contain. Re-derived independently (plain readdirSync, no dirent filter)
    // so the floor cannot pass merely because both counts came from the same filter bug.
    const walked = communitySourceFiles();
    const onDisk = readdirSync(COMMUNITY_DIR).filter((name) => /\.tsx?$/.test(name));

    expect(walked.length).toBeGreaterThan(0);
    expect(walked.length).toBe(onDisk.length);
    /*
     * ⚠️ **THE TWO COUNTS ABOVE COME FROM THE SAME CALL AND THE SAME PATTERN, so a wrong directory
     * or a broken pattern would satisfy BOTH.** They agree on nothing they did not already share.
     * This is the floor that cannot: a named file this route cannot exist without. If it is ever
     * renamed, this goes red and somebody re-points the guard deliberately — which is the outcome
     * to want, and is not what a self-comparing count would give.
     */
    expect(walked).toContain(`${COMMUNITY_DIR}/community-screen.tsx`);
  });

  it.each(communitySourceFiles())("executes no calendar-date construct in %s", (path) => {
    expect(dateConstructCount(readFileSync(path, "utf8"), path)).toBe(0);
  });

  describe("controls — a guard nobody has watched fail is not known to be a guard", () => {
    it("reports MORE THAN ZERO against a file that genuinely prints a calendar date (positive control)", () => {
      // handover-page.tsx imports and calls formatSheetMoment to print a real calendar date on
      // the printed handover sheet — the strongest control available, because it proves the
      // detector distinguishes the community route from a file that really does the thing.
      const path = "src/components/ward-management/handover/handover-page.tsx";

      expect(dateConstructCount(readFileSync(path, "utf8"), path)).toBeGreaterThan(0);
    });

    it("is not satisfied, or defeated, by the banned names appearing only in a comment", () => {
      const commentOnly = `
        // formatSheetMoment and calendarDateOf are deliberately not used on this route.
        /** See toLocaleDateString / toDateString / toISOString and "new Date(...)" in
         *  ward-clock.ts for why a duration, not a date, is printed here. */
        export const elapsedLabel = "3 days";
      `;
      const realCode = `
        import { formatSheetMoment } from "../ward-clock";
        export const label = formatSheetMoment(instant, dayZero);
      `;

      // The direction that matters: prose promising the exclusion cannot make the guard pass...
      expect(dateConstructCount(commentOnly, "control-comment.ts")).toBe(0);
      // ...and a real read cannot hide behind it.
      expect(dateConstructCount(realCode, "control-comment.ts")).toBeGreaterThan(0);
    });

    it("detects the raw Date-API forms (member access and constructor), not just the two named helpers", () => {
      const commentOnly = `
        // toLocaleDateString, toLocaleString, toDateString, toISOString and new Date() are all
        // banned constructs that must never appear as real code on this route.
      `;
      const realCode = `
        const stamp = new Date().toLocaleDateString();
      `;

      expect(dateConstructCount(commentOnly, "control-raw-date.ts")).toBe(0);
      expect(dateConstructCount(realCode, "control-raw-date.ts")).toBeGreaterThan(0);
    });

    it("does not count a bare Date type annotation as a calendar-date construct", () => {
      // `new Date(...)` is banned; a parameter typed `Date` is not the same thing, and must not
      // trip the detector merely for naming the type.
      const typeOnly = `
        export function accepts(dayZero: Date): string {
          return "duration only";
        }
      `;

      expect(dateConstructCount(typeOnly, "control-type-only.ts")).toBe(0);
    });
  });
});
