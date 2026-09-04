// tests/ward-primitives-shared.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/components/ward-management";
const PRIMITIVES = join(ROOT, "ward-shared.module.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const CSS = walk(ROOT).filter((f) => f.endsWith(".css"));

/** Named, not derived from the file. A set read out of the stylesheet under test would agree with
 *  it by construction and could never disagree — the baseline must not come from the subject. */
const SHARED = ["field", "hint", "pending", "step", "wardName", "hero", "heroFigures"] as const;

/**
 * Does this stylesheet declare a rule for `.name`?
 *
 * ⚠️ NOT `css.includes(".name {")`. That was the first draft and it missed every real way a
 * redeclaration is written — reviewed 2026-09-04, four surviving mutations, each of which genuinely
 * redeclares the hoisted class:
 *
 *     .wardName, .other { }     a selector list
 *     .wardName:hover { }       a pseudo-class
 *     .wardName::before { }     a pseudo-element
 *     .wardName\n{ }            a newline before the brace
 *
 * `String.raw` is load-bearing: a plain template literal turns `\s` into `s` and `\w` into `w`.
 */
function declares(css: string, name: string): boolean {
  return new RegExp(String.raw`\.${name}(?![\w-])\s*[,:.{]`, "u").test(css);
}

/**
 * ⚠️ PINNED, NOT CAPPED — corrected 2026-09-04. The third assertion below legitimately names four
 * pre-existing screen stylesheets that declare a class this task hoists: `search`, `statistics`
 * and `statistics-sections` all declare `.field`, and `wards/ward-index` declares `.wardName`.
 * These are not a race with sibling tasks landing their own files — they are a real adoption
 * backlog for screens this task does not own and must not edit.
 *
 * Following Task 5's own pattern (`docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md`,
 * "A contract test that pins the language"): NOT a `<=` count, because a count stays green when a
 * violation moves from one file to another, or when a broken walk returns fewer files — the second
 * of which gets greener as coverage collapses. NOT a path allowlist either, because a path allowlist
 * stops failing on a rename. A named list of `file: .class` pairs fails on either.
 *
 * The assertion is "no member outside this list", not "exactly this list" — hoisting one of these
 * four out of its screen file is progress and must not itself go red.
 */
const KNOWN_BACKLOG = [
  /*
   * STAYS EVEN THOUGH SEARCH HAS ADOPTED THE SHARED CLASS. `search/.field` now `composes:` the
   * shared rule and keeps only its own `color`, but composition does not remove a declaration —
   * the local `.field` rule is still there, so this scan still sees the name in two places and is
   * right to. Only deleting the local rule clears the row, and search cannot: it has one property
   * the shared class does not carry.
   *
   * ⚠️ Which means "duplicate" is doing two jobs here: a second independent copy of a rule, and an
   * extension of the shared one by composition. They differ in what somebody must DO about them —
   * the first is a merge, the second is nothing at all. Flagged to Ward Lead 2026-09-04.
   */
  `${join(ROOT, "search", "search.module.css")}: .field`,
  // ⚠️ BOTH statistics rows were removed 2026-09-04 — `statistics.module.css: .field` here, and
  // `statistics-sections.module.css: .field` below. Two builders each renamed ONE of the two files
  // and each deleted only the row for the file they had fixed, so every single-sided resolution of
  // the fold left one stale row behind. MEASURED on the folded line: `.field {` count is 0 and
  // `.fieldName {` count is 1 in BOTH files, so both rows were stale.
  //
  // 🔴 THE TEST IS GREEN IN EVERY RESOLUTION, SO RUNNING IT CANNOT TELL YOU WHICH IS RIGHT. Only
  // re-injecting `.field` separates them, and the matrix is symmetric: keeping either row
  // re-permits the collision in that file, and keeping BOTH — the cautious-looking choice —
  // permits both. Verified here by injection after the fold, not inherited from the derivation:
  //
  //     inject .field into statistics-sections.module.css  -> RED
  //     inject .field into statistics.module.css           -> RED
  //
  // ⚠️ And an earlier check of this very state read the wrong answer because `grep` matched the
  // explanatory COMMENT below rather than a row, reporting the surviving row as removed and the
  // removed one as surviving. Count the rows, never the mentions.
  //
  // That class was renamed
  // `.fieldName` — it is an inline monospace badge wrapping a model field name, not a form-field
  // wrapper, and it never shared a component with the shared `.field` it collided with by name.
  // The row is deleted rather than left as harmless residue: this assertion is one-directional
  // (it forbids members OUTSIDE the list and cannot notice a member that no longer exists), so a
  // stale row here does not merely mis-describe the backlog — it would silently PERMIT a future
  // `.field` in that file, which is the collision the rename was for.
  `${join(ROOT, "wards", "ward-index.module.css")}: .wardName`,
];

describe("the seven classes every screen invented now live in one place", () => {
  it("is checking the stylesheets it thinks it is", () => {
    // Both halves matter: a walk returning sixteen WRONG files passes a length check alone.
    expect(CSS).toContain(PRIMITIVES);
    expect(CSS.length).toBeGreaterThan(15);
  });

  it("defines each shared class in the primitives file", () => {
    const css = readFileSync(PRIMITIVES, "utf8");
    const missing = SHARED.filter((c) => !declares(css, c));
    expect(missing, `not defined in primitives: ${missing.join(" ")}`).toEqual([]);
  });

  it("defines each shared class in no NEW Ward Flow stylesheet beyond the known backlog", () => {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file === PRIMITIVES) continue;
      const css = readFileSync(file, "utf8");
      for (const c of SHARED) {
        if (declares(css, c)) offenders.push(`${file}: .${c}`);
      }
    }
    const surprises = offenders.filter((o) => !KNOWN_BACKLOG.includes(o));
    expect(surprises, `new duplicate(s) not in KNOWN_BACKLOG: ${surprises.join("\n")}`).toEqual([]);
  });
});

