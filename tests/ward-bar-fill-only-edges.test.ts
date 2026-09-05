// tests/ward-bar-fill-only-edges.test.ts
//
// ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. It reads a stylesheet off disk and imports
// nothing from `src/`, so `vitest related` has no edge to it and a focused green has not run it.
// Run it by name, or let the full ward suite do it. `tests/ward-forced-colors-tokens.test.ts` says
// the same of itself, and this file follows its shape.
//
// WHAT THIS GUARDS, AND WHY THE POPULATION IS DERIVED RATHER THAN LISTED.
//
// `ward-bar.module.css` is the one ward primitive whose meaning is carried by coloured fills and
// nothing else. Under `forced-colors: active` every one of those fills is overridden to a system
// colour, so the five tones land on one and the bar reads as a single undivided band. In print the
// shared `ward-tokens.module.css` reset — which reaches this file because `.bar` COMPOSES
// `wardTokens`, putting both class names on one element — sets `background-color: Canvas
// !important` on everything here, so the bar prints as an empty rail. Both are answered by DRAWING
// the split instead of filling it; the reasoning, and why the fills are deliberately not bought
// back, is in the stylesheet's own block comment.
//
// 🔴 A HARD-CODED ["segment", "swatch"] WOULD BE THE WRONG GUARD, in the only direction that
// matters. It stays green the day somebody adds a sixth tone, or a new fill-carrying part, without
// adding it to either at-rule block — which is exactly the change this exists to catch. So the
// population is COMPUTED from the stylesheet: every class given a `--ward-*` fill in screen media,
// minus every class given a real border or outline there.
//
// ⚠️ `border-radius` IS NOT A DRAWN EDGE. The first pass at this detector matched it and reported
// `.swatch` as already edged — the opposite of true. A corner radius satisfying a check about
// visible boundaries is the kind of near-miss that reads as a pass, so it has its own control pair
// below rather than a comment.
//
// ⚠️ COMMENTS ARE STRIPPED BEFORE ANYTHING IS SCANNED. A guard that reads CSS as text is otherwise
// satisfied by the very line somebody commented out, with a note above it explaining why.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { guardControls } from "./helpers/guard-control";

const BAR = join(process.cwd(), "src/components/ward-management/ward-bar.module.css");
const FORCED = "@media (forced-colors: active)";
const PRINT = "@media print";

const EDGE_DECLARATION = /(^|[\s;])(border|outline)(-(top|right|bottom|left))?(-(width|style|color))?\s*:\s*([^;}]+)/g;
const WARD_FILL = /(^|[\s;])background(-color)?\s*:\s*var\(--ward-/;

/**
 * Does this rule body DRAW an edge?
 *
 * ⚠️ TWO NEAR-MISSES, BOTH FOUND BY MUTATION RATHER THAN BY READING, AND BOTH READ AS A PASS:
 *
 *   `border-radius`   is not an edge at all. The property pattern above excludes it by not offering
 *                     `-radius` as a longhand. The first pass at this detector did offer it, and
 *                     reported `.swatch` as already handled — the opposite of true.
 *   `border-right: 0` is the property, carrying the value that REMOVES the edge. This stylesheet
 *                     legitimately has one (`.segment:last-child`, because the track's own border
 *                     already draws the last band's right-hand end), so a detector that matches the
 *                     property and ignores the value still sees `segment` as drawn after every real
 *                     divider has been deleted. Not hypothetical: that is exactly what mutation M2
 *                     did, and the guard stayed green on it.
 */
function drawsAnEdge(body: string): boolean {
  for (const match of body.matchAll(EDGE_DECLARATION)) {
    const value = match[7].trim();
    if (/^(0|0px|0rem|0em)$/i.test(value)) continue;
    if (/\bnone\b/i.test(value)) continue;
    return true;
  }
  return false;
}

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The balanced text of one at-rule block, `undefined` when the stylesheet does not carry it. */
function atRuleBody(css: string, opening: string): string | undefined {
  const at = css.indexOf(opening);
  if (at === -1) return undefined;
  let depth = 0;
  for (let index = css.indexOf("{", at); index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(at, index + 1);
    }
  }
  return undefined;
}

/** Everything outside any at-rule — the rules that apply on an ordinary screen. */
function screenOnly(css: string): string {
  let out = css;
  for (;;) {
    const opening = out.match(/@[a-z-]+[^{]*(?=\{)/);
    if (!opening || opening.index === undefined) return out;
    const block = atRuleBody(out.slice(opening.index), opening[0]);
    if (!block) return out;
    out = out.slice(0, opening.index) + out.slice(opening.index + block.length);
  }
}

/** `selector { body }` pairs, at-rule openings excluded. */
function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({ selector: match[1].trim(), body: match[2] }))
    .filter((rule) => !rule.selector.startsWith("@"));
}

