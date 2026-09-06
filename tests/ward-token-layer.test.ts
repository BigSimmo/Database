// tests/ward-token-layer.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every guard in this file matches declaration-shaped text with a regex, and a CSS comment is
 * declaration-shaped text that declares nothing. Three such mentions exist in the ward estate
 * today — one of them inside `ward-tokens.module.css` itself, at the file's own comment about
 * `--ward-canvas: var(--surface)`. Nothing is currently fooled by them (the canonical declaration
 * comes first, and the exactly-once count runs on the pre-`@media` slice that excludes the
 * mention), so this is a latent defect rather than a live one — which is exactly when it is cheap.
 * A guard that reads prose as code fails in whichever direction the prose happens to point, and
 * the direction that stays green is the one nothing reports.
 *
 * ⚠️ This materially changes what the length floor in the exactly-once guard measures. The base
 * slice was 7,164 characters raw and is 1,698 stripped — the file is 86% comment — against a floor
 * of 1,000. It still clears it, and the floor is now a floor on actual declarations rather than on
 * prose, which is stronger. But the margin went from roughly 7x to 1.7x, so a future token removal
 * could trip it where it would not have before. Left at 1,000 deliberately: lowering it to restore
 * the old margin would weaken the only thing it checks.
 */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//gu, "");

const TOKENS = withoutComments(readFileSync("src/components/ward-management/ward-tokens.module.css", "utf8"));

const WARD_DIR = "src/components/ward-management";

/** Recursively lists every file under `dir` (module.css files live in subdirectories too, e.g.
 * `morning/morning.module.css`, `handover/handover.module.css`). */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function wardStylesheets(): string[] {
  return walk(WARD_DIR)
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => file.split("\\").join("/"));
}

/** Every token the layer must declare, and nothing may declare them twice. */
const REQUIRED = [
  "--ward-ground",
  "--ward-divider",
  "--ward-canvas",
  "--ward-border",
  "--ward-border-strong",
  "--ward-text",
  "--ward-muted",
  "--ward-blue",
];

/**
 * The token layer's BASE declarations — every `@media` block stripped out.
 *
 * 🔴 WHY THIS EXISTS. The uniqueness check below used to count raw occurrences
 * across the whole file, and on 2026-09-05 a `@media (forced-colors: active)`
 * block was added re-pointing eight roles to system colours. Two of them are in
 * `REQUIRED`, so the guard reported `--ward-divider declared 2 times` and went
 * red against a change that was correct.
 *
 * ⚠️ A HIGH-CONTRAST OVERRIDE IS NOT A SECOND DECLARATION. It is a conditional
 * replacement, and re-declaring the token is the only way CSS expresses one. A
 * layer that must not repeat itself in its base block must still be allowed to
 * override itself in a media block, or it can never support forced colours,
 * print or a theme at all.
 *
 * ⚠️ AND THE COUNT WAS NOT THE ONLY THING AT RISK. Anything resolving a token by
 * first textual match would have started resolving `--ward-divider` to
 * `CanvasText` and computing a contrast ratio against a system keyword. Stripping
 * the media blocks fixes both, which is why it is done here once rather than at
 * each call site.
 *
 * Fails loudly rather than silently on unbalanced braces: a strip that quietly
 * returned the whole file would restore the original defect, and a strip that
 * quietly returned nothing would make every count 0 and read as a different bug.
 */
function splitOnMediaBlocks(css: string): { base: string; blocks: string[] } {
  let base = "";
  const blocks: string[] = [];
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) {
      base += css.slice(i);
      break;
    }
    base += css.slice(i, at);
    const open = css.indexOf("{", at);
    if (open === -1) throw new Error("ward-tokens.module.css: an @media with no opening brace");
    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) throw new Error("ward-tokens.module.css: an @media block never closes");
    blocks.push(css.slice(at, j + 1));
    i = j + 1;
  }
  return { base, blocks };
}

