import { expect, test, type Page } from "playwright/test";

/**
 * ⚠️ THE FIRST TIME ANY WARD FLOW SCREEN HAS BEEN RENDERED UNDER FORCED COLOURS.
 *
 * Windows High Contrast is a real setting for a real user of clinical software, and until this
 * spec nothing in this repository had ever drawn a ward screen in it. What we had instead was a
 * ratio: 28 of the ward stylesheets carry a `@media (forced-colors: active)` block and the six
 * Board-layer files carry none. That ratio is not evidence of a defect, and this spec exists so
 * nobody has to keep arguing from it.
 *
 * ⚠️ AND THE RATIO CANNOT BE FIXED FROM A SCREEN, WHICH IS WHY THE LAYER HAD TO BE LOOKED AT
 * DIRECTLY. `.panel`, `.chip` and `.figureStrip` each `composes: wardTokens`, which declares
 * `--ward-border` ON THE PRIMITIVE'S OWN ELEMENT. A same-element custom-property declaration beats
 * an inherited one, so a screen's forced-colors block repointing `--ward-border` on an ancestor
 * cannot reach them. Measured on the page 2026-09-04: setting `--ward-border` on the search
 * screen's root left the panel's own value and its rendered border colour unchanged.
 *
 * So the primitives have no forced-colors handling from any source, and no screen could have given
 * them one. Whether that COSTS anything is what the three assertions below answer.
 *
 * Two screens, chosen because between them they render all three primitives — counted on the page
 * rather than assumed:
 *   /ward/rph-adult-secure   5 panels, 3 chips, 0 figures
 *   /people/PT-001           6 panels, 0 chips, 6 figures
 *
 * 🔴 SELECT BY `data-ward-primitive`, NEVER BY CLASS NAME. The first version of this file used
 * `[class*="ward-panel-module"]`, which is a DEV-ONLY hook: CSS-module class names keep the source
 * filename in the dev server and drop it in a production build. All three assertions found ZERO
 * elements on a page that had rendered perfectly — and the runner builds production, which is the
 * build that matters. The anti-vacuity guards are what turned that into "no panel on this screen"
 * instead of an incomprehensible contrast number, which is the whole reason they are there.
 */

/** WCAG 2.1 non-text contrast (1.4.11). A border that carries structure has to clear this. */
const MIN_NON_TEXT_CONTRAST = 3;
/** WCAG 2.1 contrast minimum (1.4.3) for body text. */
const MIN_TEXT_CONTRAST = 4.5;

type Measured = { readonly found: number; readonly ratio: number; readonly fg: string; readonly bg: string };

/**
 * Reads a colour pair off the first matching element and returns its contrast ratio.
 *
 * `which: "border"` compares the border against the background BEHIND it, walking up for the
 * first ancestor that actually paints one — a chip's own background is `transparent`, so
 * comparing a border against its own element would compare it against nothing and produce a
 * meaningless number rather than a failure.
 */
