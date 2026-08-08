import { describe, expect, it } from "vitest";

import {
  MAX_CANVAS_PIXELS,
  MAX_RENDER_SCALE,
  resolveCanvasRasterPlan,
} from "@/components/document-viewer/canvas-raster-budget";
import { VIEWER_MAX_ZOOM } from "@/components/document-viewer/viewer-zoom";

// A4 at pdf.js scale 1, in points.
const A4 = { baseWidth: 595, baseHeight: 842 };
const IPHONE_DPR = 3;

describe("canvas raster budget", () => {
  it("keeps an A4 page at maximum zoom on an iPhone inside WebKit's canvas ceiling", () => {
    // The regression: a flat min(2.5, dpr) output scale asked for ~50 megapixels
    // here, and WebKit painted nothing at all above ~2^24.
    const naivePixels =
      A4.baseWidth * VIEWER_MAX_ZOOM * MAX_RENDER_SCALE * A4.baseHeight * VIEWER_MAX_ZOOM * MAX_RENDER_SCALE;
    expect(naivePixels).toBeGreaterThan(MAX_CANVAS_PIXELS);

    const plan = resolveCanvasRasterPlan({
      ...A4,
      viewportScale: VIEWER_MAX_ZOOM,
      devicePixelRatio: IPHONE_DPR,
    });

    expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(plan.budgetLimited).toBe(true);
    // Still a real raster, not a collapsed one.
    expect(plan.width).toBeGreaterThan(0);
    expect(plan.height).toBeGreaterThan(0);
  });

  it("degrades raster density, never the layout scale the reader asked for", () => {
    const viewportScale = VIEWER_MAX_ZOOM;
    const plan = resolveCanvasRasterPlan({ ...A4, viewportScale, devicePixelRatio: IPHONE_DPR });

    // width/height are the backing store; the CSS size stays baseWidth * viewportScale.
    // Compare within a pixel, since the backing store is floored to whole pixels.
    expect(plan.width).toBeCloseTo(A4.baseWidth * viewportScale * plan.outputScale, -0.5);
    expect(plan.height).toBeCloseTo(A4.baseHeight * viewportScale * plan.outputScale, -0.5);
    expect(plan.outputScale).toBeLessThan(MAX_RENDER_SCALE);
  });

  it("uses full device density whenever it fits", () => {
    const plan = resolveCanvasRasterPlan({ ...A4, viewportScale: 1, devicePixelRatio: IPHONE_DPR });

    expect(plan.outputScale).toBe(MAX_RENDER_SCALE);
    expect(plan.budgetLimited).toBe(false);
    expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it("never rasters below one device pixel per CSS pixel while the budget allows it", () => {
    const plan = resolveCanvasRasterPlan({ ...A4, viewportScale: 1, devicePixelRatio: 0 });

    expect(plan.outputScale).toBe(1);
  });

  it("keeps an oversized page sheet visible instead of blank", () => {
    // A0 at maximum zoom cannot be rendered at CSS resolution inside the budget.
    // A soft page still reads; a blank one does not.
    const plan = resolveCanvasRasterPlan({
      baseWidth: 2384,
      baseHeight: 3370,
      viewportScale: VIEWER_MAX_ZOOM,
      devicePixelRatio: IPHONE_DPR,
    });

    expect(plan.outputScale).toBeLessThan(1);
    expect(plan.outputScale).toBeGreaterThan(0);
    expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it("stays inside the budget across the whole supported zoom range and common densities", () => {
    for (const devicePixelRatio of [1, 2, 3, 4]) {
      for (let viewportScale = 0.5; viewportScale <= VIEWER_MAX_ZOOM; viewportScale += 0.25) {
        const plan = resolveCanvasRasterPlan({ ...A4, viewportScale, devicePixelRatio });
        expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
      }
    }
  });
});
