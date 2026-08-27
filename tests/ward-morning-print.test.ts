import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/**
 * Phase 6 Task 6 (the "look at the rendered screen" pass): the morning page's `.screen` and
 * `.governanceBanner` each carry their own explicit `background: var(--surface)` /
 * `var(--surface-chrome)` for on-screen dark-theme support (`ckb-v2-tokens.css`'s `.dark .ckb-v2`
 * ramp resolves those to near-black — `#12161a` / `#0e1216`). The global print reset in
 * `globals.css` only resets `html`/`body`'s own background (`@media print { html, body {
 * background: #fff; ... } }`); CSS `background` does not inherit and an element's own explicit
 * declaration is not overridden by an ancestor's, so without a print-scoped reset here, printing
 * the page while the app is in dark mode paints the whole screen container and the governance
 * banner band as dark ink-on-dark-paper — directly contradicting the "no dark background"
 * requirement this page's print output is built to satisfy (see the doc comment on this same
 * `@media print` block).
 *
 * This was found by reading the CSS after the fact, not by a screenshot — this environment could
 * not composite a real screenshot to see it directly, but the underlying cascade fact (no
 * print-scoped background reset on either selector, confirmed by grepping every `@media print`
 * block in globals.css for a `:root` custom-property reset and finding none) is independently
 * verifiable, which is what this test pins.
 *
 * `handover.module.css`'s own print block — this file's own documented starting point — has the
 * identical gap and is a pre-existing issue outside this task's scope; flagged separately.
 */
describe("Ward morning bed state — print background stays ink-on-paper under dark theme", () => {
  it("resets .screen and .governanceBanner background inside @media print", () => {
    const css = source("src/components/ward-management/morning/morning.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "morning.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    // The print block is the last top-level rule in the file (only the phone-bar breakpoint
    // follows it) — slice to end of file rather than guessing a closing-brace offset that a later
    // edit inside the block could silently invalidate.
    const printBlock = css.slice(printStart);

    const screenRuleStart = printBlock.indexOf(".screen {");
    const screenRuleEnd = printBlock.indexOf("}", screenRuleStart);
    expect(screenRuleStart, "no .screen rule inside @media print").toBeGreaterThanOrEqual(0);
    const screenRule = printBlock.slice(screenRuleStart, screenRuleEnd);
    expect(screenRule, ".screen must reset its on-screen background for print").toContain("background: none");

    const bannerRuleStart = printBlock.indexOf(".governanceBanner {");
    const bannerRuleEnd = printBlock.indexOf("}", bannerRuleStart);
    expect(bannerRuleStart, "no .governanceBanner rule inside @media print").toBeGreaterThanOrEqual(0);
    const bannerRule = printBlock.slice(bannerRuleStart, bannerRuleEnd);
    expect(bannerRule, ".governanceBanner must reset its on-screen background for print").toContain(
      "background: none",
    );
  });
});
