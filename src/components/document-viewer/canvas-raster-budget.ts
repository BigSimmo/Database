/**
 * Canvas raster budget for the PDF page surface.
 *
 * WebKit refuses to back a canvas larger than roughly 2^24 device pixels: the
 * element keeps its layout box but paints nothing, so the reader sees a blank
 * page rather than a crisp one. There is no exception to catch and no event to
 * observe — the only defence is to never ask for a canvas that large.
 *
 * The viewer's own numbers reach that ceiling easily. An iPhone reports
 * `devicePixelRatio` 3, the raster used a flat `min(2.5, dpr)` output scale, and
 * `VIEWER_MAX_ZOOM` is 4, so an A4 page at maximum zoom asked for
 * 595·4·2.5 x 842·4·2.5 = about 50 megapixels — three times over. Zooming past
 * roughly 2.3x blanked the page on iOS.
 *
 * Degrade the output scale (raster density) rather than the viewport scale
 * (layout size), so a page that cannot be rendered at full device density is
 * merely softer, never blank and never a different size than the reader asked
 * for. The output scale is allowed below 1 in the extreme — a very large page
 * sheet at maximum zoom — because a soft page still reads and a blank one does
 * not.
 */

/** WebKit's per-canvas ceiling, in device pixels. */
export const MAX_CANVAS_PIXELS = 16_777_216;

/**
 * Document-wide ceiling for *retained* canvases, in device pixels.
 *
 * `MAX_CANVAS_PIXELS` bounds one canvas. Once the reader holds several pages
 * live at once, N individually-legal canvases can still exhaust device memory —
 * the per-canvas rule says nothing about how many of them exist. At four bytes
 * per pixel this budget is roughly 96 MB of backing store, which is the point of
 * it: the ceiling is on *total* retained raster, not on any single page.
 *
 * The interesting property is how it behaves against zoom rather than its exact
 * value. A fit-width phone page costs about 1.3 megapixels, so the budget is
 * never the binding constraint there and `MAX_RETAINED_CANVASES` is. A page at
 * maximum zoom costs the full per-canvas ceiling, so the budget collapses the
 * window to exactly one — render-ahead disappears precisely where retaining
 * neighbours would be most dangerous, without anyone having to special-case zoom.
 */
export const MAX_LIVE_CANVAS_PIXELS = 24_000_000;

/**
 * Hard cap on retained canvases regardless of how cheap each one is.
 *
 * A tiny page at low zoom would otherwise let the budget retain dozens, which is
 * memory spent on pages the reader is not looking at. This is the ceiling; the
 * render-ahead policy below is deliberately far more conservative than it.
 */
export const MAX_RETAINED_CANVASES = 5;

/** Never raster finer than this multiple of CSS pixels, whatever the display reports. */
export const MAX_RENDER_SCALE = 2.5;

/** Never collapse the backing store past this, however large the page. */
const MIN_OUTPUT_SCALE = 0.1;

export type CanvasRasterPlan = {
  /** Device-pixel multiplier to pass to `getViewport({ scale: viewportScale * outputScale })`. */
  outputScale: number;
  /** Backing-store dimensions, in device pixels. */
  width: number;
  height: number;
  /** True when the display's own density had to be given up to stay inside the budget. */
  budgetLimited: boolean;
};

/**
 * Resolve the raster density for one page render.
 *
 * `baseWidth`/`baseHeight` are the unscaled pdf.js viewport dimensions, and
 * `viewportScale` is the fit-or-zoom factor already chosen for layout.
 */
