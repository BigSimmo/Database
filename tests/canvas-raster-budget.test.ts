import { describe, expect, it } from "vitest";

import {
  MAX_CANVAS_PIXELS,
  MAX_LIVE_CANVAS_PIXELS,
  MAX_RENDER_SCALE,
  MAX_RETAINED_CANVASES,
  resolveCanvasRasterPlan,
  resolveLiveCanvasWindow,
  resolveRenderAheadPages,
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

describe("document-wide live canvas window", () => {
  /** The pixels one page actually costs at a given layout scale and density. */
  const pageCost = (viewportScale: number, devicePixelRatio: number) => {
    const plan = resolveCanvasRasterPlan({ ...A4, viewportScale, devicePixelRatio });
    return plan.width * plan.height;
  };

  it("never drops the page the reader is looking at, however expensive it is", () => {
    // A page at maximum zoom costs the entire per-canvas ceiling on its own.
    const window = resolveLiveCanvasWindow({ perCanvasPixels: MAX_CANVAS_PIXELS });

    expect(window).toBe(1);
  });

  it("collapses to the current page alone at maximum zoom, so render-ahead cannot stack canvases", () => {
    // This is the property the per-canvas budget cannot express: three
    // individually legal canvases at this size are 200MB of backing store.
    const perCanvasPixels = pageCost(VIEWER_MAX_ZOOM, IPHONE_DPR);

    expect(perCanvasPixels * 3).toBeGreaterThan(MAX_LIVE_CANVAS_PIXELS);
    expect(resolveLiveCanvasWindow({ perCanvasPixels })).toBe(1);
  });

  it("affords render-ahead at the fit-width sizes a phone actually reads at", () => {
    // A phone page in fit mode: ~390 CSS px wide, so scale ~0.65 on an A4 sheet.
    const perCanvasPixels = pageCost(0.65, IPHONE_DPR);

    expect(perCanvasPixels * 3).toBeLessThan(MAX_LIVE_CANVAS_PIXELS);
    expect(resolveLiveCanvasWindow({ perCanvasPixels })).toBeGreaterThanOrEqual(3);
  });

  it("caps retention even when each canvas is nearly free", () => {
    expect(resolveLiveCanvasWindow({ perCanvasPixels: 1 })).toBe(MAX_RETAINED_CANVASES);
  });

  it("renders the current page alone while the page size is still unknown", () => {
    // Before any page has rendered there is nothing to size a window from, and
    // guessing one would commit memory the viewer has not measured.
    for (const perCanvasPixels of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveLiveCanvasWindow({ perCanvasPixels })).toBe(1);
    }
  });

  it("tightens monotonically as the reader zooms in", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let viewportScale = 0.5; viewportScale <= VIEWER_MAX_ZOOM; viewportScale += 0.25) {
      const window = resolveLiveCanvasWindow({ perCanvasPixels: pageCost(viewportScale, IPHONE_DPR) });
      expect(window).toBeLessThanOrEqual(previous);
      previous = window;
    }
    expect(previous).toBe(1);
  });
});

describe("render-ahead policy", () => {
  const base = { activePage: 5, totalPages: 40, liveCanvasLimit: 3 };

  it("reads one page ahead and one behind, forward first", () => {
    expect(resolveRenderAheadPages(base)).toEqual([5, 6, 4]);
  });

  it("renders nothing beyond the current page until the caller reaches idle", () => {
    // A reader flipping quickly never reaches idle, so they never pay to raster
    // the pages they are passing through.
    expect(resolveRenderAheadPages({ ...base, renderAhead: false })).toEqual([5]);
  });

  it("lets the memory budget veto render-ahead outright", () => {
    expect(resolveRenderAheadPages({ ...base, liveCanvasLimit: 1 })).toEqual([5]);
  });

  it("obeys a smaller budget than the policy wants", () => {
    expect(resolveRenderAheadPages({ ...base, liveCanvasLimit: 2 })).toEqual([5, 6]);
  });

  it("fetches nothing it was not asked for under Save-Data or a 2g connection", () => {
    // These are the exact conditions `disableAutoFetch` was chosen for. Reading
    // ahead there would re-introduce the fetch amplification that flag prevents.
    expect(resolveRenderAheadPages({ ...base, saveData: true })).toEqual([5]);
    expect(resolveRenderAheadPages({ ...base, effectiveType: "2g" })).toEqual([5]);
    expect(resolveRenderAheadPages({ ...base, effectiveType: "slow-2g" })).toEqual([5]);
    // A healthy connection is not vetoed.
    expect(resolveRenderAheadPages({ ...base, effectiveType: "4g" })).toEqual([5, 6, 4]);
  });

  it("never reads past either end of the document", () => {
    expect(resolveRenderAheadPages({ ...base, activePage: 1 })).toEqual([1, 2]);
    expect(resolveRenderAheadPages({ ...base, activePage: 40 })).toEqual([40, 39]);
    expect(resolveRenderAheadPages({ ...base, activePage: 1, totalPages: 1 })).toEqual([1]);
  });

  it("clamps an out-of-range or malformed active page onto the document", () => {
    expect(resolveRenderAheadPages({ ...base, activePage: 999 })).toEqual([40, 39]);
    expect(resolveRenderAheadPages({ ...base, activePage: 0 })).toEqual([1, 2]);
    expect(resolveRenderAheadPages({ ...base, activePage: -3 })).toEqual([1, 2]);
  });

  it("keeps the reader's page first so the caller can prioritise it", () => {
    for (const activePage of [1, 2, 20, 39, 40]) {
      expect(resolveRenderAheadPages({ ...base, activePage })[0]).toBe(activePage);
    }
  });

  it("never exceeds the live-canvas ceiling it was given", () => {
    for (let liveCanvasLimit = 1; liveCanvasLimit <= MAX_RETAINED_CANVASES; liveCanvasLimit += 1) {
      const pages = resolveRenderAheadPages({ ...base, liveCanvasLimit });
      expect(pages.length).toBeLessThanOrEqual(liveCanvasLimit);
      expect(new Set(pages).size).toBe(pages.length);
    }
  });
});
