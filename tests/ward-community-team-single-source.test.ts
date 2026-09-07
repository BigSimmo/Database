import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "../src/components/ward-management/community/community-derivations";

/**
 * ⚠️ **A GOVERNANCE SENTENCE HELD TRUE BY AN ACTIVE EXCLUSION, AND NOTHING ELSE.**
 *
 * `community-index.tsx` tells a clinician, in its own rendered words, that *"every team listed here
 * comes from one extracted source document."* Ward Verifier confirmed that claim accurate on
 * 2026-09-04 — **and found the reason it is accurate is that somebody actively kept a second list
 * out.** `ward-teams.ts` exports `COMMUNITY_TEAMS`, a region-keyed table, and four separate files
 * carry prose saying the community hub deliberately does not read it.
 *
 * **Four comments and no catcher.** Merging the two lists would not look like a change to a
 * governance sentence; it would look like tidying two sources into one. The rendered paragraph
 * would become false, and every test in this repository would stay green.
 *
 * ⚠️ **THE CLAIM IS STRUCTURAL, SO THIS CATCHER IS TOO — it knows nothing about community teams.**
 * It asserts that the function behind the hub reads exactly one source collection, and that no
 * hub file executes a reference to the rival table. Both are properties of the module graph rather
 * than of the words, so neither can be satisfied by a comment.
 *
 * ⚠️ **THIS FILE CANNOT BE SELECTED BY `npm run test:focused`.** It reads source with
 * `readFileSync` rather than importing it, so vitest's import-graph selection cannot see the
 * relationship. It runs in the full suite only — two guards in this repository sat red for a day
 * because nobody knew that.
 */

const OPTIONS_FILE = "src/components/ward-management/referrals/referral-destination-options.ts";
const HUB_FILES = [
  "src/components/ward-management/community/community-derivations.ts",
  "src/components/ward-management/community/community-index.tsx",
  "src/components/ward-management/community/community-screen.tsx",
];

/** The rival list the hub's rendered paragraph depends on NOT being read. */
const RIVAL = "COMMUNITY_TEAMS";

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/**
 * Every SCREAMING_SNAKE identifier referenced inside a named function's body — a source collection
 * looks like this in every module in this feature, and nothing else does.
 *
 * The TypeScript parser never yields identifiers for text inside comments, so a rule expressed
 * this way is immune to the failure that has now bitten this project three times in one night: a
 * comment satisfying, or defeating, a guard that scans text.
 */
function constantsReferencedIn(source: string, functionName: string, fileName = OPTIONS_FILE): string[] {
  const file = parse(fileName, source);
  const found = new Set<string>();
  let body: ts.Node | undefined;

  const findFunction = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName && node.body) body = node.body;
    ts.forEachChild(node, findFunction);
  };
  findFunction(file);
  if (!body) throw new Error(`${fileName} declares no function named ${functionName}`);

  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && /^[A-Z][A-Z0-9_]*$/.test(node.text) && node.text.length > 3) found.add(node.text);
    ts.forEachChild(node, collect);
  };
  collect(body);
  return [...found].sort();
}

/** Executable references to `name` in a module — declarations, imports and uses; never comments. */
function executableReferencesTo(name: string, source: string, fileName: string): number {
  const file = parse(fileName, source);
  let count = 0;
  const walk = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name) count += 1;
    ts.forEachChild(node, walk);
  };
  walk(file);
  return count;
}

describe("the community hub's one source", () => {
  it("builds its team list from exactly one source collection", () => {
    const constants = constantsReferencedIn(readFileSync(OPTIONS_FILE, "utf8"), "communityTeamOptions");

    // The whole rule, and it is an equality rather than a membership test: a SECOND source joining
    // this function is exactly the change that makes the hub's rendered paragraph false.
    expect(constants).toEqual(["S2015_CATCHMENT_ROWS"]);
  });

  it.each(HUB_FILES)("does not execute a reference to the rival table in %s", (path) => {
    expect(executableReferencesTo(RIVAL, readFileSync(path, "utf8"), path)).toBe(0);
  });

  it("has a non-empty list to make a claim about", () => {
    // Anti-vacuity: both rules above are satisfied by a hub that lists nothing at all.
    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(0);
  });

  describe("controls — a guard nobody has watched fail is not known to be a guard", () => {
    it("reports a SECOND source collection when one is present", () => {
      const withTwo = `
        import { S2015_CATCHMENT_ROWS, COMMUNITY_TEAMS } from "./elsewhere";
        export function communityTeamOptions(): readonly string[] {
          const names = [...S2015_CATCHMENT_ROWS.map((row) => row.name), ...Object.values(COMMUNITY_TEAMS)];
          return names;
        }
      `;

      expect(constantsReferencedIn(withTwo, "communityTeamOptions", "control.ts")).toEqual([
        "COMMUNITY_TEAMS",
        "S2015_CATCHMENT_ROWS",
      ]);
    });

    it("is not satisfied, or defeated, by the rival's name in a comment", () => {
      const inACommentOnly = `
        // COMMUNITY_TEAMS is deliberately not read here.
        /** See COMMUNITY_TEAMS in ward-teams.ts for why this list is separate. */
        export const pages = buildPages();
      `;
      const inCode = `
        import { COMMUNITY_TEAMS } from "./ward-teams";
        export const pages = Object.values(COMMUNITY_TEAMS);
      `;

      // The direction that matters: prose promising the exclusion cannot make the guard pass...
      expect(executableReferencesTo(RIVAL, inACommentOnly, "control.ts")).toBe(0);
      // ...and a real read cannot hide behind it.
      expect(executableReferencesTo(RIVAL, inCode, "control.ts")).toBeGreaterThan(0);
    });
  });
});
