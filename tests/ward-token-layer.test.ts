// tests/ward-token-layer.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS = readFileSync("src/components/ward-management/ward-tokens.module.css", "utf8");

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

describe("the Ward Flow token layer", () => {
  it("declares every required token exactly once, in one file", () => {
    for (const token of REQUIRED) {
      const declarations = TOKENS.split(`${token}:`).length - 1;
      expect(declarations, `${token} declared ${declarations} times in ward-tokens.module.css`).toBe(1);
    }
  });

  it("adds a ground distinct from the panel surface, because Board floats panels on it", () => {
    // The whole direction depends on panel and ground being different. If --ward-ground
    // resolves to the same thing as --ward-canvas the design collapses to white-on-white
    // and nothing fails visually — so it is asserted here instead.
    const ground = /--ward-ground:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    const canvas = /--ward-canvas:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    expect(ground).toBeTruthy();
    expect(ground).not.toBe(canvas);
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
      const css = readFileSync(file, "utf8");
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
      const css = readFileSync(file, "utf8");
      if (/--ward-z-phone\s*:/u.test(css)) offenders.push(file);
    }
    expect(offenders, `--ward-z-phone still declared in: ${offenders.join(", ")}`).toEqual([]);
  });
});