describe("the Ward Flow token layer", () => {
  it("declares every required token exactly once in its base block", () => {
    const { base } = splitOnMediaBlocks(TOKENS);
    // Anti-vacuity: a strip that removed too much would make every count 0, and
    // "declared 0 times" reads as a missing token rather than as a broken strip.
    expect(base.length, "the media-block strip removed nearly everything").toBeGreaterThan(1000);
    expect(base, "the strip left an @media block behind").not.toContain("@media");
    // A sentinel, on Ward Verifier's suggestion: `--ward-tap` is declared in the
    // base block only, and near the END of it. A strip that swallowed forward
    // from a stray brace would lose it while leaving enough text to clear the
    // length floor above — so the floor alone does not cover that direction.
    expect(base, "--ward-tap is base-only and near the end; the strip swallowed forward").toContain("--ward-tap:");
    for (const token of REQUIRED) {
      const declarations = base.split(`${token}:`).length - 1;
      expect(declarations, `${token} declared ${declarations} times in ward-tokens.module.css's base block`).toBe(1);
    }
  });

  it("counts every required token on the media side too, one block at a time", () => {
    /*
     * 🔴 THIS TEST REPLACES ONE THAT NAMED TWO OF THE EIGHT TOKENS, AND WARD
     * VERIFIER BROKE IT ON 2026-09-05 WITH TWO MUTANTS THE OLD VERSION PASSED:
     *   M3 — a duplicate `--ward-text` INSIDE the forced-colours block
     *   M6 — a duplicate `--ward-muted` in a SECOND media block
     * Both stayed GREEN. Test 1 counts the base block only, and the media-side
     * count named `--ward-border` and `--ward-divider` and nothing else, so a
     * duplicate declared inside ANY media block was invisible for the other six.
     *
     * ⚠️ AND THE REFRAME MATTERS MORE THAN THE FIX. I had been hunting a failure
     * of the strip, and added two anti-vacuity assertions aimed at "did it remove
     * too much, or too little". The strip was never the problem: it works, and the
     * media half was then simply not counted. **A third anti-vacuity assertion
     * would not have caught this — the gap was COVERAGE, not vacuity.**
     *
     * ⚠️ COUNTED PER BLOCK, NEVER OVER THE CONCATENATION. A token legitimately
     * re-pointed in BOTH a dark-theme block and a forced-colours block would total
     * 2 across all blocks and go falsely red — which is a defect waiting for the
     * day a second override lands, i.e. it would fire on correct work exactly the
     * way the original whole-file count did.
     */
    const { base, blocks } = splitOnMediaBlocks(TOKENS);
    expect(blocks.length, "the token layer declares no @media block at all").toBeGreaterThan(0);
    const forced = blocks.filter((block) => block.includes("(forced-colors: active)"));
    expect(forced.length, "expected exactly one forced-colours block").toBe(1);

    for (const token of REQUIRED) {
      expect(base.split(`${token}:`).length - 1, `${token} in the base block`).toBe(1);
      for (const [index, block] of blocks.entries()) {
        const count = block.split(`${token}:`).length - 1;
        const condition = block.slice(0, block.indexOf("{")).trim();
        expect(
          count,
          `${token} declared ${count} times inside media block ${index + 1} (${condition})`,
        ).toBeLessThanOrEqual(1);
      }
    }

    // The two the layer actually re-points, asserted POSITIVELY so the tolerance
    // is exercised rather than merely available: a strip that returned empty
    // blocks would satisfy every `toBeLessThanOrEqual(1)` above.
    for (const token of ["--ward-border", "--ward-divider"]) {
      expect(forced[0].split(`${token}:`).length - 1, `${token} re-pointed under forced colours`).toBe(1);
      // And the raw file therefore carries two — the exact count the original
      // guard called a defect. This is the regression pin: it states the thing
      // that used to fail, and asserts it is legitimate.
      expect(TOKENS.split(`${token}:`).length - 1, `${token} across the whole file`).toBe(2);
    }
  });

  it("keeps a panel distinguishable from the ground — by its EDGE, not by the two tokens differing", () => {
    /*
     * 🔴 **RE-DERIVED 2026-09-05. THIS ASSERTION WATCHED DISTINCTNESS AND THE PROPERTY THAT MATTERS
     * IS VISIBILITY — WHICH IS THE EXACT LESSON THE NEXT TEST IN THIS FILE ALREADY RECORDS ABOUT
     * `--ward-divider`, TWENTY LINES BELOW.**
     *
     * It asserted `--ward-ground !== --ward-canvas`, reasoning that if they resolved to the same
     * thing "the design collapses to white-on-white and nothing fails visually". The owner then
     * asked for a white ground — three times, and the third time by pointing at it; PsychSift
     * SPEC §4.3, *"true-white page, cards and panels"* — and both now resolve to `var(--surface)`,
     * so this went red on a deliberate decision.
     *
     * ⚠️ **AND ITS PREMISE WAS MEASURABLY FALSE BEFORE THE CHANGE.** The tint it was protecting was
     * `--surface-inset` against a white panel: **1.08:1**. Invisible as a boundary. The separation
     * was NEVER coming from the two tokens differing — it came from the panel's own border, then
     * and now:
     *
     *     --ward-border on the light ground             4.88:1
     *     --ward-border on the dark ground              4.98:1
     *     the retired tint against a white panel        1.08:1
     *
     * So a guard that had gone green for months was watching a property that did nothing, while
     * the property that actually held the design up was unwatched. **Distinctness passes on an
     * invisible difference; visibility does not** — and this file says so, in as many words, about
     * a sibling token, immediately below.
     *
     * **WHAT IS ASSERTED NOW: the panel primitive carries an EDGE.** That is the thing whose loss
     * would actually collapse the design, it is checkable from source, and it is indifferent to
     * whether the two surface tokens happen to be the same alias — which is now a decision the
     * owner has made and this guard has no business re-litigating.
     */

    /*
     * 🔴 **TWO CHATS RE-DERIVED THIS ASSERTION INDEPENDENTLY ON THE SAME DAY, AND THE OTHER ONE
     * MADE THE EDGE CHECK CONDITIONAL. THAT FORM IS RECORDED HERE BECAUSE IT MUST NOT COME BACK.**
     *
     * Ward Builder Three reached the same conclusion from the same spec — its wording for the
     * property is the better one, and is borrowed above: *what must never be true is NEITHER.* But
     * it expressed the property as
     *
     *     if (ground === canvas) { ...require border and shadow... }
     *
     * which is disarmed by the very thing the original guard was afraid of. **Re-introduce any
     * tint at all — including one measuring 1.08:1, i.e. invisible — and `ground !== canvas`, the
     * branch is skipped, and the panel may then lose both its border and its shadow with nothing
     * failing.** The conditional turns an invisible difference into a licence to drop the visible
     * one, which is precisely the distinctness-not-visibility error the re-derivation exists to
     * escape. So the edge is required UNCONDITIONALLY, whatever the two tokens resolve to.
     */
    const ground = /--ward-ground:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    expect(ground, "--ward-ground is no longer declared in the token layer").toBeTruthy();

    const panel = readFileSync(join(WARD_DIR, "ward-panel.module.css"), "utf8");

    /*
     * Anti-vacuity first: the file must actually be the panel primitive, or every check below is
     * satisfied by an empty string.
     */
    expect(panel.length, "ward-panel.module.css is too short to be the real primitive").toBeGreaterThan(400);

    /*
     * ⚠️ LOCATED BY PATTERN, NOT BY THE LITERAL `".panel {"` — Ward Builder Three's second
     * improvement, and worth keeping for the same reason the rest of this estate was reworked this
     * week. The literal fails on `.panel{`, which is a reformat rather than a defect, and a guard
     * that goes red on formatting is a guard someone eventually deletes along with the honest ones.
     */
    const panelStart = panel.search(/\.panel\s*\{/u);
    expect(panelStart, "the panel primitive no longer declares a .panel class").toBeGreaterThanOrEqual(0);
    const panelBlock = panel.slice(panelStart, panel.indexOf("}", panelStart));

    /*
     * BOTH, AND MY FIRST ATTEMPT AT THIS DEMANDED THE WRONG ONE. I asserted `--ward-border` on the
     * panel, from my own 4.88:1 measurement — which was taken BEFORE the panel moved to SPEC §4.7's
     * "in-flow cards use border + shadow". A measurement is scoped to what it measured, and mine had
     * been overtaken by a change I folded myself an hour earlier.
     *
     * The panel now carries `--border` for the edge and `--e1` for the lift, and the primitive's own
     * comment is emphatic that NEITHER ALONE WOULD DO IT: `--border` against a ward surface measures
     * 1.11-1.20:1 -- "NOT A FAINT LINE, IT IS NO LINE". So the property is the PAIR. Demanding only
     * a border would pass on an invisible edge with the shadow deleted, which is the same
     * distinctness-not-visibility error this assertion was just re-derived to escape.
     */
    /*
     * ANCHORED TO THE START OF A DECLARATION. A bare /border:/ also matches `-border:` inside any
     * hyphenated property name — my own mutation renamed `border:` to `MUTANTX-border:` and the
     * loose pattern still matched, so the border arm reported a pass on a panel with no border
     * declaration at all. A guard defeated by a prefix.
     */
    expect(panelBlock, "the panel primitive no longer draws any border").toMatch(/(?:^|[;{\n])\s*border:/u);
    expect(
      panelBlock,
      "the panel primitive no longer carries a shadow. With the ground and the panel surface now the " +
        "same alias by the owner's decision, and the edge itself measuring 1.11-1.20:1 against a ward " +
        "surface, the LIFT is half of what separates a panel from the page. Losing either collapses it " +
        "to a white block on a white page, and nothing fails visually.",
    ).toMatch(/box-shadow:/u);
  });

  /**
   * ⚠️ THIS ASSERTION USED TO BE `divider !== border`, AND IT PASSED ON AN INVISIBLE LINE.
   * That is the whole story of this token: the property being watched was distinctness, and the
   * property that mattered was visibility, so `--ward-divider: var(--border)` — 1.11:1 — sailed
   * through. The line weight it protected was never the risk.
   *
   * The two-weight idea is now abandoned (see the token file for why the dark ramp killed it), so
   * asserting divider ≠ border would be asserting a decision we deliberately reversed. What holds
   * instead is the distinction that survives in both themes.
   */
  it("keeps a strong border weight distinct from the ordinary one", () => {
    const border = /--ward-border:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    const strong = /--ward-border-strong:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    expect(border).toBeTruthy();
    expect(strong).toBeTruthy();
    expect(strong).not.toBe(border);
  });

  /**
   * ⚠️ "DISTINCT FROM THE BORDER" WAS THE ONLY THING ASSERTED, AND IT PASSED ON AN INVISIBLE LINE.
   * `--ward-divider` was `var(--border)`: measured 2026-09-04 at 1.11:1 on the ground and 1.20:1
   * on canvas — not a faint rule, no rule at all. And `--border` is the very token that had been
   * replaced across 27 ward stylesheets the previous day for being invisible, so it returned
   * through a test that was watching the wrong property.
   *
   * The floor is 2:1 — the weakest claim that still means "a reader can see it". 4.5:1 is a TEXT
   * floor and a hairline is not text; 3:1 is WCAG 1.4.11 for a UI component, which is the right
   * target and which the current value now clears in light.
   *
   * ⚠️ AND THE FIRST REPAIR FAILED THIS FLOOR IN THE THEME IT DID NOT LOOK AT. `--neutral-400`
   * measured 2.40–2.58 in light and 1.65–2.00 in dark. The guard used `.exec()`, which returns
   * the first match — always the light declaration — so it certified a value that broke its own
   * rule on three of four dark surfaces. It now measures both themes and counts the pairs, because
   * a loop that silently found no dark values would have looked exactly like a pass.
   *
   * The two-weight idea was abandoned rather than defended: the dark ramp has nothing between an
   * invisible rule and the border weight. See the token file.
   */
  it("makes the divider actually visible on every surface it can sit on", () => {
    const V2 = readFileSync("src/app/ckb-v2-tokens.css", "utf8");
    const GLOBALS = readFileSync("src/app/globals.css", "utf8");

    let measuredPairs = 0;

    /**
     * ⚠️ `themeIndex` 0 IS LIGHT AND 1 IS DARK, AND THIS PARAMETER IS THE ENTIRE POINT.
     * The first version used `.exec()`, which returns the FIRST match — always the light
     * declaration. It measured one theme, reported green, and certified a divider that failed
     * its own 2:1 floor on three of four dark surfaces. Both themes, or the guard is decorative.
     *
     * Declaration order in these files is light first, dark second. If that ever stops being
     * true the anti-vacuity count below is what notices, not this comment.
     */
    function resolve(token: string, themeIndex: number): string {
      const aliasMatch = new RegExp(String.raw`${token}:\s*var\((--[\w-]+)\)`, "u").exec(TOKENS);
      expect(aliasMatch?.[1], `${token} must alias a PsychSift token`).toBeTruthy();
      const alias = aliasMatch?.[1] as string;
      const pattern = new RegExp(String.raw`${alias}:\s*(#[0-9a-fA-F]{3,8})`, "gu");
      const source = pattern.test(V2) ? V2 : GLOBALS;
      const found = [...source.matchAll(new RegExp(pattern.source, "gu"))].map((m) => m[1]);
      expect(found.length, `${alias} has no declaration in either token file`).toBeGreaterThan(0);
      expect(
        found.length,
        `${alias} has only ${found.length} declaration(s) — no ${themeIndex === 0 ? "light" : "dark"} value to measure`,
      ).toBeGreaterThan(themeIndex);
      return found[themeIndex];
    }

    function luminance(hex: string): number {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function ratio(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    const failures: string[] = [];
    for (const [themeIndex, theme] of ["light", "dark"].entries()) {
      const divider = resolve("--ward-divider", themeIndex);
      for (const surface of ["--ward-ground", "--ward-canvas", "--ward-chrome", "--ward-subtle"]) {
        const r = ratio(divider, resolve(surface, themeIndex));
        measuredPairs += 1;
        if (r < 2) failures.push(`${theme}: --ward-divider on ${surface} is ${r.toFixed(2)}:1`);
      }
    }
    // Anti-vacuity: eight pairs, or the loop found no dark declarations and measured half the app.
    expect(measuredPairs, "fewer than eight pairs measured — a theme was silently skipped").toBe(8);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("declares no raw hex — every value resolves through a PsychSift token", () => {
    const hex = TOKENS.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [];
    expect(hex, `raw hex in the token layer: ${hex.join(" ")}`).toEqual([]);
  });

  /**
   * ⚠️ INTRODUCING --ward-ground REVALIDATES EVERY TEXT COLOUR IN THE LAYER. Contrast is a
   * property of a pair, so a text token that passed on white has NO measured ratio on a surface
   * that did not exist until this task. Measured on the mockup palette 2026-09-04: the quiet text
   * value passed 4.63:1 on white and failed at 4.04:1 on the ground — the surface it sits on.
   *
   * This resolves each --ward-* alias to its PsychSift value and computes every text/surface pair.
   * It does not sample rendered pixels and it does not trust a documented ratio.
   *
   * ⚠️ ADAPTED FROM THE PLAN AS WRITTEN, for two reasons found while implementing this task:
   *
   * 1. The plan's `resolve()` built its regexes from a template literal containing raw `\s`,
   *    `\w`, `\(` and `\)`. Outside a regex *literal*, those are ordinary template-literal
   *    escapes: JS drops the backslash on any escape it doesn't recognise, so
   *    `` `${token}:\s*var\((--[\w-]+)\)` `` is actually the STRING `--ward-x:s*var((--[w-]+))`
   *    before it ever reaches `new RegExp`. That pattern cannot match real CSS — verified directly
   *    in Node — so every call to resolve() would throw "must alias a PsychSift token" and the
   *    test would never reach the contrast maths at all. Fixed by doubling the backslashes
   *    (`\\s`, `\\(`, `\\w`, `\\)`) so the intended regex actually reaches `new RegExp`.
   * 2. The plan's SURFACES list named `--ward-panel` and `--ward-sunken`, but the token file this
   *    task produces (and the plan's own "Surfaces." comment inside it) never declares those two
   *    names — it declares `--ward-ground`, `--ward-canvas`, `--ward-chrome` and `--ward-subtle`.
   *    Replaced the two non-existent names with the two the token file actually groups under
   *    "Surfaces": `--ward-chrome` and `--ward-subtle`.
   */
  it("clears 4.5:1 for every text token against every surface token", () => {
    const V2 = readFileSync("src/app/ckb-v2-tokens.css", "utf8");

    /** --ward-x: var(--y) -> the hex that --y is declared as, following one level of aliasing. */
    function resolve(token: string): string {
      // String.raw is required here: an ordinary template literal drops the backslash on any
      // escape it does not recognise (\s, \w, \(, \) among them), so `${token}:\s*var\(...\)`
      // would actually build the string `--ward-x:s*var((...))`, which cannot match real CSS —
      // verified directly in Node while implementing this task.
      const alias = new RegExp(String.raw`${token}:\s*var\((--[\w-]+)\)`, "u").exec(TOKENS)?.[1];
      expect(alias, `${token} must alias a PsychSift token, not carry a literal`).toBeTruthy();
      const hex = new RegExp(String.raw`${alias}:\s*(#[0-9a-fA-F]{3,8})`, "u").exec(V2)?.[1];
      expect(hex, `${alias} is not declared as a hex in ckb-v2-tokens.css`).toBeTruthy();
      return hex as string;
    }

    function luminance(hex: string): number {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function ratio(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    const TEXT = ["--ward-text", "--ward-muted"];
    const SURFACES = ["--ward-ground", "--ward-canvas", "--ward-chrome", "--ward-subtle"];
    const failures: string[] = [];
    for (const text of TEXT) {
      for (const surface of SURFACES) {
        const r = ratio(resolve(text), resolve(surface));
        // Deliberate: the report needs the real numbers, not a rounded retyping.
        console.log(`${text} on ${surface}: ${r.toFixed(2)}:1`);
        if (r < 4.5) failures.push(`${text} on ${surface}: ${r.toFixed(2)}:1`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  /**
   * `ward-sidebar.module.css` keeps its own local declaration of `--ward-leading-tight` and
   * `--ward-leading-body` (self-contained-tokens convention, and `.drawerBody` renders through a
   * portal outside the shell's DOM subtree, so it cannot inherit from an ancestor) — it was
   * originally forked to 1.2/1.5 against canonical's 1.15/1.4. Deleting the declaration was not
   * an option, so the fix is that the local value must always equal canonical's. This is the
   * single-declaration/single-value guard: it fails, naming the offending file, the moment any
   * Ward Flow stylesheet declares either token with a value that disagrees with
   * ward-tokens.module.css — including a re-introduced local fork in the sidebar.
   */
  it("keeps --ward-leading-tight and --ward-leading-body at one value everywhere they are declared", () => {
    const canonical: Record<string, string> = {};
    for (const name of ["--ward-leading-tight", "--ward-leading-body"]) {
      const value = new RegExp(String.raw`${name}:\s*([^;]+);`, "u").exec(TOKENS)?.[1]?.trim();
      expect(value, `${name} not found in ward-tokens.module.css`).toBeTruthy();
      canonical[name] = value as string;
    }

    const mismatches: string[] = [];
    for (const file of wardStylesheets()) {
      const css = withoutComments(readFileSync(file, "utf8"));
      for (const [name, canonicalValue] of Object.entries(canonical)) {
        const re = new RegExp(String.raw`${name}:\s*([^;]+);`, "gu");
        let match: RegExpExecArray | null;
        while ((match = re.exec(css)) !== null) {
          const value = match[1].trim();
          if (value !== canonicalValue) {
            mismatches.push(`${file}: ${name}: ${value} (canonical: ${canonicalValue})`);
          }
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  /**
   * The convention that forked the leadings applies to the spacing ladder too, and the guard above
   * cannot see it: it is hard-coded to two token names, so it answers the question the leading
   * incident asked rather than the one the mechanism poses. `ward-sidebar.module.css` hand-copies
   * seven `--ward-space-*` steps, for the reason documented there — `.drawerBody` renders through a
   * portal, outside the shell's DOM subtree, so it cannot inherit canonical tokens from an ancestor.
   * They agree with canonical today. Nothing made them keep agreeing, and the leadings prove this
   * family drifts when nothing does.
   *
   * Parity rather than deletion, exactly like the leadings — the local declaration has to stay.
   *
   * ⚠️ Scoped to the spacing family ON PURPOSE. `--ward-border`, `--ward-border-strong`,
   * `--ward-divider`, `--ward-canvas` and `--ward-table-min-width` are legitimately overridden per
   * module (a board sets its own min-width; forced-colors sets `Canvas`), and a blanket "no local
   * `--ward-*` may differ from canonical" rule goes red on more than forty deliberate declarations.
   * The first draft of this guard was exactly that blanket rule and was discarded for it. The scale
   * is the one family with no legitimate per-module variant, because a second spacing scale is the
   * thing the ladder exists to prevent.
   *
   * The floor is on the redeclarations WALKED, not on the mismatches found: a guard that quietly
   * stopped reaching the sidebar's copy would otherwise pass by looking at nothing at all.
   */
  it("keeps every --ward-space-* step at one value everywhere it is declared", () => {
    const canonical: Record<string, string> = {};
    for (const match of withoutComments(TOKENS).matchAll(/(--ward-space-\d+):\s*([^;]+);/gu)) {
      canonical[match[1]] ??= match[2].trim();
    }
    expect(
      Object.keys(canonical).length,
      "ward-tokens.module.css declares almost no --ward-space-* steps — the canonical side is wrong, not the callers",
    ).toBeGreaterThan(7);

    let walked = 0;
    const mismatches: string[] = [];
    for (const file of wardStylesheets()) {
      if (file.endsWith("ward-tokens.module.css")) continue;
      const css = withoutComments(readFileSync(file, "utf8"));
      for (const [name, canonicalValue] of Object.entries(canonical)) {
        for (const match of css.matchAll(new RegExp(String.raw`${name}:\s*([^;]+);`, "gu"))) {
          walked += 1;
          const value = match[1].trim();
          if (value !== canonicalValue) {
            mismatches.push(`${file}: ${name}: ${value} (canonical: ${canonicalValue})`);
          }
        }
      }
    }

    expect(
      walked,
      "no ward stylesheet redeclares a --ward-space-* step any more — this guard now proves nothing and must be re-aimed or removed, not left green",
    ).toBeGreaterThan(0);
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  /**
   * `.phoneBar` (ward-sidebar.module.css) is `position: fixed` and must sit ABOVE the sticky
   * sub-headers that tuck underneath it (`.workspaceHeader` in ward-management.module.css,
   * `.modeHeader` in ward-management-modes.module.css) — that layering is deliberate, which is
   * why there are two z-index tokens rather than one shared value. Asserting the ORDERING
   * relationship, not the two literal numbers, means a future renumber that keeps the bar above
   * the header still passes, while one that inverts them — collapsing the two layers back to
   * equal, letting paint order (the sticky header, later in the DOM) decide, and cover the fixed
   * bar it is supposed to sit beneath — fails here.
   */
  it("keeps the fixed phone bar above the sticky phone sub-headers it sits over", () => {
    const bar = Number(/--ward-z-phone-bar:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim());
    const header = Number(/--ward-z-phone-header:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim());
    expect(Number.isNaN(bar), "--ward-z-phone-bar not found or not numeric").toBe(false);
    expect(Number.isNaN(header), "--ward-z-phone-header not found or not numeric").toBe(false);
    expect(bar, `--ward-z-phone-bar (${bar}) must outrank --ward-z-phone-header (${header})`).toBeGreaterThan(header);
  });

  /**
   * The single-name `--ward-z-phone` token was consolidated into two named layers
   * (`--ward-z-phone-bar`, `--ward-z-phone-header`). Nothing may bring the old single name back
   * as a declaration — that is exactly how the fork this task fixed re-appears silently. Matching
   * `--ward-z-phone` with a colon directly after (allowing only whitespace between) catches a
   * declaration of the old name without also matching `--ward-z-phone-bar:` or
   * `--ward-z-phone-header:`, both of which have a hyphenated suffix before their colon.
   */
  it("declares no Ward Flow stylesheet with the old single --ward-z-phone name", () => {
    const offenders: string[] = [];
    for (const file of wardStylesheets()) {
      const css = withoutComments(readFileSync(file, "utf8"));
      if (/--ward-z-phone\s*:/u.test(css)) offenders.push(file);
    }
    expect(offenders, `--ward-z-phone still declared in: ${offenders.join(", ")}`).toEqual([]);
  });
});
