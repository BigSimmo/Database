import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const CSS_PATH = "src/components/ward-management/referrals/referrals.module.css";

/**
 * Phase 7 visual pass, fix round D: `referrals.module.css` — the module shared by the referral
 * board, the intake form, and the match view beneath the board — had NO `@media print` block at
 * all. Printing any of the three screens while the device is in dark mode rendered nearly the
 * whole page as pale grey text on white paper (58 of 59 leaves flagged on the board, 14 of 15 on
 * the intake form, 63 of 63 on the match view, measured with `.tmp-visual/print-ink-sweep.mjs`
 * against a 4.5:1 contrast floor). This file guards the fix in the same source-text style as
 * `tests/ward-morning-print.test.ts` guards `morning.module.css`'s own print block — jsdom cannot
 * evaluate `@media print`, so these are text-presence checks on the CSS itself, not a rendering
 * assertion; the rendering claim (before/after `rgb(...)` values) is proven separately and
 * recorded in this task's own report.
 */

function printBlock(): string {
  const css = source(CSS_PATH);
  const printStart = css.indexOf("@media print {");
  expect(printStart, `${CSS_PATH}: could not find the @media print block`).toBeGreaterThanOrEqual(0);
  // The print block is the last top-level rule in the file — slice to end of file rather than
  // guessing a closing-brace offset a later edit inside the block could silently invalidate.
  return css.slice(printStart);
}

/** Same shape as the print block with comments stripped, for brace-matching scans that would
 *  otherwise be fooled by a comment quoting a rule verbatim (this file's own doc comment does,
 *  more than once). */
function printBlockWithoutComments(): string {
  return printBlock().replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Every INDIVIDUAL selector, across all rules in the print block whose declarations contain
 * `color: CanvasText` — split on the comma and trimmed, never returned as one joined string.
 *
 * Written this way, not as `expect(joined).toContain(...)`, because the morning page's own first
 * version of this helper was hollow: a joined-string assertion matches on SUBSTRING, so renaming
 * a selector to `.matchTierRenamed` — which no longer matches anything the page renders — left a
 * `toContain(".matchTier")` guard green. Exact array membership cannot pass that way.
 */
function canvasTextSelectors(block: string): string[] {
  const selectors: string[] = [];
  for (const match of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/color:\s*CanvasText/.test(match[2])) continue;
    for (const selector of match[1].split(",")) {
      const trimmed = selector.trim();
      if (trimmed) selectors.push(trimmed);
    }
  }
  return selectors;
}

/**
 * The declaration block of the rule whose comma-separated selector LIST contains `selector` as an
 * exact, trimmed member — not a line-anchored `selector {` match, which only finds a selector
 * written alone on its own line immediately before the opening brace. Several selectors this file
 * guards (`.fieldCard`, `.rejection`, `.select`, ...) are declared as one member of a multi-line
 * comma list, so a line-anchored `\{` match would find nothing for them even though the rule
 * exists and is correct — the same brace-matching approach `canvasTextSelectors` above uses,
 * scoped to one named selector instead of one property.
 */
function ruleDeclarationsFor(block: string, selector: string): string | null {
  for (const match of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = match[1].split(",").map((name) => name.trim());
    if (names.includes(selector)) return match[2];
  }
  return null;
}

