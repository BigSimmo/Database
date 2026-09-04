import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The print guard for the movement workspace — the page `ward-management.module.css` styles.
 *
 * ⚠️ THIS TEST IS RED ON THE COMMIT THAT INTRODUCES IT, DELIBERATELY. `ward-management.module.css`
 * has no `@media print` block at all as of 2026-09-04; the redesign builder is adding one. A guard
 * written after the code it guards is a guard written to pass — it can be shaped, unconsciously, to
 * match whatever the implementation happened to do. Written first, it states the requirement and
 * the implementation has to meet it. Delete this paragraph when the block lands and the test goes
 * green; do NOT weaken an assertion to make that happen sooner.
 *
 * ⚠️ AND `npm run test:focused` CAN NEVER SELECT THIS FILE. `test:focused` is `vitest related
 * --run`, which selects by the module import graph, and this test imports nothing from `src/` — it
 * reads the stylesheet as text. Sixteen ward test files share that property, including all three
 * existing print guards. So an adopter editing `ward-management.module.css` gets a green focused
 * run that omits the only guard on the rule they just changed. What DOES run it: `npm run test`,
 * `npm run verify:cheap`, and CI's heavy scope. This is not a defect to fix here — a guard that
 * reads source text cannot be reached by import-graph selection — but it must not be a surprise.
 *
 * WHY THIS PAGE NEEDS ITS OWN GUARD. Six ward screens reset `background` and `color-scheme` on
 * their own root under print. Three of them are guarded (`ward-handover-print`,
 * `ward-morning-print`, `ward-referrals-print`); `board`, `coordinator` and
 * `ward-management-network` carry the pattern unguarded; this page carries neither the block nor a
 * guard.
 *
 * ⚠️ AND THE SHARED SHELL DOES NOT COVER IT. `ward-shell.module.css` gained
 * `@media print { .shell { background: transparent; } }` on 2026-09-04, which is only half of the
 * pattern — it carries no `color-scheme: light`. A page that deletes its own root background and
 * assumes the shell has it covered inherits the background reset and NOT the scheme reset, so
 * `CanvasText` still resolves against the app's inherited dark scheme. Half a fix is available by
 * accident here, which is why both halves are asserted separately below.
 *
 * ── MUTATION RECORD, 2026-09-04 ──────────────────────────────────────────────────────────────
 * A guard is not proven by going red; it is proven by going red for the RIGHT reason and green
 * for the right one. Because this guard is red on arrival, the ordinary mutation proves nothing,
 * so the series runs the other way: supply a correct block, then remove each half in turn.
 *
 *   baseline (no block)          3 failed, 1 passed   ← the 1 is the anti-vacuity floor
 *   correct block                4 passed             ← so it is not red for an unrelated reason
 *   block minus color-scheme     1 failed             ← the color-scheme assertion, alone
 *   block minus background       1 failed             ← the background assertion, alone
 *
 * Each half reddens SEPARATELY. A single assertion covering both would go red either way and
 * could not tell you which one regressed — that is why there are two tests and not one.
 *
 * Every mutant was confirmed to differ from the baseline by hash before its run (a mutation that
 * never executes is indistinguishable from one the assertions cannot detect, and invents a defect
 * rather than missing one), and the stylesheet was restored byte-identical after each, verified
 * against sha1 `9b8305f1a1cbe4239c359f386cbc8b4026987cea` by reversing the edit rather than by
 * `git checkout --`.
 *
 * The helpers below were separately exercised against ten known inputs before the guard was
 * trusted. Three failed on the first attempt: `rulesFor` read a whole `@media` block as one rule
 * whose selector was `@media print` and never looked inside it, which would have reddened this
 * guard against a perfectly correct implementation. Hence `printBlockContents`, not `printBlocks`.
 */

const STYLESHEET = "src/components/ward-management/ward-management.module.css";

