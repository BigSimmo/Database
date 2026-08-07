import { describe, expect, it } from "vitest";

import {
  clampViewerZoom,
  resolveViewerZoomUpdate,
  VIEWER_DEFAULT_ZOOM,
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
} from "@/components/document-viewer/viewer-zoom";

describe("viewer-zoom", () => {
  it("clamps absolute zoom into the shared viewer range", () => {
    expect(clampViewerZoom(0)).toBe(VIEWER_MIN_ZOOM);
    expect(clampViewerZoom(99)).toBe(VIEWER_MAX_ZOOM);
    expect(clampViewerZoom(VIEWER_DEFAULT_ZOOM)).toBe(VIEWER_DEFAULT_ZOOM);
  });

  it("composes rapid functional zoom updates against an evolving current", () => {
    let zoom = 1;
    zoom = resolveViewerZoomUpdate(zoom, (current) => Number((current * 1.1).toFixed(3)));
    zoom = resolveViewerZoomUpdate(zoom, (current) => Number((current * 1.1).toFixed(3)));
    zoom = resolveViewerZoomUpdate(zoom, (current) => Number((current * 1.1).toFixed(3)));
    expect(zoom).toBe(Number((1 * 1.1 * 1.1 * 1.1).toFixed(3)));
  });

  it("applies absolute updates without dropping the previous composed value", () => {
    expect(resolveViewerZoomUpdate(1.2, 1.5)).toBe(1.5);
    expect(resolveViewerZoomUpdate(1.2, VIEWER_MAX_ZOOM + 1)).toBe(VIEWER_MAX_ZOOM);
  });
});