export function resolveCanvasRasterPlan({
  baseWidth,
  baseHeight,
  viewportScale,
  devicePixelRatio,
  maxRenderScale = MAX_RENDER_SCALE,
  maxCanvasPixels = MAX_CANVAS_PIXELS,
}: {
  baseWidth: number;
  baseHeight: number;
  viewportScale: number;
  devicePixelRatio: number;
  maxRenderScale?: number;
  maxCanvasPixels?: number;
}): CanvasRasterPlan {
  const cssWidth = Math.max(1, baseWidth * viewportScale);
  const cssHeight = Math.max(1, baseHeight * viewportScale);
  const cssArea = cssWidth * cssHeight;

  const preferred = Math.min(maxRenderScale, Math.max(1, devicePixelRatio || 1));
  const affordable = Math.sqrt(maxCanvasPixels / cssArea);
  const outputScale = Math.max(MIN_OUTPUT_SCALE, Math.min(preferred, affordable));

  return {
    outputScale,
    width: Math.floor(cssWidth * outputScale),
    height: Math.floor(cssHeight * outputScale),
    budgetLimited: affordable < preferred,
  };
}

/**
 * How many rendered canvases the document may retain at this raster size.
 *
 * `perCanvasPixels` is the backing-store area one page currently costs — take it
 * from `resolveCanvasRasterPlan` for the page geometry and scale actually in
 * use, not from a nominal page size, or the window will not tighten when the
 * reader zooms in.
 *
 * Returns at least 1: the page the reader is looking at is never optional.
 * An unmeasured or nonsensical size also returns 1, so a viewer that does not
 * yet know its page geometry renders the current page alone rather than
 * guessing a window it cannot afford.
 */
export function resolveLiveCanvasWindow({
  perCanvasPixels,
  maxLivePixels = MAX_LIVE_CANVAS_PIXELS,
  maxRetainedCanvases = MAX_RETAINED_CANVASES,
}: {
  perCanvasPixels: number;
  maxLivePixels?: number;
  maxRetainedCanvases?: number;
}): number {
  if (!Number.isFinite(perCanvasPixels) || perCanvasPixels <= 0) return 1;
  const affordable = Math.floor(maxLivePixels / perCanvasPixels);
  return Math.max(1, Math.min(maxRetainedCanvases, affordable));
}

/**
 * Which pages should hold a rendered canvas right now, most important first.
 *
 * ## Why this is deliberately timid
 *
 * The viewer opens its document with `disableAutoFetch` + `disableStream`
 * precisely so pdf.js stops pulling a whole guideline down in the background
 * when the reader only ever looks at one page — the wrong default on a phone, on
 * cellular. Rendering neighbours re-introduces exactly that fetch amplification,
 * one page at a time, so the policy is bounded on three independent axes:
 *
 * 1. **±1 page only.** Resident pages top out at three, never the document. The
 *    next page leads the previous one because readers move forward.
 * 2. **The memory budget can veto it.** `liveCanvasLimit` of 1 — which is what
 *    `resolveLiveCanvasWindow` returns at high zoom — returns the active page
 *    alone.
 * 3. **A constrained connection vetoes it.** Save-Data and 2g/slow-2g are the
 *    exact conditions `disableAutoFetch` was chosen for, so on those the viewer
 *    fetches nothing it was not asked for.
 *
 * The caller is additionally expected to defer the neighbour render to idle, so
 * a reader flipping quickly never pays for pages they have already left.
 */
export function resolveRenderAheadPages({
  activePage,
  totalPages,
  liveCanvasLimit,
  renderAhead = true,
  saveData = false,
  effectiveType,
}: {
  activePage: number;
  totalPages: number;
  liveCanvasLimit: number;
  /** False until the caller's idle callback has fired. */
  renderAhead?: boolean;
  saveData?: boolean;
  effectiveType?: string;
}): number[] {
  const lastPage = totalPages > 0 ? totalPages : activePage;
  const current = Math.min(Math.max(Math.trunc(activePage) || 1, 1), Math.max(lastPage, 1));
  if (!renderAhead || liveCanvasLimit <= 1 || saveData) return [current];
  if (effectiveType === "2g" || effectiveType === "slow-2g") return [current];

  const pages = [current];
  if (current + 1 <= lastPage) pages.push(current + 1);
  if (current - 1 >= 1) pages.push(current - 1);
  return pages.slice(0, liveCanvasLimit);
}