/** The page root. NOT `.screen` — this file has no rule by that name, and an assertion phrased for
 *  `.screen` would match nothing and pass vacuously. The anti-vacuity checks below exist because
 *  that failure mode is silent. */
const ROOT = ".patientWorkspace";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE ANY SCAN. A selector named in prose is not a rule. This exact
 * defect has bitten this repository repeatedly: a throwaway checker matched the word `background`
 * inside an explanatory comment and reported a file as painting when it did not, and the hex guard
 * in `ward-design-language-contract.test.ts` had to add stripping for the same reason.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * The CONTENTS of each `@media print` block — what is between its braces, not the block including
 * its `@media print {` wrapper. That distinction is load-bearing: `rulesFor` below reads rules at
 * the top level of whatever it is given, so handing it the wrapped block would make it see one
 * rule whose "selector" is `@media print`, find no `.patientWorkspace`, and report the print block
 * as containing no root rule. Caught by the helper checks before this guard was committed; it
 * would have reddened this guard against a perfectly correct implementation.
 *
 * Brace-matched to the block's own closing brace rather than sliced to end of file. Slicing to end
 * of file makes every later rule in the stylesheet look as though it were inside the print block,
 * which would let this guard pass on a `color-scheme: light` that lives somewhere else entirely.
 *
 * Returns every print block, not the first: a stylesheet may legitimately carry more than one, and
 * reading only the first is the same "first match wins" blindness that let a `--ward-divider` guard
 * certify a value which failed its own rule in the other theme.
 */
function printBlockContents(css: string): string[] {
  const blocks: string[] = [];
  const marker = /@media\s+print\s*\{/gu;
  for (const match of css.matchAll(marker)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const open = start + match[0].length;
    let depth = 1;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(open, i));
          break;
        }
      }
    }
  }
  return blocks;
}

/**
 * Every rule in `fragment` whose selector list contains `selector` as a whole selector — so
 * `.patientWorkspace` matches, and the descendant rule `.patientWorkspace .clinicalRail` does not.
 * Returns bodies in source order.
 */
function rulesFor(fragment: string, selector: string): string[] {
  const bodies: string[] = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = -1;
  for (let i = 0; i < fragment.length; i += 1) {
    const c = fragment[i];
    if (c === "{") {
      depth += 1;
      if (depth === 1) bodyStart = i + 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0 && bodyStart >= 0) {
        const head = fragment.slice(selectorStart, bodyStart - 1);
        const matches = head
          .split(",")
          .map((s) => s.trim())
          .some((s) => s === selector);
        if (matches) bodies.push(fragment.slice(bodyStart, i));
        selectorStart = i + 1;
        bodyStart = -1;
      }
    }
  }
  return bodies;
}

/**
 * ⚠️ THE LAST DECLARATION WINS, AND READING ONLY THE FIRST IS WHY THIS HELPER EXISTS.
 * `ward-management.module.css` declares `.patientWorkspace` TWICE at top level — line 1 paints
 * `var(--ward-canvas)`, line 423 paints `var(--background)`, and the second is what the browser
 * actually uses. A guard that read the first rule would certify a background the page does not
 * have. The same blindness cost the ground detector four separate misses on 2026-09-04.
 */
function effectiveValue(bodies: string[], property: string): string | null {
  let value: string | null = null;
  for (const body of bodies) {
    for (const match of body.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "gu"))) {
      value = match[1].trim();
    }
  }
  return value;
}