async function measure(page: Page, selector: string, which: "border" | "text"): Promise<Measured> {
  return page.evaluate(
    ([sel, mode]) => {
      const relativeLuminance = (colour: string): number => {
        const parts = (colour.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number);
        const channels = parts.map((raw) => {
          const v = raw / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const opaque = (colour: string): boolean => colour !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/u.test(colour);

      const elements = document.querySelectorAll(sel);
      const element = elements[0] as HTMLElement | undefined;
      if (!element) return { found: 0, ratio: 0, fg: "", bg: "" };

      const style = getComputedStyle(element);
      const fg = mode === "border" ? style.borderTopColor : style.color;

      let bg = style.backgroundColor;
      let parent: HTMLElement | null = mode === "border" ? element.parentElement : element;
      while (parent && !opaque(bg)) {
        bg = getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }

      const a = relativeLuminance(fg);
      const b = relativeLuminance(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { found: elements.length, ratio, fg, bg };
    },
    [selector, which] as const,
  );
}

async function open(page: Page, path: string): Promise<void> {
  /*
   * ⚠️ `emulateMedia`, NOT `test.use({ forcedColors })`. The `use` form does not type-check against
   * this repo's pinned Playwright — `'forcedColors' does not exist in type 'Fixtures<...>'` — and
   * the failure surfaced only in the runner's production TYPE CHECK, long after the spec ran
   * happily in an editor. `page.emulateMedia` is the form already proven here, in
   * `tests/answer-progress-ui-smoke.spec.ts`. It is set BEFORE navigation so the first paint is
   * already in forced colours rather than a re-render into it.
   */
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  // React streams a hidden staging copy of the whole screen into the document for a moment, so
  // every locator resolves to two elements until it is gone. The ward specs all wait it out
  // rather than relaxing to `.first()`, which would measure whichever copy came first — possibly
  // the inert server-rendered one.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
}

/**
 * ⚠️ THE CONTROL, AND WITHOUT IT ALL THREE ASSERTIONS BELOW ARE VACUOUS. If forced-colors
 * emulation silently failed to apply, every measurement would be taken in ordinary colours and
 * every one of them would pass — reporting a clean bill of health for a mode nobody had entered.
 * This project has been caught by exactly that shape repeatedly: a check whose scope does not
 * match the claim it is taken to support.
 */
test("@mockup forced colours is actually active, or nothing below means anything", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const active = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
  expect(active, "forced-colors emulation did not apply; the assertions in this file are vacuous").toBe(true);
});

test("@mockup a panel's border survives forced colours", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const panel = await measure(page, '[data-ward-primitive="panel"]', "border");

  expect(panel.found, "no panel on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    panel.ratio,
    `panel border ${panel.fg} on ${panel.bg} = ${panel.ratio.toFixed(2)}:1 — a panel whose border ` +
      `vanishes in high contrast is a screen with no visible structure`,
  ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
});

test("@mockup a chip's border survives forced colours, and its words carry the state either way", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const chip = await measure(page, '[data-ward-primitive="chip"]', "border");

  expect(chip.found, "no chip on this screen — the assertion below would be vacuous").toBeGreaterThan(0);

  /*
   * ⚠️ THE WORDS ARE THE REAL SAFEGUARD AND THEY ARE ASSERTED FIRST. Forced colours overrides
   * border-color AND color to system values, so every chip's border becomes the same colour and
   * the state distinction carried by colour is gone by design — that is the mode working, not a
   * defect. It is survivable only because a chip must also say its state in words. If that ever
   * stops being true, this is where it shows up.
   */
  const wordless = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-ward-primitive="chip"]')].filter(
        (chipElement) => !chipElement.textContent?.trim(),
      ).length,
  );
  expect(wordless, "a chip with no words is invisible in high contrast, not merely weak").toBe(0);

  expect(chip.ratio, `chip border ${chip.fg} on ${chip.bg} = ${chip.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
    MIN_NON_TEXT_CONTRAST,
  );
});

/**
 * ⚠️ THE ASSERTION THIS FILE EXISTS FOR, AND IT WAS MISSING FROM THE FIRST VERSION.
 *
 * `--ward-border` is re-aliased inside `@media (forced-colors: active)` by five stylesheets on this
 * branch. `--ward-divider` is declared exactly ONCE in all of `src/` and re-aliased NOWHERE. The
 * two are identical in the normal cascade, which is why they read as interchangeable — and they
 * stop agreeing precisely when a user turns high contrast on.
 *
 * A panel draws its OUTLINE with `--ward-border` and its header's under-rule with `--ward-divider`,
 * one element apart. So this compares them in the only situation where they can differ.
 *
 * A pass means the user agent overrides both to the same system colour and the token divergence
 * costs nothing on screen. A failure means we have SEEN the defect rather than deduced it — and
 * the message says which colours, so the fix arrives with evidence attached.
 */
test("@mockup a panel's outline and its header rule agree under forced colours", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");

  const pair = await page.evaluate(() => {
    const panel = document.querySelector('[data-ward-primitive="panel"]');
    const header = document.querySelector('[data-ward-primitive="panel-header"]');
    if (!panel || !header) return null;
    return {
      outline: getComputedStyle(panel).borderTopColor,
      rule: getComputedStyle(header).borderBottomColor,
    };
  });

  expect(pair, "no panel or panel header on this screen — the assertion below would be vacuous").not.toBeNull();
  expect(
    pair!.rule,
    `panel outline (--ward-border) is ${pair!.outline} and the header rule (--ward-divider) is ` +
      `${pair!.rule}. They are the same colour in normal cascade; a difference here is the ` +
      `divergence itself, visible only to a high-contrast user`,
  ).toBe(pair!.outline);
});

/**
 * 🔴 ARE THE 28 FORCED-COLORS BLOCKS DOING ANYTHING AT ALL?
 *
 * 28 ward stylesheets carry `@media (forced-colors: active)` blocks whose entire content is a
 * custom-property re-point — `--ward-border: var(--border)` and similar. Every adopter is
 * instructed to preserve them. But if the user agent overrides author colours DOWNSTREAM of
 * custom-property resolution, re-pointing the variable changes nothing: the UA overwrites the
 * resolved value whichever token produced it, and 28 files carry a block that has never done
 * anything.
 *
 * ⚠️ THIS IS MEASURED RATHER THAN REASONED ON PURPOSE. Three people have now reasoned about
 * custom-property resolution under forced colours and two got it wrong in opposite directions —
 * one asserting a divergence that never reaches the screen, one ranking it a live accessibility
 * defect. Both asked what the CASCADE does with the variable and neither asked what the USER
 * AGENT does with the resolved value. A third round of reasoning would be the same instrument.
 *
 * The experiment: change `--ward-border` on the element that declares it, and see whether the
 * rendered border colour moves.
 *
 * ⚠️ AND THE CONTROL IS THE WHOLE TEST. "Nothing changed" is exactly what a failed injection also
 * looks like, so the same manipulation runs first WITHOUT forced colours and must move the colour.
 * Without that half, this test reports "inert" for a typo.
 */
/**
 * 🔴 PARKED, AND SKIPPED DELIBERATELY — THE CONTROL FAILED, SO THERE IS NO VERDICT.
 *
 * Run on 2026-09-04 against the production build: `CONTROL FAILED: re-pointing --ward-border did
 * not move the border even in ordinary colours (rgb(102,112,133) -> rgb(102,112,133))`. The other
 * five assertions passed in the same run.
 *
 * ⚠️ THAT IS THE TEST WORKING. It refused to report "inert" from an instrument that could not be
 * shown to work, which is the entire reason the control is here — "nothing changed" and "the
 * injection failed" are the same reading.
 *
 * The same manipulation succeeds in the dev server, measured by hand on the same screen:
 *
 *     before        --ward-border #667085   borderTopColor rgb(102, 112, 133)
 *     inline set    --ward-border rgb(255,0,0)   borderTopColor rgb(255, 0, 0)   <- moves
 *     on the PARENT instead                      borderTopColor unchanged        <- as expected,
 *                   because `composes: wardTokens` declares the token on the panel's OWN element
 *                   and a same-element declaration beats an inherited one
 *
 * So it works in dev and not in the production build, and I do not know why. A `void
 * el.offsetHeight` reflow between write and read is added below as the most likely fix and is
 * UNVERIFIED — it has never been run. Guessing further costs a full production build each time,
 * which is why this is parked rather than iterated.
 *
 * 🔴 THE QUESTION IT WOULD ANSWER IS STILL OPEN: 28 ward stylesheets carry forced-colors blocks
 * whose whole content is a custom-property re-point. If the user agent overrides author colours
 * downstream of custom-property resolution, every one of those blocks is inert and every adopter
 * has been preserving dead code. Nobody deletes a block on the strength of this being unanswered.
 */
test.skip("@mockup does re-pointing --ward-border do anything under forced colours?", async ({ page }) => {
  const probe = async () =>
    page.evaluate(() => {
      const panel = document.querySelector('[data-ward-primitive="panel"]') as HTMLElement | null;
      if (!panel) return null;
      const before = getComputedStyle(panel).borderTopColor;
      panel.style.setProperty("--ward-border", "rgb(255, 0, 0)");
      // UNVERIFIED: forcing a reflow between the write and the read is the most likely reason the
      // production run saw no change while the dev server did. Never executed — see the head note.
      void panel.offsetHeight;
      const after = getComputedStyle(panel).borderTopColor;
      panel.style.removeProperty("--ward-border");
      return { before, after, moved: before !== after };
    });

  // Control, in ordinary colours: the injection must actually reach the border.
  await page.emulateMedia({ forcedColors: "none" });
  await page.goto("/mockups/ward-flow/ward/rph-adult-secure", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  const control = await probe();
  expect(control, "no panel found in the control run").not.toBeNull();
  expect(
    control!.moved,
    `CONTROL FAILED: re-pointing --ward-border did not move the border even in ordinary colours ` +
      `(${control!.before} -> ${control!.after}). The measurement below would be meaningless.`,
  ).toBe(true);

  // The real question.
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const forced = await probe();
  expect(forced, "no panel found in the forced-colors run").not.toBeNull();

  /*
   * NOT an assertion about which answer is correct — both are legitimate results and nobody is
   * acting on either tonight. This records the measurement in the failure message either way, and
   * only fails if the run produced no usable reading at all.
   */
  const verdict = forced!.moved
    ? "LIVE — the block does something; preserving it is justified"
    : "INERT under this palette — the UA overrides the resolved value, so re-pointing the token changes nothing";

  /*
   * ⚠️ PRINTED, NOT ONLY ASSERTED. An expect message is only shown when the test FAILS, so a
   * measurement recorded solely in one is unreadable on the green run — which is the run we
   * expect. The whole point of this test is the number it produces, so it goes to stdout where
   * the reporter shows it.
   */
  console.log(
    `[forced-colors inertness] control ${control!.before} -> ${control!.after} (moved) | ` +
      `forced ${forced!.before} -> ${forced!.after} (${forced!.moved ? "moved" : "unchanged"}) | ${verdict}`,
  );

  expect(
    typeof forced!.before === "string" && forced!.before.length > 0,
    `--ward-border re-point under forced colours: ${forced!.before} -> ${forced!.after}. ${verdict}. ` +
      `Control moved the colour in ordinary mode, so the injection works.`,
  ).toBe(true);
});

/**
 * 🔴 ROUND THREE ON --ward-border VS --ward-divider, AND THE FIRST VERSION THAT CAN DISTINGUISH.
 *
 * ⚠️ ASSERTION 4 ABOVE DOES NOT SETTLE THIS AND MUST NOT BE READ AS DOING SO. It compares a
 * panel's outline with that panel's header rule. `.panel` composes `wardTokens`, declaring both
 * tokens on its own element; `.panelHeader` composes nothing and INHERITS from it. So NEITHER
 * value comes from a screen's forced-colors repoint — both are author hexes taking the identical
 * force-adjustment, and their agreeing is consistent with either answer. Verified by reading
 * ward-panel.module.css: `.panelHeader` has zero `composes` lines.
 *
 * The question is whether repointing a token inside `@media (forced-colors: active)` does anything.
 * It matters because `globals.css` maps `--border` to the system keyword `ButtonBorder` in that
 * block, and a system keyword is PRESERVED rather than force-adjusted — so a repointed token and
 * an unrepointed author hex travel two different resolution paths, not one.
 *
 * `search.module.css` is the natural experiment and is deliberately left carrying it: its
 * forced-colors block repoints `--ward-border` (line ~376) and never `--ward-divider`, which it
 * uses at three sites. Both live on screen-owned elements that inherit from `.screen`, where the
 * repoint lands — unlike the primitives, which shadow it.
 *
 * ⚠️ THE STAKES ARE SYMMETRIC. If the two differ, `--ward-divider` lacks a repoint in six files
 * and there is a real gap. If they match, five files carry a repoint that does nothing, above
 * comments quoting measured contrast ratios and calling it "not optional" — five cargo-cult blocks
 * that would go on being copied.
 *
 * ⚠️ AND THE CONTROL RUNS FIRST, in ordinary colours, where the two MUST be identical. If they
 * differ there, the two elements never shared a colour and the forced-colors comparison says
 * nothing about the tokens.
 */
test("@mockup does repointing --ward-border under forced colours change what is painted?", async ({ page }) => {
  const probe = async () =>
    page.evaluate(() => {
      const input = document.querySelector("input[type=text]") as HTMLElement | null;
      /*
       * 🔴 `closest("form")`, NOT `closest("div")`. The first version walked up from the input
       * looking for a div and the chain is
       *
       *     INPUT -> LABEL.field -> FORM.filters -> MAIN.main -> DIV.screen -> DIV.shell
       *
       * so the first DIV it met was `.screen` ITSELF, and `.parentElement` from there was the
       * SHELL — one level ABOVE the element carrying the repoint, and itself composing wardTokens.
       * It therefore read `--ward-border: var(--neutral-500)` = #667085 every time, which could
       * never have been anything else. The reading was fully explained by measuring one level too
       * high, and the trailing comment saying "the filter strip" is what stopped anyone checking.
       */
      const strip = input?.closest("form") ?? null;
      /*
       * 🔴 THE SECOND ROW, NOT THE FIRST. `.peopleList li:first-child` sets `border-top: 0`,
       * because the panel header already draws that line. A zero-width border has no painted
       * colour, so `borderTopColor` falls back to `currentColor` — the TEXT colour — and the probe
       * compares a border against a piece of text.
       *
       * The control caught exactly this: in ordinary colours the two came back rgb(102,112,133)
       * and rgb(27,37,51), and they must be identical there or the forced-colours comparison
       * means nothing. That is the control doing its whole job.
       */
      const rows = document.querySelectorAll('[data-testid^="ward-patient-search-person-"]');
      const row = (rows[1] ?? null) as HTMLElement | null; // a row that actually draws its top border
      if (!strip || !row) return null;
      /*
       * ⚠️ ASSERT THE DOM SHAPE THIS PROBE ASSUMES, so a layout change fails loudly instead of
       * silently measuring a different element. The previous version resolved to *something* at
       * every step, so nothing was empty and nothing complained — the same shape as the
       * `[class*=screen]` fallthrough before it.
       */
      const forms = document.querySelectorAll("form").length;
      const stripIsUnderMain = Boolean(strip.closest("main"));
      // ⚠️ The border being measured must actually be PAINTED. A zero-width border reports a
      // colour it never draws, which is how the first version compared a border against text.
      const rowBorderWidth = getComputedStyle(row).borderTopWidth;
      const stripBorderWidth = getComputedStyle(strip).borderTopWidth;
      /*
       * ⚠️ TOKENS READ OFF THE MEASURED ELEMENTS THEMSELVES, NOT OFF A "SCREEN ROOT".
       *
       * The first version selected the root with `[class*=screen]`. CSS-module class names keep the
       * source filename in dev and DROP it in a production build, so in the run that matters it
       * matched nothing, fell through to `body > div`, and both tokens came back EMPTY STRINGS —
       * making the verdict it printed worthless. That is the fourth time in one night this
       * repository has been bitten by a dev-only selector, and it happened inside the spec written
       * because of the first three.
       *
       * Custom properties inherit, so reading them from the very elements whose borders are being
       * compared is both correct and immune to how the root is named.
       */
      return {
        borderToken: getComputedStyle(strip).getPropertyValue("--ward-border").trim(),
        dividerToken: getComputedStyle(row).getPropertyValue("--ward-divider").trim(),
        forms,
        stripIsUnderMain,
        rowBorderWidth,
        stripBorderWidth,
        rowCount: rows.length,
        paintedFromBorder: getComputedStyle(strip).borderTopColor,
        paintedFromDivider: getComputedStyle(row).borderTopColor,
      };
    });

  const search = async () => {
    await page.locator("input[type=text]").first().fill("hallow");
    await expect(page.locator('[data-testid^="ward-patient-search-person-"]').first()).toBeVisible({
      timeout: 15_000,
    });
  };

  await page.emulateMedia({ forcedColors: "none" });
  await page.goto("/mockups/ward-flow/search", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  await search();
  const control = await probe();
  expect(control, "could not find the filter strip and a person row in the control run").not.toBeNull();
  expect(
    control!.paintedFromDivider,
    `CONTROL: in ordinary colours the two borders must already match, or this comparison means ` +
      `nothing. border-painted ${control!.paintedFromBorder}, divider-painted ${control!.paintedFromDivider}`,
  ).toBe(control!.paintedFromBorder);

  await open(page, "/mockups/ward-flow/search");
  await search();
  const forced = await probe();
  expect(forced, "could not find the filter strip and a person row under forced colours").not.toBeNull();

  /*
   * ⚠️ THE VERDICT IS THREE-WAY, NOT TWO-WAY, and the first version's wording was wrong for the
   * outcome that actually occurred. Painted-same with tokens-DIFFERENT does not mean the block has
   * no effect — it means the block ran, produced a genuinely different token, and the user agent
   * collapsed both to the same ink anyway. Reporting that as "no effect" would have been an
   * overreach in the opposite direction from the last one.
   */
  const tokensDiffer = forced!.borderToken !== forced!.dividerToken;
  const paintedSame = forced!.paintedFromBorder === forced!.paintedFromDivider;
  const verdict = !tokensDiffer
    ? "INCONCLUSIVE — both tokens identical, so the repoint did not apply and nothing is being compared"
    : paintedSame
      ? "REPOINT APPLIES BUT DOES NOT CHANGE THE PAINT — the token becomes a system keyword while the " +
        "unrepointed one stays an author hex, and the UA force-adjusts both to the same ink under THIS palette"
      : "REPOINT IS LOAD-BEARING — the two paths paint differently, and --ward-divider lacks a repoint";
  console.log(
    `[forced-colors divider] tokens: --ward-border=${forced!.borderToken} --ward-divider=${forced!.dividerToken} | ` +
      `painted: from-border ${forced!.paintedFromBorder}, from-divider ${forced!.paintedFromDivider} | ${verdict}`,
  );

  // Records the measurement; asserts only that a reading was obtained. Nobody acts on either answer
  // tonight, so no preference is encoded into a gate.
  expect(
    control!.rowBorderWidth !== "0px" && control!.stripBorderWidth !== "0px",
    `a border being compared is not painted: strip ${control!.stripBorderWidth}, row ` +
      `${control!.rowBorderWidth}. A zero-width border reports currentColor, not its own colour.`,
  ).toBe(true);

  expect(
    forced!.forms === 1 && forced!.stripIsUnderMain,
    `the probe's DOM assumption no longer holds: ${forced!.forms} form(s), under main = ` +
      `${forced!.stripIsUnderMain}. It may be measuring a different element than intended.`,
  ).toBe(true);

  // ⚠️ ANTI-VACUITY: an empty token string means the probe failed, not that the tokens agree. The
  // first run of this test reported "SAME" off two empty strings; fail loudly rather than repeat it.
  expect(
    forced!.borderToken.length > 0 && forced!.dividerToken.length > 0,
    `token probe returned nothing (--ward-border="${forced!.borderToken}", ` +
      `--ward-divider="${forced!.dividerToken}") — the painted comparison above cannot be interpreted`,
  ).toBe(true);
  expect(typeof forced!.paintedFromBorder === "string" && forced!.paintedFromBorder.length > 0).toBe(true);
});

