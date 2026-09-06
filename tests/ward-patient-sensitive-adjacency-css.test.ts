// tests/ward-patient-sensitive-adjacency-css.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE PLACEMENT RULE IS ABOUT WHAT A READER SEES, AND THE EXISTING GUARDS ASSERT DOM ORDER.
 *
 * 🔴 THE LIVE DEFECT THIS FILE WAS WRITTEN AGAINST, measured 2026-09-05 and not hypothetical.
 *
 * `person-screen.tsx` renders two sensitive fields — Aboriginal or Torres Strait Islander status
 * and interpreter / preferred language — under a rule with two halves: they must not sit adjacent
 * to each other, and neither may sit directly above a psychiatric history panel. The field ORDER
 * separates them with GP, and `tests/ward-patient-placement-fields.dom.test.tsx` asserts that
 * order, each half proved by its own mutation.
 *
 * **`.factList` is `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr))`
 * and `gap: 0.75rem`.** So the number of columns is whatever fits, and the eight placement facts
 * reflow. Computed for each column count:
 *
 *     1 col : Aboriginal r4c1, interpreter r6c1  -> separated
 *     2 cols: Aboriginal r2c2, interpreter r3c2  -> **VERTICALLY ADJACENT**
 *     3 cols: Aboriginal r2c1, interpreter r2c3  -> same row, separated by GP
 *     4 cols: Aboriginal r1c4, interpreter r2c2  -> separated
 *
 * **Two columns is a phone in portrait.** `auto-fit` fills `floor((W + gap) / (9rem + gap))` tracks;
 * a 375px viewport less the panel's padding is about 21.9rem, which gives exactly 2. So on the
 * device a ward coordinator actually holds, **the two fields the rule keeps apart are stacked one
 * directly above the other** — and every DOM-order assertion stays green, because the DOM order
 * never changed.
 *
 * ⚠️ **AND I ASSERTED THE OPPOSITE IN WRITING BEFORE READING THE FILE.**
 * `docs/ward-flow/design/patient-page-second-edition-spec.md` said *"today the facts render as a
 * single-column `<dl>`, so DOM order and reading order are the same thing and the tests are
 * sound"*, and framed the multi-column risk as something a future redesign **would introduce**. It
 * was already there. I described the current state from assumption while writing a document whose
 * entire subject was that assumption's failure mode.
 *
 * WHY THIS GUARD READS CSS AND NOT THE DOM: jsdom computes no layout, so `offsetTop`,
 * `getBoundingClientRect` and computed grid placement are all zero or absent there. A guard
 * asserting positions in jsdom would pass on any stylesheet whatsoever — a check that cannot fail.
 * The stylesheet text is the only thing available offline that carries the answer, so the property
 * asserted is: **the placement fact list resolves to ONE column at every width.**
 */

const CSS_PATH = "src/components/ward-management/patients/person.module.css";

/** The rule body for a class, `@media` blocks included, by brace matching. */
/**
 * COMMENTS STRIPPED BEFORE MATCHING - AND THE OMISSION MADE THIS GUARD FIGHT ANYONE DOCUMENTING THE
 * RULE IT PROTECTS.
 *
 * `ruleBodies` finds a rule by matching its selector as literal text and scanning forward to the
 * next opening brace. Without stripping comments, **a mention of the selector in prose is a match**:
 * the scan runs past the rest of the comment and attaches whatever brace comes next as a fabricated
 * rule body. On this stylesheet that body was the definition-table rule below, whose two-track
 * `grid-template-columns` was then reported as a violation of the one-column rule above it.
 *
 * FOUND BY THE SESSION BUILDING THE PATIENT PAGE, and proved rather than reasoned: its first draft
 * of the comment explaining the layout named the selector several times and made this guard fail
 * with the two-track value quoted back. It worked around it by never spelling the selector out -
 * a workaround that imposed a permanent restriction on every future editor of that comment.
 *
 * THAT WORKAROUND SHOULD NOT HAVE BEEN NECESSARY AND IS NOT NOW. This is the mirror of the rule
 * three other guards here already follow: a guard that scans source text is satisfied by prose
 * unless it excludes prose - and, in this direction, DEFEATED by prose. Same mechanism, opposite
 * sign: there a comment made a guard pass, here a comment made it fail.
 *
 * A false failure is the milder of the two and still costs: it teaches the next person that
 * documenting the thing is dangerous, which is exactly backwards for a rule whose whole defence is
 * that somebody reads why it exists.
 *
 * ⚠️ **WHERE THE COMMENT SITS DECIDES WHETHER THE DEFECT HAPPENS AT ALL, AND MY FIRST MUTATION PUT
 * IT IN THE ONE PLACE THAT CANNOT REPRODUCE IT.** The selector pattern requires no brace between
 * the mention and the next `{`. A mention INSIDE a rule body therefore matches nothing — the next
 * character that matters is the body's own `}` — so a comment there is harmless with or without the
 * strip, and a mutation placed there reports SURVIVED on the broken code and proves nothing. The
 * defect needs a mention in a block comment sitting ABOVE some OTHER rule, where the next `{` is
 * that rule's. Measured on this stylesheet, both placements, against the code with and without the
 * strip:
 *
 *     inside the rule body        no strip: 1 body ["1fr"]   strip: 1 body ["1fr"]
 *     above the definition table  no strip: 2 bodies ["1fr", "minmax(9rem, 14rem) 1fr"]
 *                                 strip:    1 body   ["1fr"]
 *
 * The second row's phantom body is the failure the patient-page session hit, with the two-track
 * value quoted back at it. **A mutation aimed at the wrong location is indistinguishable from an
 * assertion that does not cover the property** — both print SURVIVED. Aim it where the mechanism
 * says the defect lives, and check the mutant is the mutant you described.
 */