describe("the breakpoint scale", () => {
  /**
   * Every `@media (min-width: …rem)` breakpoint in every Ward Flow stylesheet, as a bare rem
   * number.
   *
   * ⚠️ ANCHORED TO `@media`, corrected 2026-09-04. The first draft matched `min-width:\s*([\d.]+)rem`
   * as a bare CSS property, which also matched plain element `min-width` declarations — deliberate
   * horizontal-scroll table floors in `discharges` and `escalation`, each with a comment explaining
   * its exact pixel reasoning. That draft reported 17 "breakpoints", three of which (34, 68, 92rem)
   * never existed in these stylesheets at all; they were measured against the HTML prototypes, a
   * different population, and carried into this file as if they were the same one.
   */
  function breakpoints(): string[] {
    const found = new Set<string>();
    for (const file of CSS) {
      const text = readFileSync(file, "utf8");
      // ⚠️ QUALIFIED BY FILE, NOT A BARE NUMBER. The pin's comment used to claim it was "the same
      // shape as KNOWN_BACKLOG" and catch a breakpoint moving between files — and it did not,
      // because the entries were bare values: 40rem moving from panel to chip changed nothing in
      // the set. The protection described was not the protection implemented. Entries are now
      // `file: value`, so a move shows up as one surprise and one stale entry.
      // Separator normalised, or the pin is a Windows-only pin: every entry would miss on Linux
      // CI, `surprises` would list all twelve as new, and the gate would be red for everyone but
      // the machine it was written on.
      const key = file.replaceAll("\\", "/");
      for (const m of text.matchAll(/@media[^{]*\(\s*min-width:\s*([\d.]+)rem/gu)) {
        found.add(`${key}: ${m[1]}`);
      }
    }
    return [...found].sort();
  }

  it("finds breakpoints at all, so an empty pass cannot look like a clean one", () => {
    expect(breakpoints().length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ PINNED, NOT CAPPED — corrected 2026-09-04. Measured with the `@media`-anchored regex above:
   * eight genuine breakpoints, all in stylesheets this task does not own —
   * 40, 40.0625, 52, 60, 64, 76, 84, 90rem. Collapsing these onto a four-value scale, as the
   * original "at most four" cap demanded, would rewrite documented, working layout in files outside
   * this task's scope. The assertion is "no NEW breakpoint", the same shape as KNOWN_BACKLOG above:
   * a count would stay green if a breakpoint moved between files, or if the walk silently narrowed.
   */
  const KNOWN_BREAKPOINTS = [
    // ⚠️ ADDED 2026-09-04, AND THE GATE HAD BEEN RED SINCE THESE TWO FILES LANDED. `ed-home` (48)
    // and `ed-service-bands` (60) are part of the ED cluster's design-language adoption; both were
    // committed without their rows, so this assertion was failing on the integration line at the
    // same time as `COVERING_THE_GROUND`'s `freed` half in the sibling contract test. Two red gates,
    // neither noticed, because nobody's work happened to touch either file.
    //
    // ⚠️ AND `ed-service-bands.module.css` WAS ON NOBODY'S FILE LIST. It is a tenth file in a
    // cluster two separate surveys described as nine, which is exactly how its 60 went unpinned. A
    // walk and a hand-written brief disagreed and the walk was right.
    "src/components/ward-management/ed/ed-home.module.css: 48",
    "src/components/ward-management/ed/ed-service-bands.module.css: 60",
    "src/components/ward-management/board/board.module.css: 60",
    "src/components/ward-management/board/board.module.css: 84",
    "src/components/ward-management/coordinator/coordinator.module.css: 64",
    "src/components/ward-management/coordinator/coordinator.module.css: 90",
    "src/components/ward-management/referrals/referrals.module.css: 40",
    "src/components/ward-management/ward-figure.module.css: 52",
    "src/components/ward-management/ward-figure.module.css: 76",
    "src/components/ward-management/ward-management-modes.module.css: 64",
    "src/components/ward-management/ward-management.module.css: 64",
    "src/components/ward-management/ward-shared.module.css: 60",
    "src/components/ward-management/ward-sidebar.module.css: 40.0625",
    "src/components/ward-management/ward-sidebar.module.css: 64",
  ];

  it("introduces no breakpoint outside the known set", () => {
    const bp = breakpoints();
    const surprises = bp.filter((v) => !KNOWN_BREAKPOINTS.includes(v));
    expect(surprises, `new breakpoint(s) not in KNOWN_BREAKPOINTS: ${surprises.join(" ")}`).toEqual([]);
  });
});
