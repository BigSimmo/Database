import { expect, test, type Locator, type Page } from "playwright/test";

import { blockExternalRequests } from "./helpers/phone-scroll";

/**
 * Browser gate for the PDF reader's raster surface.
 *
 * Everything else about the viewer is provable offline: the raster budget is a
 * pure function with unit tests, the gestures and keyboard bindings have DOM
 * tests, and the lazy boundary has a static contract. The one thing none of
 * those can see is whether a clinical source page **actually paints** — a canvas
 * that stays blank still has correct dimensions, a correct `aria-label`, and a
 * resolved render promise. A reader looking at a blank page and a reader looking
 * at the wrong page are both clinical failures, so they need a gate that reads
 * pixels back.
 *
 * ## Why this skips in some containers, and why that is not a silent green
 *
 * `pdfjs-dist@6` calls `Map.prototype.getOrInsertComputed` (a 2026 TC39
 * addition) from its core rendering path. That method ships in Chromium 151 —
 * which is what CI runs (`HeadlessChrome/151.0.0.0`, recorded in
 * `lighthouse-budget.json`) and what this repository's pinned Playwright build
 * carries (`playwright-core/browsers.json` revision 1234 → 151.0.7922.34). Some
 * sandboxed containers pre-bake an OLDER browser and pin lookup to it with
 * `PLAYWRIGHT_BROWSERS_PATH`, so pdf.js dies there with
 * `getOrInsertComputed is not a function` before a single pixel is drawn. That
 * is a property of the container, not of the product (ledger `#279`).
 *
 * The guard below therefore does two different things depending on where it
 * runs, and the asymmetry is the whole point:
 *
 * - **Locally, without `CI`:** skip, with a reason naming the browser version.
 * - **In CI:** a missing engine feature **fails**. A gate that can quietly skip
 *   itself on the machine that gates the merge is worse than no gate at all.
 *
 * Do not "fix" a local skip by bumping the pinned Playwright build, pinning
 * `pdfjs-dist` down, or running `playwright install` — all three were measured
 * and refuted on 2026-08-09. Run it on a host with the pinned browser instead:
 *
 *     npm ci --include=dev && npx playwright install chromium
 *     npm run ensure
 *     npm run test:e2e -- tests/ui-document-canvas.spec.ts --project=chromium
 */

// The 2-page demo document: page 1 is the monitoring protocol text, page 2 is
// the embedded-image evidence page. Two visibly different pages is what makes
// "a page flip changed the raster" a real assertion rather than a tautology.
const CANVAS_DOCUMENT = "/documents/22222222-2222-4222-8222-222222222222?page=1";

type CanvasReading = {
  readonly width: number;
  readonly height: number;
  readonly sampled: number;
  readonly inkPixels: number;
  readonly signature: number;
};

/**
 * Read a canvas back as pixels.
 *
 * `inkPixels` counts samples darker than a near-white threshold on any channel —
 * a painted clinical page is mostly white paper with dark type, so ink is the
 * signal that separates "rendered" from "blank" and from "cleared to white".
 * `signature` is an order-sensitive FNV-style rolling hash over the same
 * samples, which is what makes two different pages distinguishable without
 * committing a pixel baseline (this is a behaviour gate, not a visual one).
 *
 * The sample grid is capped so a 4x-zoomed backing store does not turn a single
 * assertion into a multi-second `getImageData` walk.
 */
async function readCanvas(canvas: Locator): Promise<CanvasReading> {
  return canvas.evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) {
      throw new Error("expected an HTMLCanvasElement");
    }
    const context = node.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("could not acquire a 2d context to read the raster back");

    const width = node.width;
    const height = node.height;
    if (width === 0 || height === 0) {
      return { width, height, sampled: 0, inkPixels: 0, signature: 0 };
    }

    const stepX = Math.max(1, Math.floor(width / 240));
    const stepY = Math.max(1, Math.floor(height / 240));
    const { data } = context.getImageData(0, 0, width, height);

    let inkPixels = 0;
    let sampled = 0;
    // FNV-1a over the sampled channel bytes. `>>> 0` after each step keeps it in
    // uint32 so the value is stable and comparable across runs.
    let signature = 0x811c9dc5;
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const alpha = data[offset + 3];
        sampled += 1;
        if (alpha > 16 && (r < 240 || g < 240 || b < 240)) inkPixels += 1;
        for (const channel of [r, g, b, alpha]) {
          signature = (signature ^ channel) >>> 0;
          signature = Math.imul(signature, 0x01000193) >>> 0;
        }
      }
    }

    return { width, height, sampled, inkPixels, signature };
  });
}

/**
 * Fail in CI, skip with a reason anywhere else, when the browser cannot run
 * pdf.js 6 at all. Never returns quietly on an unsupported engine.
 */
async function requirePdfRasterEngine(page: Page): Promise<void> {
  const supported = await page.evaluate(
    () => typeof (Map.prototype as unknown as Record<string, unknown>).getOrInsertComputed === "function",
  );
  if (supported) return;

  const version = page.context().browser()?.version() ?? "unknown";
  const reason =
    `This browser (${version}) has no Map.prototype.getOrInsertComputed, which pdfjs-dist@6 calls from its ` +
    "render path, so no page can raster here. CI and the pinned Playwright build (browsers.json revision 1234, " +
    "Chromium 151.0.7922.34) both have it. Run this spec against the pinned browser rather than weakening it — " +
    "see the file header and ledger #279.";

  // In CI a missing engine feature is a real failure: the merge gate must never
  // be able to skip itself green.
  expect(
    Boolean(process.env.CI),
    `${reason} Refusing to skip because CI is set — this is the environment the gate exists to protect.`,
  ).toBe(false);

  test.skip(true, reason);
}