describe("Ward referrals — print background stays ink-on-paper under dark theme", () => {
  it("resets .screen's background and pins color-scheme: light inside @media print", () => {
    const block = printBlock();
    const screenRuleStart = block.indexOf(".screen {");
    expect(screenRuleStart, "no .screen rule inside @media print").toBeGreaterThanOrEqual(0);
    const screenRule = block.slice(screenRuleStart, block.indexOf("}", screenRuleStart));
    expect(screenRule, ".screen must reset its on-screen background for print").toContain("background: none");
    expect(
      screenRule,
      ".screen must pin color-scheme: light for print, or CanvasText inherits the app's dark color-scheme and resolves to white ink",
    ).toContain("color-scheme: light");
  });

  it("hides the rail (.screen > aside) inside @media print", () => {
    const block = printBlockWithoutComments();
    const ruleMatch = /^[ \t]*\.screen[ \t]*>[ \t]*aside[ \t]*\{/m.exec(block);
    expect(
      ruleMatch,
      "no `.screen > aside` rule inside @media print — the rail (and its avatar) would survive onto the printed sheet",
    ).not.toBeNull();
    const rule = block.slice(ruleMatch!.index, block.indexOf("}", ruleMatch!.index));
    expect(rule, ".screen > aside must force itself off with !important").toMatch(/display:\s*none\s*!important/);
  });

  it("resets .governanceBanner's background and border for print", () => {
    const block = printBlock();
    const bannerRuleStart = block.indexOf(".governanceBanner {");
    expect(bannerRuleStart, "no .governanceBanner rule inside @media print").toBeGreaterThanOrEqual(0);
    const bannerRule = block.slice(bannerRuleStart, block.indexOf("}", bannerRuleStart));
    expect(bannerRule, ".governanceBanner must reset its on-screen background for print").toContain("background: none");
    expect(bannerRule, ".governanceBanner must use CanvasText for its border, not a theme border token").toContain(
      "border-bottom: 0.0625rem solid CanvasText",
    );
  });
});

describe("Ward referrals — every card container resets its dark-theme background for print", () => {
  it("resets background and border-color to CanvasText on every bordered card container", () => {
    const block = printBlockWithoutComments();
    // Every one of these carries its own explicit `background: var(--surface-subtle)` /
    // `var(--surface-raised)` on screen, which would otherwise survive a `.screen`-only reset as
    // a near-black island on the printed sheet.
    // `.bandGroup` is the match view's band-group container. It was added to the screen by Phase 8
    // Task 4 — AFTER this guard's arrays were written — and reset in the print block by Task 10,
    // which measured it printing as a near-black island. It carries its own
    // `background: var(--surface-raised)`, so it belongs in this group for exactly the reason every
    // name beside it does; until now nothing pinned it and deleting the reset stayed green.
    for (const selector of [
      ".fieldCard",
      ".section",
      ".card",
      ".matchPanel",
      ".bandGroup",
      ".matchRowAccepts",
      ".matchRowDeclines",
      ".toggleCard",
    ]) {
      const rule = ruleDeclarationsFor(block, selector);
      expect(
        rule,
        `no print-scoped rule for ${selector} — its dark-theme background would survive onto the printed sheet`,
      ).not.toBeNull();
      expect(rule, `${selector} must reset its background for print`).toContain("background: none");
      expect(rule, `${selector} must use CanvasText for its border, not a theme border token`).toContain(
        "border-color: CanvasText",
      );
    }
  });

  it("resets background on the semantic alert boxes and the two small figure badges", () => {
    const block = printBlockWithoutComments();
    for (const selector of [
      ".rejection",
      ".confirmation",
      ".structuralGap",
      ".noBedAccepts",
      ".waitBadge",
      ".forensicBadge",
      ".selectedRow",
      ".select",
    ]) {
      const rule = ruleDeclarationsFor(block, selector);
      expect(
        rule,
        `no print-scoped rule for ${selector} — its dark-theme background would survive onto the printed sheet`,
      ).not.toBeNull();
      expect(rule, `${selector} must reset its background for print`).toContain("background: none");
    }
  });
});

describe("Ward referrals — every muted or themed text selector gets CanvasText ink under print", () => {
  it("names every selector this fix was measured against, by exact array membership", () => {
    const block = printBlockWithoutComments();
    const selectors = canvasTextSelectors(block);

    // Non-vacuity: the scan really found CanvasText rules, or every assertion below would pass by
    // finding nothing to contradict it.
    expect(selectors.length, "no `color: CanvasText` rule was read from the print block").toBeGreaterThan(0);

    // Measured before this fix, printed from the dark theme (`.tmp-visual/print-ink-sweep.mjs` /
    // `print-ink-sweep-match.mjs`): every one of these resolved to a pale muted-token colour
    // (`rgb(168, 178, 189)`, `rgb(244, 246, 248)` or `rgb(251, 252, 253)`) against the white sheet
    // the global print reset forces. `.table th` / `.table td` cover every plain table cell on
    // the board and match views; `.governanceBanner p` and `.matchPanel > p` are descendant
    // selectors because those two paragraphs carry no class of their own.
    for (const selector of [
      ".sectionHeading",
      ".decidedNote",
      ".fieldLegend",
      ".governanceBanner p",
      ".matchHeading",
      ".matchGovernance",
      ".matchTier",
      ".matchSummary",
      ".matchReasonText",
      ".matchUnitName",
      ".acceptsLabel",
      ".matchPanel > p",
      // Phase 8's own text on the match view, added to the print block by Task 10 and pinned here
      // by the whole-branch review's W3: the band-group heading label, its two counts, the empty
      // band's note, the per-row band, and the two governance sentences. Each uses `--text-heading`
      // or `--text-muted`, which stay pale grey/blue in the dark theme whatever `color-scheme` says.
      // Until now this file's own title — "names every selector this fix was measured against" —
      // was false about all six of them, and deleting any one of them from the CSS stayed green.
      ".bandLabel",
      ".bandCounts",
      ".bandEmpty",
      ".matchBand",
      ".syntheticNotice",
      ".allNotRecorded",
      ".toggleCard",
      ".rejection",
      ".confirmation",
      ".structuralGap",
      ".noBedAccepts",
      ".waitBadge",
      ".forensicBadge",
      ".select",
      ".table th",
      ".table td",
    ]) {
      expect(
        selectors,
        `${selector} is not covered by any \`color: CanvasText\` rule — printed from the dark theme it would resolve to pale ink on the white sheet the global print reset forces`,
      ).toContain(selector);
    }
  });
});
