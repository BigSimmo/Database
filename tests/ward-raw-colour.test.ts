import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THE WARD STYLESHEETS HAVE NO COLOUR DETECTOR, AND THAT IS WHY THIS EXISTS.**
 * `eslint-rules/no-hardcoded-hex.mjs` matches Tailwind class names in `.ts`/`.tsx` only, so a raw
 * `#1b2533` in a ward CSS module is reported by nothing at all. The `--ward-*` layer in
 * `ward-tokens.module.css` bridges onto the repository design system (`--ward-ground: var(--surface)`,
 * `--ward-border: var(--neutral-500)`, and so on), and a stylesheet that paints its own colour
 * silently leaves that bridge — which is how a set of screens drifts apart while every gate is green.
 *
 * ⚠️ **THE ESTATE IS CLEAN TODAY, AND THAT IS THE POINT OF INSTALLING THIS NOW.** Measured
 * 2026-09-06 across all 51 ward stylesheets: **zero** raw colour in declarations. Every hex and
 * every `rgb()` in the tree is inside a COMMENT, recording a measured contrast ratio or a computed
 * value from the print and forced-colours work. So this guard protects a clean surface rather than
 * cleaning a dirty one, and its floor is on the POPULATION WALKED for exactly that reason — see
 * the anti-vacuity test below.
 *
 * ⚠️⚠️ **DO NOT "FIX" A FAILURE HERE BY EDITING A COMMENT.** The hex values in these files are
 * evidence. `ward-table.module.css` records `--surface-subtle (#fbfcfd) vs --text-muted (#55627a):
 * 5.99:1`; deleting those numbers destroys the proof that the table meets contrast and leaves a
 * claim nobody can re-check. This guard never reads comments, so it can never ask you to.
 *
 * ## What this guard SEES, and what it does NOT
 *
 * It reads CSS **text**, with comments stripped. That is the artefact you search, not the artefact
 * that runs, and the difference has produced clean wrong answers in this repository before. So,
 * explicitly:
 *
 * - **SEES** a literal hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` written in a declaration in any
 *   ward stylesheet, including one added tomorrow — the population is discovered from disk.
 * - **DOES NOT SEE** a colour reaching a ward screen through an inline `style={{...}}` in TSX, a
 *   `composes:` target in another stylesheet, a colour injected at build time, or a token whose own
 *   definition elsewhere is a raw value. **A pass here is not a statement that ward screens use only
 *   design-system colour** — it is the narrower claim that no ward stylesheet declares one itself.
 * - **DOES NOT SEE** whether the token chosen is the RIGHT one. `var(--ward-border)` where
 *   `var(--ward-border-strong)` was meant passes here and always will. Consistency of choice is a
 *   design question and this is a mechanical guard.
 *
 * Being a `readFileSync` scanner, it is also invisible to `npm run test:focused` — vitest selects by
 * import graph and this file imports no source. It runs in the full suite.
 */

const ROOT = process.cwd();
const WARD_STYLES_DIR = path.join(ROOT, "src", "components", "ward-management");

/**
 * CSS has only block comments. Strip them PRESERVING NEWLINES, so reported line numbers stay true
 * and a colour mentioned in prose cannot be mistaken for a declaration.
 *
 * This is the whole correctness of the guard. Ward Lead's first survey of this estate reported 24
 * offending files; comment-stripped it is 0, and the 24 were measurement records.
 *
 * A second detector additionally matched `#2384` in `ward-management-modes.module.css` — a
 * pull-request number, which is a legal `#RGBA`. ⚠️ **That was not an independent confirmation and
 * should not be read as one: it was found by the author of that detector, reported against their
 * own count** (Ward Builder One, 2026-09-06). One person auditing their own number is a different
 * claim from two converging, and the weaker-sounding one is the harder direction to check in.
 *
 * Either way the lesson holds: the stripping is doing work no amount of pattern refinement can do.
 */
export function stripCssComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    out += source[i];
    i++;
  }
  return out;
}

function wardStylesheets(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...wardStylesheets(full));
    else if (entry.name.endsWith(".css")) found.push(full);
  }
  return found;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOUR_FUNCTION = /\b(rgba?|hsla?)\(([^)]*)\)/g;
