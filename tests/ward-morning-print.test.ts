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

/**
 * Gap 4 (final review), print half. `ViewControl`'s on-screen explainer paragraph — the page's
 * only statement that the fixed view is a snapshot at open against the 08:00 clock, not a
 * reconstruction of 08:00 itself — is inside `.viewControl`, which `@media print` hides entirely
 * (see that block's own doc comment: neither the interactive fixed/live buttons nor the
 * explainer belong on a printed sheet). `PrintViewMeta`'s condensed `.printViewNote` paragraph is
 * the ONLY place left that carries this caveat once `.viewControl` is hidden, and it only reaches
 * a printed sheet at all because `.printViewMeta { display: none }` (its screen-hidden default,
 * declared before the `@media print` block) is explicitly restored to visible inside it.
 *
 * `tests/ward-morning-page.dom.test.tsx` proves the CONTENT is correct (the label names the
 * right view/instant, the note carries the honesty caveat) — jsdom cannot evaluate `@media
 * print`, so it cannot see whether that content actually survives onto the printed sheet. This
 * is the other half: a source-text check, in the same style as `.screen`/`.governanceBanner`/
 * `.siteHeader` above, that the CSS rule restoring `.printViewMeta` to visible still exists.
 * Without it, deleting that one rule leaves the caveat correctly worded and present in the DOM —
 * so the DOM test above stays green — while a real printed sheet shows nothing at all, exactly
 * the "the blocker round just made it survive into print, and nothing guards that" gap this
 * closes.
 */
describe("Ward morning bed state — the honest fixed-view caveat survives into the printed sheet", () => {
  it("restores .printViewMeta to visible inside @media print, so the caveat is not silently lost with the interactive control", () => {
    const css = source("src/components/ward-management/morning/morning.module.css");

    const printStart = css.indexOf("@media print {");
    expect(printStart, "morning.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    const printBlock = css.slice(printStart);

    // A line-anchored regex, not a plain `indexOf`: the doc comment immediately above the real
    // rule (C2 fix pass) quotes `` `.printViewMeta { display: none }` `` verbatim to explain what
    // is being overridden, so a plain substring search finds that comment's text first and reads
    // its quoted "display: none" as the rule itself. Anchoring to the start of a line (only
    // whitespace before the selector) skips the mid-comment quotation and finds the real rule.
    const metaRuleMatch = /^[ \t]*\.printViewMeta[ \t]*\{/m.exec(printBlock);
    expect(
      metaRuleMatch,
      "no .printViewMeta rule inside @media print — the screen-hidden default (`.printViewMeta { display: none }`) " +
        "would take the fixed view's only honesty caveat with it onto a printed sheet",
    ).not.toBeNull();
    const metaRuleStart = metaRuleMatch!.index;
    const metaRuleEnd = printBlock.indexOf("}", metaRuleStart);
    const metaRule = printBlock.slice(metaRuleStart, metaRuleEnd);
    expect(metaRule, ".printViewMeta must not stay hidden for print").not.toMatch(/display:\s*none/);
    expect(
      metaRule,
      ".printViewMeta must force its display back on to beat the screen-hidden default declared earlier in this file",
    ).toMatch(/display:\s*\S+\s*!important/);
  });
});

/**
 * Task 9 (product owner, 2026-08-28), print half. The people-waiting figure is required to appear
 * on the PRINTED sheet, not only on screen — and this page's print rendering has already produced
 * three defects no test caught: every hospital name vanished to a global `header { display: none }`,
 * a sheet that promised one page rendered five, and dark-mode ink came out white-on-white because
 * `CanvasText` resolved against the inherited `color-scheme`. The demand card is exposed to two of
 * those three, so both are pinned here in the same source-text style as the rules above.
 *
 * jsdom cannot evaluate `@media print`, so `tests/ward-morning-page.dom.test.tsx` can only prove
 * the card's CONTENT is right. This is the other half: that the card is not hidden for print, and
 * that its title, its number and its note are all named in a `color: CanvasText` rule so a sheet
 * printed while the app is in dark mode shows them in paper ink rather than white on white.
 *
 * The page-count half of the third defect is not a source-text property and is not pinned here —
 * it was measured with `page.pdf({ format: "A4" })` and reported in the task's own report.
 */
describe("Ward morning bed state — the people-waiting figure reaches the printed sheet, in ink", () => {
  /** The print block with CSS comments removed. Several comments in this file quote whole rules
   *  verbatim (`header, nav, button { display: none !important }`), so a brace-matching scan over
   *  the raw text reads a quotation as a rule. */
  function printBlockWithoutComments(): string {
    const css = source("src/components/ward-management/morning/morning.module.css");
    const printStart = css.indexOf("@media print {");
    expect(printStart, "morning.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    return css.slice(printStart).replace(/\/\*[\s\S]*?\*\//g, "");
  }

  /**
   * Every INDIVIDUAL selector, across all rules in the print block whose declarations contain
   * `color: CanvasText` — split on the comma and trimmed, never returned as one joined string.
   *
   * Written this way because the joined-string version was hollow, and a mutation caught it: an
   * assertion of the form `expect(joined).toContain(".peopleWaitingValue")` matches a SUBSTRING,
   * so renaming the selector to `.peopleWaitingValueRenamed` — which no longer matches anything
   * the page renders — left the guard green. Exact membership in this array cannot pass that way.
   */
  function canvasTextSelectors(printBlock: string): string[] {
    const selectors: string[] = [];
    for (const match of printBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/color:\s*CanvasText/.test(match[2])) continue;
      for (const selector of match[1].split(",")) {
        const trimmed = selector.trim();
        if (trimmed) selectors.push(trimmed);
      }
    }
    return selectors;
  }

  it("never hides the headline row or the people-waiting card for print", () => {
    const printBlock = printBlockWithoutComments();

    for (const selector of [".headlineRow", ".peopleWaiting"]) {
      // `.` is a regex metacharacter and every selector here starts with one, so it is escaped
      // rather than passed through — an unescaped `.` would match any character and could find a
      // different rule entirely.
      const escaped = selector.replace(/\./g, "\\.");
      const ruleMatch = new RegExp(`^[ \\t]*${escaped}[ \\t]*\\{`, "m").exec(printBlock);
      if (ruleMatch === null) continue; // No print-scoped rule at all is fine — nothing hides it.
      const rule = printBlock.slice(ruleMatch.index, printBlock.indexOf("}", ruleMatch.index));
      expect(rule, `${selector} must not be hidden for print — it carries task 9's demand figure`).not.toMatch(
        /display:\s*none/,
      );
    }
  });

  it("gives the people-waiting title, number and note CanvasText ink, so dark mode never prints them white-on-white", () => {
    const printBlock = printBlockWithoutComments();
    const selectors = canvasTextSelectors(printBlock);

    // Non-vacuity: the scan really found CanvasText rules, or every assertion below would pass by
    // finding nothing to contradict it. `.headlineValue` is the long-standing one it must see.
    expect(selectors.length, "no `color: CanvasText` rule was read from the print block").toBeGreaterThan(0);
    expect(selectors, "the CanvasText scan did not see the long-standing .headlineValue rule").toContain(
      ".headlineValue",
    );

    for (const selector of [".peopleWaitingTitle", ".peopleWaitingValue", ".peopleWaitingNote"]) {
      expect(
        selectors,
        `${selector} is not covered by any \`color: CanvasText\` rule — printed from the dark theme it would ` +
          `resolve to white ink on the white sheet the global print reset forces`,
      ).toContain(selector);
    }
  });
});
