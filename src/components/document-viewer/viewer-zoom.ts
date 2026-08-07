/**
 * Shared PDF/document viewing zoom contract (Phase 2a).
 * DocumentFrame controls and PdfCanvasViewer must use the same clamp/step so
 * Frame chrome and gesture/keyboard zoom stay aligned.
 */
export const VIEWER_MIN_ZOOM = 0.55;
export const VIEWER_MAX_ZOOM = 4;
export const VIEWER_ZOOM_STEP = 0.15;
export const VIEWER_DEFAULT_ZOOM = 1.1;

export function clampViewerZoom(value: number): number {
  return Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, value));
}
