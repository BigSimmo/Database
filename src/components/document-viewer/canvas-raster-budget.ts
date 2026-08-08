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