/** `url(#gradient)` is an SVG fragment reference, and `#id` in selector position is a selector. */
const URL_FRAGMENT = /url\(\s*#[^)]*\)/g;
const ID_SELECTOR = /(^|[\s,>+~])#[-_a-zA-Z][-_a-zA-Z0-9]*(?=[\s,{:.[])/g;

/**
 * The token to reach for, chosen from the CSS property the raw value was written against. Naming
 * the fix is the difference between a guard somebody satisfies and one somebody deletes.
 */
function suggestedToken(line: string): string {
  const property = /(^|[;{])\s*([-a-zA-Z]+)\s*:/.exec(line)?.[2]?.toLowerCase() ?? "";
  if (property.includes("background")) return "--ward-canvas / --ward-subtle / --ward-raised";
  if (property.includes("border") || property.includes("outline")) return "--ward-border / --ward-border-strong";
  if (property.includes("shadow")) return "--ward-shadow, or rgb(var(--ward-shadow-rgb) / <alpha>)";
  if (property === "color" || property.endsWith("-color")) return "--ward-text / --ward-text-muted";
  return "a --ward-* token from ward-tokens.module.css";
}

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly found: string;
  readonly suggestion: string;
}

function rawColourIn(file: string): Finding[] {
  const code = stripCssComments(fs.readFileSync(file, "utf8"));
  const findings: Finding[] = [];
  code.split("\n").forEach((rawLine, index) => {
    // Blank the two constructs that legally carry a `#` before looking for colour, so the guard
    // cannot go red on an SVG reference or an id selector somebody adds later.
    const line = rawLine.replace(URL_FRAGMENT, "url()").replace(ID_SELECTOR, "$1.idSelector");
    for (const match of line.matchAll(HEX)) {
      findings.push({
        file,
        line: index + 1,
        found: match[0],
        suggestion: suggestedToken(line),
      });
    }
    for (const match of line.matchAll(COLOUR_FUNCTION)) {
      // `rgb(var(--ward-shadow-rgb) / 0.2)` is token-derived: the channels come from the layer.
      // Raw channels do not, and are the defect however small the alpha.
      if (/var\(/.test(match[2])) continue;
      findings.push({
        file,
        line: index + 1,
        found: match[0].replace(/\s+/gu, " "),
        suggestion: suggestedToken(line),
      });
    }
  });
  return findings;
}

const stylesheets = wardStylesheets(WARD_STYLES_DIR);
const findings = stylesheets.flatMap((file) => rawColourIn(file));

describe("ward stylesheets declare colour through the --ward-* layer, never raw", () => {
  it("walks a healthy population of ward stylesheets (anti-vacuity floor)", () => {
    /*
     * ⚠️ **THE FLOOR IS ON THE POPULATION WALKED, NEVER ON THE VIOLATION COUNT.** A floor on
     * findings would sit at zero and could never fail — and if it were written as "no more than N
     * violations" it would go red the day somebody finishes the cleanup, which trains the next
     * person to delete the guard. Same pattern and same reason as
     * `tests/ward-mode-workspace-reachability.test.ts`.
     *
     * 51 stylesheets on 2026-09-06. The floor sits below that with room for a directory to be
     * reorganised, and high enough that a broken walk — wrong root, wrong extension — fails loudly
     * naming the count it actually found, rather than reporting a clean estate it never read.
     */
    expect(
      stylesheets.length,
      `only ${stylesheets.length} ward stylesheets were found under ${path.relative(ROOT, WARD_STYLES_DIR)}. ` +
        "That is far fewer than the 51 measured on 2026-09-06, so the walk is broken rather than the " +
        "estate being small — a scanner that reads nothing reports everything as clean.",
    ).toBeGreaterThan(40);
  });

  it("finds the colour syntax it is looking for, in a fixture it controls (positive control)", () => {
    /*
     * 🔴 **WITHOUT THIS THE GUARD IS DECORATION.** The estate is clean, so the real assertion below
     * passes on an empty list — which is indistinguishable from a detector that matches nothing at
     * all. Ward Builder Three shipped a phone-swap guard that coincided with every file on disk;
     * this is the arm that would have caught it.
     *
     * Every case here is checked in BOTH directions: the raw forms must be found, and the
     * legitimate forms must not, so widening the exemptions cannot quietly disarm the detector.
     */
    const fixture = [
      "/* a comment naming #abcdef and rgb(1, 2, 3) and PR #2384 */",
      ".rawHex { color: #1b2533; }",
      ".rawRgb { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }",
      ".rawHsl { background: hsl(210, 40%, 96%); }",
      ".tokenised { background: var(--ward-subtle); }",
      ".tokenAlpha { box-shadow: 0 1px 2px rgb(var(--ward-shadow-rgb) / 0.2); }",
      ".systemKeyword { border-color: CanvasText; }",
      ".transparentIsNotAColour { background: transparent; }",
      ".inherits { color: currentColor; }",
      ".svgRef { fill: url(#wardGradient); }",
      "#dabbed { color: var(--ward-text); }",
    ].join("\n");

    const tmp = path.join(ROOT, "tests", ".ward-raw-colour-fixture.css");
    fs.writeFileSync(tmp, fixture);
    let hits: Finding[];
    try {
      hits = rawColourIn(tmp);
    } finally {
      fs.unlinkSync(tmp);
    }

    const found = hits.map((h) => h.found).sort();
    expect(
      found,
      "the detector did not find exactly the three raw declarations in its own fixture, so a clean " +
        "estate below proves nothing. Anything extra here is a false positive that will fire on " +
        "correct work; anything missing is a hole.",
    ).toEqual(["#1b2533", "hsl(210, 40%, 96%)", "rgba(0, 0, 0, 0.2)"]);

    // And the fix is named, not merely the offence.
    const shadow = hits.find((h) => h.found.startsWith("rgba"));
    expect(shadow?.suggestion, "the shadow finding does not name a token to use instead").toContain("--ward-shadow");
  });

  it("declares no colour outside the --ward-* layer", () => {
    const report = findings
      .map(
        (f) =>
          `  ${path.relative(ROOT, f.file).replace(/\\/gu, "/")}:${f.line}  ${f.found}` + `\n      use ${f.suggestion}`,
      )
      .join("\n");

    expect(
      findings,
      `ward stylesheets declare colour directly instead of through the --ward-* layer:\n${report}\n\n` +
        "The --ward-* tokens in ward-tokens.module.css map onto the repository design system, so a raw " +
        "value here leaves that bridge and drifts on its own. Replace it with the token named above.\n" +
        "⚠️ If this fired on a COMMENT, the guard is broken and the comment is right — the hex values " +
        "in these files are recorded contrast measurements and must not be edited to satisfy a test.",
    ).toEqual([]);
  });
});
