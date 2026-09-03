import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/**
 * `morning.module.css`'s own `@media print` block documents that `handover.module.css` — this
 * file's own documented starting point — had the identical gap and was flagged as a pre-existing
 * issue outside that task's scope. This test closes it here.
 *
 * `.screen` and `.governanceBanner` each carry their own explicit `background: var(--surface)` /
 * `var(--surface-chrome)` for on-screen dark-theme support (`ckb-v2-tokens.css`'s `.dark .ckb-v2`
 * ramp resolves those to near-black — `#12161a` / `#0e1216`). The global print reset in
 * `globals.css` only resets `html`/`body`'s own background; CSS `background` does not inherit and
 * an element's own explicit declaration is not overridden by an ancestor's, so without a
 * print-scoped reset here, printing the page while the app is in dark mode paints the whole
 * screen container and the governance banner band as a dark ink-on-dark-paper band instead of the
 * white sheet the rest of this print block is built to produce.
 *
 * Measured live with Playwright (`emulateMedia({ media: "print", colorScheme: "dark" })`) against
 * the running dev server before and after the fix:
 *   before — `.screen` background-color `rgb(18, 22, 26)`, `.governanceBanner` background-color
 *   `rgb(14, 18, 22)`.
 *   after  — both resolve to `rgba(0, 0, 0, 0)` (transparent, i.e. the white page shows through).
 */
describe("Ward shift handover — print background stays ink-on-paper under dark theme", () => {
  it("resets .screen and .governanceBanner background inside @media print", () => {
    const css = source("src/components/ward-management/handover/handover.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "handover.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    // The print block is not the last top-level rule in this file (the phone-bar breakpoint
    // follows it), so slice to the block's own matching closing brace at nesting depth 0 rather
    // than to end of file.
    let depth = 0;
    let printEnd = -1;
    for (let i = printStart; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          printEnd = i + 1;
          break;
        }
      }
    }
    expect(printEnd, "handover.module.css: @media print block never closes").toBeGreaterThan(printStart);
    const printBlock = css.slice(printStart, printEnd);

    const screenRuleStart = printBlock.indexOf(".screen {");
    const screenRuleEnd = printBlock.indexOf("}", screenRuleStart);
    expect(screenRuleStart, "no .screen rule inside @media print").toBeGreaterThanOrEqual(0);
    const screenRule = printBlock.slice(screenRuleStart, screenRuleEnd);
    expect(screenRule, ".screen must reset its on-screen background for print").toContain("background: none");

    const bannerRuleStart = printBlock.indexOf(".governanceBanner {");
    const bannerRuleEnd = printBlock.indexOf("}", bannerRuleStart);
    expect(bannerRuleStart, "no .governanceBanner rule inside @media print").toBeGreaterThanOrEqual(0);
    const bannerRule = printBlock.slice(bannerRuleStart, bannerRuleEnd);
    expect(bannerRule, ".governanceBanner must reset its on-screen background for print").toContain("background: none");
  });

  /**
   * Second half of the same defect, and the part the original request missed: fixing only the
   * background above turns a dark band into a white sheet — but the print block already leans on
   * `CanvasText` in four places (`.governanceBanner` border, `.section`, `.table th`/`td`,
   * `.crossLink`), and `color-scheme` is inherited. `.dark` (globals.css) sets `color-scheme:
   * dark` on the root, so without an override, `CanvasText` resolves against the *inherited*
   * scheme rather than the print medium — producing white ink on the white page the reset above
   * now forces, which is strictly worse than the original dark band (an obviously broken page vs.
   * an apparently blank one).
   *
   * Measured live with Playwright, same session as above:
   *   before — `.governanceBanner` border-bottom-color, `.crossLink` color, `.section`
   *   border-color, and `.table th` border-bottom-color all resolved to `rgb(255, 255, 255)`.
   *   after  — all four resolve to `rgb(0, 0, 0)`.
   */
  it("pins color-scheme: light on .screen inside @media print, so CanvasText ink is never white-on-white", () => {
    const css = source("src/components/ward-management/handover/handover.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "handover.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    const printBlock = css.slice(printStart);

    const screenRuleStart = printBlock.indexOf(".screen {");
    const screenRuleEnd = printBlock.indexOf("}", screenRuleStart);
    expect(screenRuleStart, "no .screen rule inside @media print").toBeGreaterThanOrEqual(0);
    const screenRule = printBlock.slice(screenRuleStart, screenRuleEnd);
    expect(
      screenRule,
      ".screen must pin color-scheme: light for print, or CanvasText inherits the app's dark color-scheme and resolves to white ink",
    ).toContain("color-scheme: light");
  });
});