describe("the movement workspace prints as ink on paper, not as a dark band", () => {
  /**
   * ⚠️ THE ANTI-VACUITY FLOOR, AND IT IS NOT CEREMONY.
   *
   * Every assertion below is of the form "find the root rule, then check what it says". If the
   * finder returns nothing — wrong selector, a rewritten stylesheet, a brace-matcher that silently
   * broke — those assertions have nothing to check and the natural phrasings of them PASS. That is
   * the failure mode this whole file exists to prevent in the CSS, reappearing in the test.
   *
   * The floor is deliberately a count somebody else measured independently, not merely "greater
   * than zero": a subtly narrowed finder still returns something. Ward Lead counted two top-level
   * `.patientWorkspace` declarations in this file while auditing the ground detector, at lines 1
   * and 423, and this assertion reproduces that number. A finder that can hit two cannot be
   * accidentally matching nothing.
   */
  it("can find the page root at all, so no assertion below can pass vacuously", () => {
    const css = stripComments(source(STYLESHEET));
    const topLevel = rulesFor(css, ROOT);
    expect(
      topLevel.length,
      `${STYLESHEET}: expected the two top-level ${ROOT} rules (lines 1 and 423 as measured ` +
        `2026-09-04). Finding a different number means this file was restructured, or the rule ` +
        `finder is broken — either way every print assertion below is now unreliable, not passing.`,
    ).toBe(2);
  });

  it("has an @media print block at all", () => {
    const css = stripComments(source(STYLESHEET));
    const blocks = printBlockContents(css);
    expect(
      blocks.length,
      `${STYLESHEET} has no @media print block. The movement workspace paints its own background ` +
        `on ${ROOT}, and the print reset in globals.css only resets html/body — a background does ` +
        `not inherit, and an ancestor's reset does not override an element's own declaration. So ` +
        `printing this page while the app is in dark mode puts a near-black rectangle on the ` +
        `paper instead of a readable sheet. Somebody prints a movement list and gets a black page.`,
    ).toBeGreaterThan(0);
  });

  /**
   * First half. Fixing only this turns a dark band into a white sheet — see the second half for why
   * that is not yet safe.
   */
  /*
   * 🔴 REWRITTEN 2026-09-04. THE OLD ASSERTION'S PREMISE WAS FALSE, NOT MERELY STALE.
   *
   * It required `background: none` on ${ROOT} inside this file's own @media print block, and
   * justified the demand like this:
   *
   *     "the page's own `background: var(--background)` (the SECOND of its two declarations,
   *      which is the one that wins) prints as a near-black rectangle in dark mode"
   *
   * MEASURED: background declarations on ${ROOT} anywhere in ${STYLESHEET} — ZERO. There is no
   * second declaration and no first; this file's own comment records that both were deleted. So
   * the sentence names a declaration that does not exist, a cascade that cannot occur, and a
   * repair that would be redundant.
   *
   * ⚠️ IT WAS THE BEST-WRITTEN FAILURE TEXT IN THE WARD SUITE, WHICH IS WHAT MADE IT DANGEROUS.
   * A false claim inside the most fluent, most specific, most clinically grounded sentence
   * available is the one a reader acts on rather than checks — and acting on it meant adding a
   * redundant per-file print block to a root that is already covered.
   *
   * WHAT SURVIVES AND WHAT DIED. The consequence clause is still exactly right and is kept
   * verbatim below: the reader gets a black page where a movement list should be. Every clause
   * naming the mechanism is deleted. **The consequence ages well; the mechanism is a claim about
   * code and expires silently the moment the code moves, while reading better than ever.**
   *
   * WHAT IS ASSERTED INSTEAD — the property, by the route that actually satisfies it. ${ROOT}
   * composes the shared token layer, and `composes` is NOT an ancestor: the compiled element
   * carries both class names, so that layer's `@media print` rule lands on the very element that
   * would carry the background. This assertion is therefore non-vacuous today and stays
   * non-vacuous if a themed background is ever re-added — which the deleted version could not say.
   */
  it(`${ROOT} carries a winning print background reset, by composition`, () => {
    const css = stripComments(source(STYLESHEET));

    const rootRule = new RegExp(`\\.${ROOT.slice(1)}\\s*\\{([^}]*)\\}`).exec(css);
    expect(rootRule, `${STYLESHEET}: no ${ROOT} rule found at all, so this test is walking nothing`).not.toBeNull();

    const composed = /composes:\s*([A-Za-z][\w-]*)\s+from\s+"([^"]+)"/.exec((rootRule as RegExpExecArray)[1]);
    expect(
      composed,
      `${STYLESHEET}: ${ROOT} composes nothing, so nothing can neutralise a themed background on ` +
        `it from a shared layer. The reader gets a black page where a movement list should be.`,
    ).not.toBeNull();

    const [, composedClass, composedFrom] = composed as RegExpExecArray;
    const layerPath = STYLESHEET.split("/")
      .slice(0, -1)
      .concat(composedFrom.split("/"))
      .filter((part) => part !== ".")
      .join("/");
    const layer = stripComments(source(layerPath));
    const layerPrint = printBlockContents(layer);
    expect(
      layerPrint.length,
      `${layerPath} has no @media print block, so composing .${composedClass} neutralises nothing`,
    ).toBeGreaterThan(0);

    const layerBodies = layerPrint.flatMap((block) => rulesFor(block, `.${composedClass}`));
    expect(
      layerBodies.length,
      `${layerPath}: @media print exists but contains no .${composedClass} rule, so the class ` +
        `${ROOT} composes resets nothing`,
    ).toBeGreaterThan(0);

    /*
     * `!important` is required and is not belt-and-braces. `.wardTokens` is (0,1,0); a background
     * declared by a compound selector such as `.table td` is (0,1,1) and wins on specificity
     * before source order is even consulted. A reset without `!important` reads as correct and
     * loses to exactly the elements — tables, lists — that carry the clinical data.
     */
    /*
     * ⚠️ ACCEPTS THE SHORTHAND TOO, AND THAT IS A REPAIR RATHER THAN A LOOSENING. The first version
     * of this required `background-color` specifically. `background: Canvas !important` sets the
     * background colour identically, so that version would have gone RED on correct CSS — and the
     * natural repair, faced with a red test and working code, is to change the CSS to satisfy the
     * test. A reviewer measured that case before it reached anyone.
     *
     * ⚠️ Accepting the shorthand HERE is not licence to write it THERE. The token layer may use
     * either; `board.module.css` may not, because its bed states are drawn with `background-image`
     * and the shorthand drops that image — losing the visual distinction between a bed that is
     * unavailable and one that is free. This guard asks whether the colour is neutralised, not
     * which property spelled it.
     */
    const joined = layerBodies.join(" ");
    expect(
      /background(?:-color)?\s*:\s*[^;{}]*\bCanvas\b[^;{}]*!important/i.test(joined),
      `${layerPath}: .${composedClass} must reset background-color to Canvas with !important ` +
        `inside @media print. Without it, a themed background on ${ROOT} survives into print and ` +
        `the reader gets a black page where a movement list should be.`,
    ).toBe(true);
  });

  /**
   * Second half, and the one that is easy to leave out — the shared shell provides the background
   * reset and NOT this one, so a page can look covered while only half of it is.
   */
  it(`pins color-scheme: light on ${ROOT} inside @media print, so CanvasText ink is never white on white`, () => {
    const css = stripComments(source(STYLESHEET));
    const blocks = printBlockContents(css);
    expect(blocks.length, `${STYLESHEET}: no @media print block to check`).toBeGreaterThan(0);

    const bodies = blocks.flatMap((block) => rulesFor(block, ROOT));
    expect(bodies.length, `${STYLESHEET}: @media print exists but contains no ${ROOT} rule`).toBeGreaterThan(0);

    expect(
      effectiveValue(bodies, "color-scheme"),
      `${STYLESHEET}: ${ROOT} must pin \`color-scheme: light\` inside @media print. ` +
        `\`color-scheme\` inherits, and globals.css sets \`color-scheme: dark\` on the root in dark ` +
        `theme — so any \`CanvasText\` in the print block resolves to WHITE against the white page ` +
        `the background reset just produced. That is worse than the dark band it replaces: a dark ` +
        `page looks broken and gets reported, whereas a blank white page looks like nothing was ` +
        `there and the reader believes the movement list was empty.`,
    ).toBe("light");
  });
});
