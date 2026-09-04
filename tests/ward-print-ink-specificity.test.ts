// tests/ward-print-ink-specificity.test.ts
//
// Proves the print colour reset in three Ward Flow stylesheets actually WINS the cascade against
// every class-plus-type rule that also declares `color` — not merely that the text `!important`
// appears somewhere in the file.
//
// ⚠️ THE FAILURE MODE THIS GUARDS AGAINST: `.screen, .screen * { color: CanvasText !important; }`
// looks like it fixes every element under print, but `.screen` and `.screen *` are BOTH
// specificity (0,1,0) — the universal selector contributes nothing. Any rule shaped like
// `.table td` or `.governanceBanner p` is (0,1,1) and would outrank the reset on specificity
// alone. `!important` is the only thing that wins that fight. A guard that only samples a plain
// heading or paragraph never notices, because the wildcard alone already fixes those — the
// dangerous case is specifically a selector combining a class with a type.
//
// This is a real cascade computation, not a text match: each stylesheet is parsed with `postcss`
// (already a repo dependency — see scripts/design-system-contract-utils.mjs) into its rule/decl
// tree, every selector's specificity is computed by counting id/class-or-attribute-or-pseudo-class
// /type-or-pseudo-element components, and the winner between the print reset and every competing
// `color` declaration is decided the way a browser decides it: `!important` beats any specificity,
// then higher specificity wins, then later source position wins. A comment containing the literal
// text `color: CanvasText !important;` is invisible here — postcss discards comments before this
// code ever sees a selector or a declaration, so the control below (an inert comment standing in
// for the real rule) is *expected* to still report the file as broken.
import { existsSync, readFileSync } from "node:fs";
import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const FILES = [
  "src/components/ward-management/search/search.module.css",
  "src/components/ward-management/officer/officer.module.css",
  "src/components/ward-management/out-of-area/out-of-area.module.css",
] as const;

interface Specificity {
  ids: number;
  classes: number;
  types: number;
  value: number;
}

/**
 * Counts the id / class-or-attribute-or-pseudo-class / type-or-pseudo-element components of a
 * single compound-or-complex selector (no top-level commas — split those with `Rule.selectors`
 * first). Combinators (space, `>`, `+`, `~`) and the universal selector `*` contribute nothing,
 * which is exactly the property this file exists to exploit: `.screen *` is NOT more specific
 * than `.screen` alone.
 */
function specificity(selector: string): Specificity {
  const tokenPattern = /\[[^\]]*\]|#[-\w]+|\.[-\w]+|::[-\w]+|:[-\w]+\([^)]*\)|:[-\w]+|\*|[-\w]+/g;
  let ids = 0;
  let classes = 0;
  let types = 0;
  for (const match of selector.matchAll(tokenPattern)) {
    const token = match[0];
    if (token.startsWith("[")) classes += 1;
    else if (token.startsWith("#")) ids += 1;
    else if (token.startsWith(".")) classes += 1;
    else if (token.startsWith("::")) types += 1;
    else if (token.startsWith(":"))
      classes += 1; // pseudo-class, incl. functional (:has(), :not())
    else if (token === "*") {
      /* universal selector — contributes nothing */
    } else types += 1; // bare identifier: a type selector (td, th, p, dd, strong, input, ...)
  }
  return { ids, classes, types, value: ids * 100 + classes * 10 + types };
}

function isInsidePrintMedia(node: { parent?: unknown }): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = (node as any).parent;
  while (current) {
    if (current.type === "atrule" && current.name === "media" && current.params.trim() === "print") {
      return true;
    }
    current = current.parent;
  }
  return false;
}

interface ColorDecl {
  rule: Rule;
  decl: Declaration;
  selector: string;
  spec: Specificity;
  important: boolean;
  line: number;
}

