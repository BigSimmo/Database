import { expect, test } from "playwright/test";

import { blockExternalRequests, gotoPhoneSurface, phoneViewport } from "./helpers/phone-scroll";

/**
 * Phone geometry for the document viewer's "Tables and diagrams" rail.
 *
 * The defect this guards: the rail `<aside>` had no base `grid-cols-*`, so below
 * `md` it used an implicit `grid-auto-columns: auto` track sized by its items'
 * min-content. A wide table crop's aspect-ratio frame (whose `min-h-40`
 * transferred into an implied *minimum width*) stretched that single track, and
 * every card in the rail inherited the blown-out width — measured 560px inside a
 * 393px viewport.
 *
 * **Why this file exists rather than another `expectNoPageHorizontalOverflow`
 * call.** That shared helper measures `documentElement.scrollWidth - clientWidth`,
 * and `html`/`body` both set `overflow-x: clip` (globals.css:682, :715). Clipped
 * overflow does not extend scrollWidth, so the helper is *structurally incapable*
 * of reporting this class of bug — it passed on every run while the rail was well
 * over twice the viewport width. Catching it requires measuring each element's
 * own box against the viewport, which is what this spec does.
 */

// The clozapine demo document owns the 1520x720 (2.11:1) clinical table crop —
// wide enough that the pre-fix implied minimum width (160px x 2.11 = 338px)
// exceeded the ~289px the phone card actually has.
const WIDE_TABLE_DOC_ID = "22222222-2222-4222-8222-222222222222";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("document rail cards stay inside the phone viewport", async ({ page }) => {
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, `/documents/${WIDE_TABLE_DOC_ID}`);

  const images = page.locator("#source-images");
  await expect(images).toBeVisible({ timeout: 20_000 });
  await images.locator("summary").first().click();
  await expect(images).toHaveJSProperty("open", true);

  const figures = page.getByTestId("document-image");
  await expect(figures.first()).toBeVisible({ timeout: 20_000 });

  const overflow = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const measure = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { right: rect.right, left: rect.left, width: rect.width };
    };
    return {
      viewport,
      // Per-element geometry: the only measurement that can see clipped overflow.
      figures: [...document.querySelectorAll('[data-testid="document-image"]')].map(measure),
      rail: measure(document.querySelector("#source-images")!),
      // The blind check, asserted deliberately so nobody later "strengthens" this
      // spec by replacing the per-element assertions with it.
      documentOverflow: document.documentElement.scrollWidth - viewport,
    };
  });

  expect(overflow.figures.length).toBeGreaterThan(0);
  expect(
    overflow.rail.right,
    "the rail section itself must not exceed the viewport — that is the blown-out grid track",
  ).toBeLessThanOrEqual(overflow.viewport + 1);

  for (const [index, figure] of overflow.figures.entries()) {
    expect(
      figure.right,
      `document image ${index} runs past the right edge; its content is clipped and unreachable`,
    ).toBeLessThanOrEqual(overflow.viewport + 1);
    expect(figure.left, `document image ${index} is pushed off the left edge`).toBeGreaterThanOrEqual(-1);
    expect(figure.width, `document image ${index} is wider than the screen`).toBeLessThanOrEqual(overflow.viewport + 1);
  }

  // Passes both before and after the fix — recorded so the limitation is visible
  // in the test output rather than rediscovered by the next person.
  expect(overflow.documentOverflow).toBeLessThanOrEqual(2);
});

test("wide table crops offer a visible full-screen route on touch", async ({ page }) => {
  await page.setViewportSize(phoneViewport);
  await gotoPhoneSurface(page, `/documents/${WIDE_TABLE_DOC_ID}`);

  const images = page.locator("#source-images");
  await expect(images).toBeVisible({ timeout: 20_000 });
  await images.locator("summary").first().click();
  await expect(images).toHaveJSProperty("open", true);

  // Structured table extraction leads; the source image (and its expand control)
  // lives behind "Show original table image". Open that disclosure before the
  // labelled full-screen route can be found.
  const originalDetails = page.locator("#source-images details").filter({
    hasText: "Show original table image",
  });
  await expect(originalDetails).toHaveCount(1, { timeout: 20_000 });
  await originalDetails.locator("summary").click();
  await expect(originalDetails).toHaveJSProperty("open", true);

  // The inline card cannot render a wide table legibly at any faithful size, so
  // the labelled route to the viewer is the affordance that matters — and it must
  // not depend on a hover that a phone cannot produce. Threshold is ≥2.1 so the
  // real clozapine demo crop (1520×720 ≈ 2.11:1) qualifies.
  const expand = page.getByTestId("signed-image-expand").first();
  await expect(expand).toBeVisible({ timeout: 20_000 });
  // The labelled control stays disabled until the deferred signed image loads.
  await expect(expand).toBeEnabled({ timeout: 20_000 });

  const box = await expand.boundingBox();
  expect(box, "expand control must be laid out").not.toBeNull();
  // Production tap target (48px), not the 44px generic a11y figure — see AGENTS.md.
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await expand.click();
  const lightbox = page.getByTestId("image-lightbox");
  await expect(lightbox).toBeVisible();

  // Controls belong to the sheet footer, so they clear the home indicator and stop
  // covering the bottom rows of the table.
  const controls = page.getByRole("button", { name: "Rotate image 90 degrees" });
  await expect(controls).toBeVisible();
  const controlsBox = await controls.boundingBox();
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(phoneViewport.height + 1);

  // Rotation must re-fit rather than overflow the stage — the pure-transform bug.
  await controls.click();
  const fits = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="image-lightbox-stage"]')!;
    const image = stage.querySelector("img");
    if (!image) return null;
    const s = stage.getBoundingClientRect();
    const i = image.getBoundingClientRect();
    return { overflowX: i.width - s.width, overflowY: i.height - s.height, transform: image.style.transform };
  });
  expect(fits).not.toBeNull();
  expect(fits!.transform).toContain("rotate(90deg)");
  expect(fits!.transform).not.toContain("NaN");
  expect(fits!.overflowX, "a rotated crop must re-fit the stage, not spill out of it").toBeLessThanOrEqual(1);
  expect(fits!.overflowY, "a rotated crop must re-fit the stage, not spill out of it").toBeLessThanOrEqual(1);
});