function ruleBodies(css: string, className: string, stripComments = true): { condition: string; body: string }[] {
  const found: { condition: string; body: string }[] = [];
  if (stripComments) css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = new RegExp(`\\.${className}\\b[^{}]*\\{`, "g");
  for (const match of css.matchAll(pattern)) {
    const open = css.indexOf("{", match.index);
    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    // Which at-rule, if any, encloses this declaration.
    const before = css.slice(0, match.index);
    const lastAt = before.lastIndexOf("@media");
    let condition = "base";
    if (lastAt !== -1) {
      const atOpen = css.indexOf("{", lastAt);
      let d = 0;
      let k = atOpen;
      for (; k < css.length; k += 1) {
        if (css[k] === "{") d += 1;
        else if (css[k] === "}") {
          d -= 1;
          if (d === 0) break;
        }
      }
      if (k > match.index) condition = before.slice(lastAt, css.indexOf("{", lastAt)).trim();
    }
    found.push({ condition, body: css.slice(open + 1, j) });
  }
  return found;
}

/**
 * The one-column property, over already-extracted rule bodies.
 *
 * EXTRACTED SO THE WITNESS TEST BELOW CAN ASK THE SAME QUESTION OF THE UNSTRIPPED STYLESHEET. The
 * two callers differ only in what they are handed — stripped bodies, which must be clean, and
 * unstripped ones, which must NOT be. Same predicate, opposite expectation, disjoint inputs: this
 * is deliberately not the shape where a filter and an assertion share a predicate and agree by
 * construction.
 */
function offendersIn(bodies: { condition: string; body: string }[]): string[] {
  const offenders: string[] = [];
  const SINGLE_COLUMN = new Set(["1fr", "minmax(0, 1fr)", "none", "auto"]);
  for (const { condition, body } of bodies) {
    const declare = (property: string) => {
      const found = new RegExp(`(?:^|;|\\{)\\s*${property}\\s*:\\s*([^;]+);`).exec(body);
      return found ? found[1].replace(/\s+/g, " ").trim() : undefined;
    };

    // (a) It must still be a grid. Flex, block or inline-flex all lay out differently and none of
    //     them is covered by a template check.
    const display = declare("display");
    if (display !== undefined && display !== "grid") {
      offenders.push(`${condition}: display: ${display} — not a grid, so the column check below cannot apply`);
      continue;
    }

    // (c) The shorthand sets rows AND columns; the longhand may then never appear.
    const shorthand = declare("grid-template");
    if (shorthand !== undefined) {
      offenders.push(`${condition}: grid-template: ${shorthand} — use the longhand so this is checkable`);
    }

    // (b) Column flow makes columns out of a template this guard would call single.
    const flow = declare("grid-auto-flow");
    if (flow !== undefined && !/^row\b/.test(flow)) {
      offenders.push(`${condition}: grid-auto-flow: ${flow} — lays items out in columns`);
    }

    const value = declare("grid-template-columns");
    if (value === undefined) {
      // Only the base rule must carry it; a media block that changes nothing else is fine.
      if (condition === "base") {
        offenders.push(`${condition}: no grid-template-columns at all — absence is not single-column`);
      }
      continue;
    }
    if (!SINGLE_COLUMN.has(value)) offenders.push(`${condition}: grid-template-columns: ${value}`);
  }
  return offenders;
}