/** The rightmost class in a selector is the element the rule paints. */
function target(selector: string): string | undefined {
  return [...selector.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map((match) => match[1]).at(-1);
}

/** Classes given a `--ward-*` fill in screen media, edged or not. This is the DENOMINATOR. */
function filledClasses(css: string): string[] {
  const filled = new Set<string>();
  for (const rule of rules(screenOnly(css))) {
    const name = target(rule.selector);
    if (name && WARD_FILL.test(rule.body)) filled.add(name);
  }
  return [...filled].sort();
}

/** Classes given a `--ward-*` fill in screen media and never given a border or outline there. */
function fillOnlyClasses(css: string): string[] {
  const edged = new Set<string>();
  for (const rule of rules(screenOnly(css))) {
    const name = target(rule.selector);
    if (name && drawsAnEdge(rule.body)) edged.add(name);
  }
  return filledClasses(css).filter((name) => !edged.has(name));
}

/**
 * THE PREDICATE, and the whole guard is this one function. A non-empty result means the stylesheet
 * has at least one class whose only edge is a fill and which gains no drawn edge inside `opening` —
 * the bar renders as one undivided band in that medium.
 */
function undrawnUnder(css: string, opening: string): string[] {
  const block = atRuleBody(css, opening);
  const drawn = new Set<string>();
  for (const rule of rules(block ?? "")) {
    const name = target(rule.selector);
    if (name && drawsAnEdge(rule.body)) drawn.add(name);
  }
  return fillOnlyClasses(css).filter((name) => !drawn.has(name));
}

const css = withoutComments(readFileSync(BAR, "utf8"));

describe("WardBar draws the split it can no longer fill", () => {
  it("still carries meaning in colour at all, so nothing below can pass by finding nothing", () => {
    // 🔴 THE FLOOR IS ON THE DENOMINATOR, AND CHOOSING WHICH DENOMINATOR TOOK A SECOND PASS.
    //
    // Flooring the FILL-ONLY count was the obvious first choice and it was wrong: it would go red
    // on somebody honestly giving `.swatch` a border in screen media, which removes it from the
    // fill-only set for the correct reason and needs no at-rule handling at all. A guard that
    // objects to the fix is the guard that gets deleted.
    //
    // What must never be allowed to reach zero silently is the set of classes carrying meaning in
    // a `--ward-*` fill. Empty that — by moving the tones to `color`, or by deleting them — and
    // every per-class assertion below walks nothing and reports green. Three is what the file
    // carries today (`track`, `segment`, `swatch`); this asserts there is a population, never that
    // it has stayed the same size.
    expect(
      filledClasses(css).length,
      "no class in ward-bar.module.css is given a --ward-* fill at all — either the component " +
        "stopped carrying meaning in colour, or this detector stopped detecting",
    ).toBeGreaterThanOrEqual(2);
  });

  it.each([FORCED, PRINT])("%s draws an edge for every fill-only class", (opening) => {
    expect(atRuleBody(css, opening), `ward-bar.module.css carries no ${opening} block at all`).toBeDefined();
    const undrawn = undrawnUnder(css, opening);
    expect(
      undrawn,
      `under ${opening} these classes lose their fill and are given no drawn edge to replace it, ` +
        `so the bar renders as one undivided band: ${undrawn.join(", ")}`,
    ).toEqual([]);
  });

  it("does not buy the edges back by opting out of the medium", () => {
    // Both escape hatches restore the author's colours, and both are the wrong answer here: the
    // token layer's own position is that under forced colours a danger and a success state SHOULD
    // become indistinguishable, because the word is what survives. An edit reaching for one of
    // these has changed that position and should have to say so.
    expect(css).not.toMatch(/forced-color-adjust\s*:\s*none/);
    expect(css).not.toMatch(/print-color-adjust\s*:\s*exact/);
  });
});

/*
 * THE CONTROLS. Both fixtures are copied from the real stylesheet rather than written from memory
 * of it — `guard-control.ts` records what a paraphrased fixture costs.
 */
describe("the detector's controls", () => {
  guardControls({
    guarding: "the fill-only edge guard, under forced colours",
    predicate: (subject) => undrawnUnder(subject, FORCED).length > 0,
    defect: [
      ".segment {\n  display: block;\n}",
      '.segment[data-tone="good"] {\n  background: var(--ward-success);\n}',
    ].join("\n"),
    honest: [
      ".segment {\n  display: block;\n}",
      '.segment[data-tone="good"] {\n  background: var(--ward-success);\n}',
      "@media (forced-colors: active) {\n  .segment {\n    background: Canvas;\n    border-right: 1px solid CanvasText;\n  }\n}",
    ].join("\n"),
  });

  guardControls({
    // 🔴 THE NEAR-MISS THAT ACTUALLY HAPPENED. A rounded corner is not a boundary, and a detector
    // that accepts one reports the fill-only class as already handled.
    guarding: "the fill-only edge guard, told a corner radius is an edge",
    predicate: (subject) => undrawnUnder(subject, FORCED).length > 0,
    defect: [
      '.swatch[data-tone="good"] {\n  background: var(--ward-success);\n}',
      "@media (forced-colors: active) {\n  .swatch {\n    border-radius: var(--ward-radius-pixel);\n  }\n}",
    ].join("\n"),
    honest: [
      '.swatch[data-tone="good"] {\n  background: var(--ward-success);\n}',
      "@media (forced-colors: active) {\n  .swatch {\n    border: 1px solid CanvasText;\n  }\n}",
    ].join("\n"),
  });

  guardControls({
    // 🔴 THE SECOND NEAR-MISS, AND THE ONE THAT ACTUALLY GOT PAST THE GUARD. `border-right: 0` is
    // a real declaration this stylesheet really carries, and it REMOVES an edge. A detector
    // matching the property and ignoring the value counted it as drawing one, so deleting every
    // real divider left the guard green. Copied from the shape the file really has —
    // `.segment:last-child` — not paraphrased.
    guarding: "the fill-only edge guard, shown only the rule that switches an edge OFF",
    predicate: (subject) => undrawnUnder(subject, FORCED).length > 0,
    defect: [
      '.segment[data-tone="good"] {\n  background: var(--ward-success);\n}',
      "@media (forced-colors: active) {\n  .segment:last-child {\n    border-right: 0;\n  }\n}",
    ].join("\n"),
    honest: [
      '.segment[data-tone="good"] {\n  background: var(--ward-success);\n}',
      "@media (forced-colors: active) {\n  .segment {\n    border-right: 1px solid CanvasText;\n  }\n  .segment:last-child {\n    border-right: 0;\n  }\n}",
    ].join("\n"),
  });
});