/**
 * 🔴 PRINTING THE PATIENT SEARCH SILENTLY DROPPED TWO COLUMNS.
 *
 * Measured at A4 portrait with 43 rows: `.tableScroll` clientWidth 637 against scrollWidth 704,
 * so 67px sat outside the box. "Since arrival" and "Open" were cut — the elapsed time being the
 * column a coordinator prints the list to read.
 *
 * ⚠️ HORIZONTAL OVERFLOW DOES NOT EXIST ON PAPER. Vertical overflow paginates onto the next sheet;
 * horizontal overflow is not paginated, not ruled, and leaves no ellipsis. The reader sees six
 * columns, takes them for the whole table, and never learns there were eight. That is why this is
 * a defect rather than a cosmetic issue, and why it needs a guard rather than a one-time fix.
 */
test("@mockup printing the patient search keeps every column on the sheet", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 794, height: 1123 }); // A4 portrait at 96dpi
  await page.goto("/mockups/ward-flow/search", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

  // A broad query, so the movements table actually renders. An empty table would make every
  // assertion below vacuous, which is why its presence is asserted rather than assumed.
  await page.locator("input[type=text]").first().fill("a");

  const measured = await page.evaluate(() => {
    const table = document.querySelector("table");
    if (!table) return null;
    const scroller = table.parentElement;
    if (!scroller) return null;
    return {
      columns: table.querySelectorAll("thead th").length,
      headings: [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim()),
      overflowX: getComputedStyle(scroller).overflowX,
      tableMinWidth: getComputedStyle(table).minWidth,
      headWhiteSpace: (() => {
        const th = table.querySelector("thead th");
        return th ? getComputedStyle(th).whiteSpace : "none";
      })(),
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      hidden: scroller.scrollWidth - scroller.clientWidth,
    };
  });

  expect(measured, "no movements table rendered — the assertions below would be vacuous").not.toBeNull();
  expect(measured!.columns, "a table with no header columns proves nothing").toBeGreaterThan(2);

  /*
   * 🔴 ASSERT THE MECHANISM, NOT THE EMERGENT MEASUREMENT — and this test was VACUOUS until it did.
   *
   * The first version asserted `scrollWidth - clientWidth <= 0`. It passed. It also passed with the
   * fix DELETED, because the seeded rows this query produces do not make the table wide enough to
   * overflow at A4 in the first place. A guard green for the wrong reason, in the file written to
   * hunt exactly that.
   *
   * The defect was found at 43 rows and this run cannot reliably reproduce 43 rows, so the row
   * count is the wrong thing to hang a guard on. `overflow-x` is deterministic: the print rule
   * either releases the container or it does not, whatever is in the table.
   */
  expect(
    measured!.overflowX,
    `the print rule must release .tableScroll, or a table wider than the sheet loses its rightmost ` +
      `columns with no ellipsis and no rule — silently, because horizontal overflow does not ` +
      `paginate. Measured overflow-x: ${measured!.overflowX}`,
  ).toBe("visible");

  /*
   * ⚠️ ALL THREE CONSTRAINTS, BECAUSE RELEASING ONE IS INDISTINGUISHABLE FROM FIXING IT. Dropping
   * the container's overflow alone stops the clipping and leaves the table exactly as wide, so the
   * far columns fall off the sheet instead of into a scroll box — identical on paper, and a naive
   * "no longer scrolls" check passes. The width floor and the header nowrap are what actually make
   * the table narrow enough to fit.
   */
  expect(measured!.tableMinWidth, "the 44rem floor must be released for print").toBe("0px");
  expect(
    measured!.headWhiteSpace,
    "header cells must be allowed to wrap; nowrap re-forces the width even at min-width: 0",
  ).not.toBe("nowrap");

  // Secondary, and deliberately not the load-bearing assertion: with this data the table may not
  // overflow at all, which is exactly why the mechanism above is what is pinned.
  expect(
    measured!.hidden,
    `${measured!.hidden}px outside the container (client ${measured!.clientWidth}, ` +
      `scroll ${measured!.scrollWidth}, ${measured!.columns} columns)`,
  ).toBeLessThanOrEqual(0);
});

test("@mockup a figure's value is readable under forced colours", async ({ page }) => {
  await open(page, "/mockups/ward-flow/people/PT-001");
  const figure = await measure(page, '[data-ward-primitive="figure"]', "text");

  expect(figure.found, "no figure on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    figure.ratio,
    `figure text ${figure.fg} on ${figure.bg} = ${figure.ratio.toFixed(2)}:1 — a figure nobody can ` +
      `read is a number a coordinator will guess at`,
  ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
});