describe("the two sensitive patient fields cannot become adjacent by reflow", () => {
  const css = readFileSync(CSS_PATH, "utf8");

  it("finds the placement fact list at all, so the assertions below are not vacuous", () => {
    const bodies = ruleBodies(css, "factList");
    expect(bodies.length, `no .factList rule found in ${CSS_PATH} — has it been renamed?`).toBeGreaterThan(0);
  });

  it("resolves the fact list to a single column at every width", () => {
    /*
     * 🔴 THE PROPERTY, AND WHY IT IS COLUMN COUNT RATHER THAN A POSITION CALCULATION.
     *
     * A guard that recomputed "which cell does each field land in" would have to model auto-fit,
     * the container width and the panel's padding — three things this file cannot see and which a
     * redesign changes freely. **One column is the only condition under which the DOM order the
     * other guards assert IS the reading order**, which is what makes the existing mutation-proved
     * tests mean what they claim.
     *
     * `auto-fit`/`auto-fill` with a `minmax()` track is what produced the defect: it silently
     * becomes as many columns as fit. Any multi-track template is rejected, in the base block and
     * in every media block, because a rule that holds at one width and not another is exactly the
     * shape that let this reach a phone unnoticed.
     *
     * 🔴 REWRITTEN AFTER WARD VERIFIER BROKE IT THREE WAYS, ALL FALSE PASSES, ALL OUTSIDE THE
     * PROPERTY IT READ. The whitelist of template values was sound — no multi-column value slips
     * through it. **The bypasses were that `grid-template-columns` is not where the column count is
     * decided.**
     *
     *   (a) `if (!template) continue` — an ABSENT declaration was skipped. Change this rule to
     *       `display: flex; flex-wrap: wrap` and there is no `grid-template-columns` at all: zero
     *       offenders, guard green, two columns on a 375px phone, and Aboriginal status is directly
     *       above interpreter language again.
     *   (b) `grid-auto-flow: column` beside a whitelisted `none` or `auto` produces columns from a
     *       value this guard called single-column. It never read that property.
     *   (c) the `grid-template:` shorthand sets columns without the longhand ever appearing.
     *
     * ⚠️ **(a) IS NOT EXOTIC — IT IS THE HOUSE STYLE.** Measured across ward CSS: `flex-wrap` 91
     * occurrences, `grid-auto-flow` 1, `grid-template:` shorthand 0. **So the likeliest future edit
     * to this rule is precisely the one the first version could not see.**
     *
     * ⚠️ **AND THE PREMISE THAT FAILED IS THE SAME SHAPE AS THE ONE THIS FILE EXISTS TO CORRECT.**
     * The spec said "the facts render as a single-column definition list" — true-sounding, already
     * false. This guard said "the column count lives in `grid-template-columns`" — true of the rule
     * in front of me, false of the codebase by a factor of ninety. **A correct observation about
     * one file, generalised into a rule about the system.** Twice, in two hours, by the same hand.
     *
     * So the assertion is now POSITIVE — the rule must still BE a single-column grid — and an
     * absent declaration is a failure rather than a skip. A guard that can only reject known-bad
     * values passes on every layout it was not taught about.
     */
    const offenders = offendersIn(ruleBodies(css, "factList"));
    expect(
      offenders,
      "the placement fact list can lay out in more than one column. At two columns — which is a " +
        "375px phone — Aboriginal or Torres Strait Islander status renders DIRECTLY ABOVE " +
        "interpreter / preferred language, and the placement rule keeps them apart. " +
        "tests/ward-patient-placement-fields.dom.test.tsx asserts DOM order and cannot see this. " +
        "If a multi-column layout is wanted here, it needs the owner and a positional guard, not a " +
        "wider template:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("keeps the shipped comment working as the regression witness for the comment strip", () => {
    /*
     * 🔴 A GUARD THAT PROVES A FIX IS ITSELF A THING THAT CAN SILENTLY STOP PROVING IT.
     *
     * The stylesheet's own comment names `.factList` above a DIFFERENT rule, which is the exact
     * shape that used to fabricate a rule body and fail the assertion above. That makes the shipped
     * file the regression witness for the strip: remove the strip and the guard goes red on real
     * source, with no fixture to maintain.
     *
     * ⚠️ **BUT THE WITNESS HAS THREE PRECONDITIONS AND THE COMMENT STATES ONLY ONE OF THEM.**
     * Ward Verifier broke it deliberately and reported that routine edits disarm it while every
     * assertion stays green:
     *
     *   1. the comment still names `.factList` literally — a tidy that drops the mention ends it;
     *   2. no brace falls between that mention and the next opening brace — and this codebase
     *      routinely quotes CSS inside CSS comments, which severs the match;
     *   3. the next rule after the comment is one whose body actually offends — insert any new
     *      rule between the comment and the definition table and the fabricated body becomes the
     *      newcomer's.
     *
     * **None of those is visible to somebody editing that area, and none of them touches this
     * file.** So this assertion states them as a test rather than as a hope: it asks the SAME
     * predicate of the UNSTRIPPED stylesheet and requires it to fail. The day the witness stops
     * witnessing, this goes red and says why.
     *
     * ⚠️ It is deliberately NOT the shape where a filter and an assertion share a predicate and
     * therefore agree by construction: the two tests run one predicate over two disjoint inputs —
     * stripped bodies, which must be clean, and unstripped ones, which must not be.
     */
    const unstripped = offendersIn(ruleBodies(css, "factList", false));
    /*
     * 🔴 IT MUST FIRE FOR THE RIGHT REASON, AND MY FIRST VERSION OF THIS ASSERTION DID NOT CHECK
     * THAT — the same defect I had just fixed one level down, reproduced one level up.
     *
     * Asking only "does anything offend without the strip" passes on two of Ward Verifier's three
     * break edits, measured against this file rather than argued:
     *
     *     E1 mention removed                  offenders 0        -> red either way
     *     E2 braces added inside the comment  offenders 0        -> red either way
     *     E3 a new rule inserted between      offenders 1, but   -> **PASSES the loose version**
     *        comment and definition table     "no grid-template-
     *                                          columns at all"
     *
     * Under E3 the fabricated body becomes the newcomer's. It still offends — via the absence
     * branch — so a loose count stays green while the mechanism under test, a prose mention
     * capturing a REAL multi-column rule, is no longer exercised at all. **An offence of the wrong
     * kind is indistinguishable from the right one if all you count is offences.**
     *
     * So the requirement is the specific one: the unstripped scan must fabricate a body carrying an
     * actual multi-track `grid-template-columns`. Absence does not qualify, and neither does a
     * non-grid display.
     */
    const forTheRightReason = unstripped.filter((entry) => /grid-template-columns: \S/.test(entry));
    expect(
      forTheRightReason,
      "the stylesheet comment has stopped proving that the comment strip is needed. Nothing is " +
        "broken on screen — the layout guard above still holds — but the strip in ruleBodies is " +
        "now unwitnessed, so a future edit could remove it and no test would notice. One of three " +
        "things changed in person.module.css: (1) the comment no longer names .factList literally; " +
        "(2) a brace was introduced between that mention and the next rule, which quoting CSS " +
        "inside the comment does; or (3) a new rule was inserted between the comment and " +
        ".screen .fact, so the fabricated body is now that rule's and no longer carries a " +
        "multi-column template. Case (3) is the quiet one: something still offends, just not for " +
        "the reason this witness exists. Restore whichever it was, or replace the witness " +
        "deliberately — do not delete it to get to green.\nunstripped offenders seen: " +
        (unstripped.length === 0 ? "(none at all)" : unstripped.join(" | ")),
    ).not.toEqual([]);
  });

  it("keeps GP between the two sensitive fields in the rendered source, so one column is enough", () => {
    /*
     * The companion half. Single column makes DOM order the reading order; this asserts the DOM
     * order is still the one the rule needs. Without it, the guard above would be satisfied by a
     * single column that had been reordered to put the two fields side by side vertically.
     */
    const screen = readFileSync("src/components/ward-management/patients/person-screen.tsx", "utf8");
    const aboriginal = screen.indexOf('slot="aboriginalOrTorresStraitIslander"');
    const gp = screen.indexOf('label="GP"');
    const interpreter = screen.indexOf('slot="interpreterLanguage"');
    expect(aboriginal, "the Aboriginal status slot is not rendered").toBeGreaterThan(-1);
    expect(gp, "the GP fact is not rendered").toBeGreaterThan(-1);
    expect(interpreter, "the interpreter language slot is not rendered").toBeGreaterThan(-1);
    expect(
      aboriginal < gp && gp < interpreter,
      "GP no longer sits between the two sensitive fields. In a single-column list that makes " +
        "them adjacent on screen, which is the half of the placement rule this ordering exists to " +
        "satisfy.",
    ).toBe(true);
  });
});
