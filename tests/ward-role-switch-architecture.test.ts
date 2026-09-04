// tests/ward-role-switch-architecture.test.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { referrals as seededReferrals } from "../src/components/ward-management/ward-movements";
import { wardScopedReferral } from "../src/components/ward-management/ward-referral-visibility";

/**
 * Ward Flow navigation-shell plan, Task 4 (`docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md`).
 *
 * Decision 2: switching role in Ward Flow navigates to that role's own home; it cannot keep you on
 * the referral you were looking at. That is not a UX simplification — it is forced by FD-23, which
 * `ward-referral-visibility.ts` implements as an ARCHITECTURE, not a rule a screen could relax:
 * `WardScopedReferral` has no `destinations` field, nothing converts a ward-scoped projection into
 * a coordinator-scoped one, and no function in that module takes a role/scope/viewer argument that
 * could be used to widen what a ward sees. This file pins those three static facts so a later,
 * well-meaning "just keep me on this referral when I switch role" change fails a test instead of
 * quietly reopening the leak the module's own doc comment warns against.
 *
 * `ward-role-switcher.tsx` carries the matching comment explaining WHY it still navigates by
 * `<Link>` to role homes rather than trying to preserve the current referral across a role switch.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_ROOT = path.join(REPO_ROOT, "src", "components", "ward-management");
const VISIBILITY_FILE = path.join(WARD_ROOT, "ward-referral-visibility.ts");

function readModule(absolutePath: string): string {
  // Normalised to LF: the repository enforces LF via .gitattributes, but a working tree that has
  // picked up CRLF must fail this suite on its content, never on its line endings.
  return readFileSync(absolutePath, "utf8").split("\r\n").join("\n");
}

/** Every `.ts`/`.tsx` file under WARD_ROOT. A directory whose extension filter matches nothing
 *  (mutation 3) returns `[]` here, which is exactly the state the anti-vacuity test below exists
 *  to catch before any absence assertion gets a chance to pass vacuously. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Strips block and line comments so an identifier search below matches CODE, never a comment
 *  that is deliberately documenting why that identifier must not exist. Both regexes are
 *  literals, not built from a template string — a template literal would drop the `\*`/`\/`
 *  escapes and silently stop matching. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Balanced-paren extraction of every `export function NAME(...)` parameter list in `source`. A
 *  plain regex on `\(([^)]*)\)` would stop at the first `)`, which is wrong the moment a param
 *  type itself contains one (e.g. a tuple or a call-signature type) — this walks paren depth
 *  instead so it stays correct if a future signature gets more complex. */
function exportedFunctionParamLists(source: string): { name: string; params: string }[] {
  const results: { name: string; params: string }[] = [];
  const opener = /export\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const name = match[1];
    let depth = 1;
    let i = opener.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    results.push({ name, params: source.slice(opener.lastIndex, i - 1) });
  }
  return results;
}

/** Splits a parameter list on its TOP-LEVEL commas, so a param whose own type carries a comma
 *  (a tuple, a generic with two args) is not mistaken for two parameters. */
function topLevelSplit(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
    else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current);
  return parts;
}

/** The parameter's bare NAME — everything before its top-level `:` type annotation or `=`
 *  default, so `role: string` and `role = "ward"` are both read as the name `role`. */
function paramName(rawParam: string): string {
  const trimmed = rawParam.trim();
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
    else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth--;
    if (depth === 0 && (ch === ":" || ch === "=")) return trimmed.slice(0, i).trim();
  }
  return trimmed;
}

describe("FD-23 as architecture, not a flag that could be passed the other way", () => {
  describe("ward-referral-visibility.ts exports no function taking a role/scope/viewer argument", () => {
    const source = readModule(VISIBILITY_FILE);
    const signatures = exportedFunctionParamLists(source);

    it("found exported functions to check, or this test is vacuous", () => {
      expect(signatures.length).toBeGreaterThan(0);
      expect(signatures.map((sig) => sig.name)).toContain("wardScopedReferral");
    });

    it("no exported function takes a parameter named role, scope, or viewer", () => {
      const offenders = signatures.flatMap(({ name, params }) =>
        topLevelSplit(params)
          .map(paramName)
          .filter((candidate) => /^(role|scope|viewer)$/i.test(candidate))
          .map((candidate) => `${name}(${candidate})`),
      );
      expect(offenders).toEqual([]);
    });
  });

  describe("no hideOtherDestinations flag anywhere under src/components/ward-management/", () => {
    const files = sourceFiles(WARD_ROOT);

    it("found the ward-management source files, or every assertion below is vacuous", () => {
      expect(files.length).toBeGreaterThan(20);
      expect(files).toContain(VISIBILITY_FILE);
    });

    it("the search itself can find a string that is genuinely present (positive control)", () => {
      // Proves the comment-stripping + substring search below is capable of finding something,
      // before trusting it to report an absence. `wardScopedReferral` is a real exported function
      // name, written in code (not only in a comment), so this must hit at least once.
      const hits = files.filter((file) => stripComments(readModule(file)).includes("wardScopedReferral"));
      expect(hits.length).toBeGreaterThan(0);
    });

    it("no file declares a hideOtherDestinations identifier in code", () => {
      // The literal string DOES appear in this tree today — twice, in comments in
      // ward-referral-visibility.ts and ward/ward-screen.tsx, both explicitly warning that the
      // flag must never exist. That is documentation of the architecture, not a violation of it,
      // so the search runs on comment-STRIPPED source: it must catch the flag arriving as real
      // code (a type field, a parameter, a variable) while leaving the cautionary comments alone.
      const offenders = files.filter((file) => /\bhideOtherDestinations\b/.test(stripComments(readModule(file))));
      expect(offenders).toEqual([]);
    });
  });

  describe("WardScopedReferral's field list carries no destinations", () => {
    // Derived from calling the REAL projection function on a REAL seeded referral — never from a
    // hand-built object shaped to match the type — so a test-only edit to the object under test
    // cannot also edit what "actual" means. Only the ALLOWED list below is hand-written.
    const wardReferral = seededReferrals.find((referral) => referral.id === "RF-001");

    it("found the seeded fixture this check depends on", () => {
      expect(wardReferral).toBeDefined();
    });

    const projection = wardReferral ? wardScopedReferral(wardReferral) : undefined;

    it("produced a ward-scoped projection to check", () => {
      expect(projection).toBeDefined();
    });

    // Hand-written literal, sorted. This is the thing a well-meaning "just add destinations back"
    // change would widen — and Mutation 2 (adding "destinations" here only, never to the source)
    // proves the comparison is against the real projection's actual keys, not against itself.
    const ALLOWED_WARD_SCOPED_REFERRAL_FIELDS = [
      "addressing",
      "ageBand",
      "homeRegion",
      "id",
      "originSiteCode",
      "raisedAt",
      "source",
      "transportNeeded",
      "urgency",
    ].sort();

    it("has exactly the allowed top-level fields, and none named destinations", () => {
      const actualKeys = Object.keys(projection!).sort();
      expect(actualKeys).toEqual(ALLOWED_WARD_SCOPED_REFERRAL_FIELDS);
      expect(Object.keys(projection!)).not.toContain("destinations");
    });
  });
});
