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
    expect(bannerRule, ".governanceBanner must reset its on-screen background for print").toContain("background: none");
  });
});

/**
 * Phase 6 Task 6 follow-up (fix pass): printed under `emulateMedia({ media: "print" })`, each
 * hospital block's own `<header className={styles.siteHeader}>` — carrying the hospital name
 * (`h2.siteName`) and the site freshness stamp (`FreshnessStamp`, `.freshness`) — measured
 * `0 × 0`. `globals.css`'s transitional `header, nav, button { display: none !important }`
 * print reset hides every semantic `<header>` element, and the morning page renders one per
 * hospital block; nothing in this file restored it, so a printed sheet named no hospital.
 *
 * Second half of the same defect: even once `.siteHeader` is redisplayed, `.siteName`'s
 * `color: CanvasText` (added for the print dark-background fix) does not by itself resolve to
 * black ink. `color-scheme` is inherited, `.dark` (globals.css) sets `color-scheme: dark` on
 * the root, and Chromium resolves system colours like `CanvasText` against the *inherited*
 * `color-scheme` rather than the active media type — so under print while the on-screen theme
 * is dark, `CanvasText` resolved to `rgb(255, 255, 255)`: white text on the white sheet the
 * print reset forces. Confirmed live with Playwright (`emulateMedia({ media: "print",
 * colorScheme: "dark" })`) before and after the fix — see the task's fix report for the
 * measured values. Pinning `color-scheme: light` on `.screen` inside `@media print` makes every
 * `CanvasText` reference under it resolve to the light (paper) appearance regardless of the
 * on-screen theme.
 */
describe("Ward morning bed state — the hospital header survives print, in ink, in both colour schemes", () => {
  it("restores .siteHeader inside @media print", () => {
    const css = source("src/components/ward-management/morning/morning.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "morning.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    const printBlock = css.slice(printStart);

    const headerRuleStart = printBlock.indexOf(".siteHeader {");
    expect(
      headerRuleStart,
      "no .siteHeader rule inside @media print — the global `header { display: none }` reset will hide every hospital name",
    ).toBeGreaterThanOrEqual(0);
    const headerRuleEnd = printBlock.indexOf("}", headerRuleStart);
    const headerRule = printBlock.slice(headerRuleStart, headerRuleEnd);
    expect(headerRule, ".siteHeader must not be hidden — it carries the hospital name and freshness stamp").not.toMatch(
      /display:\s*none/,
    );
    expect(
      headerRule,
      ".siteHeader must force its display back on to beat the global `header { display: none !important }` reset",
    ).toMatch(/display:\s*\S+\s*!important/);
  });

  it("pins color-scheme: light on .screen inside @media print, so CanvasText ink is never white-on-white", () => {
    const css = source("src/components/ward-management/morning/morning.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "morning.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
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