/** Open the document route and settle the reader's first page. */
async function openCanvasDocument(page: Page): Promise<Locator> {
  await page.goto(CANVAS_DOCUMENT, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 20_000 });
  await requirePdfRasterEngine(page);

  const holder = page.locator('[data-testid="pdf-canvas-scroll"]:visible').first();
  await expect(holder).toBeVisible({ timeout: 20_000 });
  return holder;
}

/** Wait until a page's canvas exists and has actually been painted. */
async function waitForPaintedPage(holder: Locator, pageNumber: number): Promise<CanvasReading> {
  const canvas = holder.locator(`canvas[aria-label$="page ${pageNumber}"]`);
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => (await readCanvas(canvas)).inkPixels, {
      timeout: 20_000,
      message: `page ${pageNumber} never painted any ink into its canvas`,
    })
    .toBeGreaterThan(0);
  return readCanvas(canvas);
}

test.beforeEach(async ({ page, browserName }) => {
  // Chromium-only, in the same spirit as the focused PWA suite: the engine
  // feature pdf.js 6 needs is not what this gate exists to test, and a red
  // weekly Firefox/WebKit matrix would say nothing about the viewer.
  test.skip(browserName !== "chromium", "The viewer-canvas raster gate runs on the pinned Chromium build.");
  await blockExternalRequests(page);
});

test.describe("document viewer canvas", () => {
  test("rasters a clinical source page rather than leaving the canvas blank", async ({ page }) => {
    const holder = await openCanvasDocument(page);
    const firstPage = await waitForPaintedPage(holder, 1);

    expect(firstPage.width, "the canvas has no backing store, so nothing can have been painted").toBeGreaterThan(0);
    expect(firstPage.height, "the canvas has no backing store, so nothing can have been painted").toBeGreaterThan(0);
    // A rendered A4 text page covers far more than this; the floor only has to
    // separate "painted" from "blank" and from "cleared to white".
    expect(
      firstPage.inkPixels,
      `page 1 sampled ${firstPage.sampled} pixels and found ${firstPage.inkPixels} of ink — the reader is looking at a blank page`,
    ).toBeGreaterThan(20);
  });

  test("reports the document's real page count in the one toolbar readout", async ({ page }) => {
    await openCanvasDocument(page);

    // pdf.js is authoritative for the count; the indexed metadata is only a
    // fallback. Both say 2 for this fixture, so a wrong number here means the
    // reader is being told the document is a different length than it is.
    await expect(page.getByText("/ 2").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Page number").first()).toHaveValue("1");
  });

  test("a page flip paints a different page", async ({ page }) => {
    const holder = await openCanvasDocument(page);
    const firstPage = await waitForPaintedPage(holder, 1);

    // Capture long tasks across the flip. This is the measurement Phase 3 owes
    // for the OffscreenCanvas decision (`docs/plans/document-viewer-phase3-handover.md`
    // Task 5): the question is whether main-thread raster cost is large enough
    // to justify moving it to a worker, and this is the only place in the repo
    // where a real browser rasters a real page. Reported, never asserted on —
    // a timing threshold in a blocking gate is a flake generator.
    await page.evaluate(() => {
      const store: number[] = [];
      (window as unknown as Record<string, unknown>).__viewerLongTasks = store;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) store.push(entry.duration);
        }).observe({ type: "longtask", buffered: false });
      } catch {
        // Long-task observation is best-effort; its absence must not fail the gate.
      }
    });

    const flipStartedAt = Date.now();
    await page.getByLabel("Next page").first().click();

    const secondPage = await waitForPaintedPage(holder, 2);
    const flipMs = Date.now() - flipStartedAt;

    expect(
      secondPage.inkPixels,
      `page 2 sampled ${secondPage.sampled} pixels and found ${secondPage.inkPixels} of ink — the flip landed on a blank page`,
    ).toBeGreaterThan(20);
    expect(
      secondPage.signature,
      "page 2 rasterised to the same pixels as page 1 — the flip changed the label but not the raster",
    ).not.toBe(firstPage.signature);

    // The route must follow the reader, without remounting pdf.js.
    await expect(page.getByLabel("Page number").first()).toHaveValue("2");
    expect(new URL(page.url()).searchParams.get("page")).toBe("2");

    const longTasks = await page.evaluate(
      () => ((window as unknown as Record<string, unknown>).__viewerLongTasks as number[] | undefined) ?? [],
    );
    const longTaskMs = longTasks.reduce((total, duration) => total + duration, 0);
    await test.info().attach("page-flip-raster-cost.json", {
      contentType: "application/json",
      body: Buffer.from(
        JSON.stringify(
          {
            note: "Task 5 input: main-thread cost of one page flip. Advisory measurement, never asserted on.",
            flipToPaintedMs: flipMs,
            longTaskCount: longTasks.length,
            longTaskTotalMs: Math.round(longTaskMs),
            longestTaskMs: Math.round(Math.max(0, ...longTasks)),
            canvasBackingPixels: secondPage.width * secondPage.height,
          },
          null,
          2,
        ),
      ),
    });
    // Surfaced in the run log too, so the number is readable without downloading
    // the artifact.
    console.log(
      `[viewer-canvas] page flip painted in ${flipMs}ms; ${longTasks.length} long task(s) totalling ${Math.round(longTaskMs)}ms`,
    );
  });
});