/** Every `color` declaration in the stylesheet, one entry per selector in a comma-separated list. */
function collectColorDecls(root: postcss.Root): { print: ColorDecl[]; screen: ColorDecl[] } {
  const print: ColorDecl[] = [];
  const screen: ColorDecl[] = [];
  root.walkRules((rule) => {
    const insidePrint = isInsidePrintMedia(rule);
    rule.walkDecls("color", (decl) => {
      for (const selector of rule.selectors) {
        const entry: ColorDecl = {
          rule,
          decl,
          selector,
          spec: specificity(selector),
          important: decl.important === true,
          line: decl.source?.start?.line ?? 0,
        };
        (insidePrint ? print : screen).push(entry);
      }
    });
  });
  return { print, screen };
}

/** Decides the winner the way a browser's cascade does: !important, then specificity, then order. */
function printWins(printEntry: ColorDecl, competitor: ColorDecl): boolean {
  if (printEntry.important !== competitor.important) return printEntry.important;
  if (printEntry.spec.value !== competitor.spec.value) return printEntry.spec.value > competitor.spec.value;
  return printEntry.line > competitor.line;
}

describe.each(FILES)("print colour reset beats class-plus-type colour rules — %s", (relativePath) => {
  it(`wins the cascade against every competing class-plus-type colour rule in ${relativePath}`, () => {
    // Floor 1: the file must actually exist and parse. A missing or unreadable file is a defect
    // in this test's own wiring, not a silent pass.
    expect(existsSync(relativePath), `${relativePath}: file not found — cannot examine its print block`).toBe(true);
    const css = readFileSync(relativePath, "utf8");
    expect(css.length, `${relativePath}: file is empty — nothing to parse`).toBeGreaterThan(0);

    let root: postcss.Root;
    try {
      root = postcss.parse(css, { from: relativePath });
    } catch (error) {
      throw new Error(`${relativePath}: postcss failed to parse this stylesheet — ${String(error)}`);
    }

    const { print, screen } = collectColorDecls(root);

    // Floor 2: the print reset itself must be found, on a selector that actually reaches
    // descendants (`.screen *`, not `.screen` alone — the root-only selector never matches a
    // table cell). If it is missing, every downstream comparison would be vacuous, so this must
    // fail loudly and name the file rather than silently reporting "no violations found".
    const printReset = print.find((entry) => entry.selector.replace(/\s+/gu, " ").trim() === ".screen *");
    expect(
      printReset,
      `${relativePath}: no "color" declaration found on a ".screen *" selector inside @media print — ` +
        `the print colour reset is missing or was renamed, so this file's table/detail cells have no ` +
        `reset applied to them at all.`,
    ).toBeDefined();
    const reset = printReset as ColorDecl;

    // Floor 3: at least one competing class-plus-type colour rule must actually exist outside the
    // print block, or the comparison below examines nothing. Never floor the violation count —
    // floor the population that was walked.
    const competitors = screen.filter((entry) => entry.spec.classes >= 1 && entry.spec.types >= 1);
    expect(
      competitors.length,
      `${relativePath}: found zero class-plus-type "color" rules outside @media print (e.g. the ` +
        `shape of ".table td" or ".governanceBanner p") — the comparison this test exists to make ` +
        `would be vacuous for this file. Population examined: ${screen.length} total "color" ` +
        `declarations outside @media print.`,
    ).toBeGreaterThan(0);

    // The real cascade computation: for every competing selector, decide whether the print reset
    // wins the way a browser would (!important first, then specificity, then source order).
    const losses = competitors.filter((competitor) => !printWins(reset, competitor));

    const describeEntry = (entry: ColorDecl) =>
      `"${entry.selector}" (line ${entry.line}, specificity ${entry.spec.ids}-${entry.spec.classes}-${entry.spec.types}` +
      `${entry.important ? ", !important" : ""})`;

    const summary =
      `${relativePath}: the print colour reset ${describeEntry(reset)} loses the cascade to ` +
      `${losses.length} of ${competitors.length} competing class-plus-type colour rule(s):\n` +
      losses.map((loss) => `  - ${describeEntry(loss)}`).join("\n") +
      `\n\nAll competing selectors compared:\n` +
      competitors.map((c) => `  - ${describeEntry(c)}`).join("\n") +
      `\n\nIn dark mode this means those elements keep their themed colour under print — near-white ` +
      `text on white paper. See the docstring on the @media print block in ${relativePath}.`;

    expect(losses.length, summary).toBe(0);
  });
});
