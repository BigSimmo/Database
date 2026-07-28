export const pdfViewerModeStorageKey = "clinical-kb:pdf-viewer-mode";
export const pdfViewerNativeModeBreakpoint = 820;
export const pdfViewerModeValue = {
  native: "native",
  canvas: "canvas",
} as const;
export const pdfViewerModeNativeValue = pdfViewerModeValue.native;

export function getDefaultPdfViewerMode(): boolean {
  return false;
}

export function getInitialPdfViewerMode() {
  if (typeof window === "undefined") {
    return {
      useNativePdfViewer: getDefaultPdfViewerMode(),
      hasExplicitPdfViewerMode: false,
    };
  }

  try {
    const savedMode = window.localStorage.getItem(pdfViewerModeStorageKey);
    if (savedMode === pdfViewerModeNativeValue) {
      return { useNativePdfViewer: true, hasExplicitPdfViewerMode: true };
    }

    if (savedMode === pdfViewerModeValue.canvas) {
      return { useNativePdfViewer: false, hasExplicitPdfViewerMode: true };
    }
  } catch {
    // window.localStorage may be unavailable in strict or private-browser contexts.
  }

  return {
    useNativePdfViewer: getDefaultPdfViewerMode(),
    hasExplicitPdfViewerMode: false,
  };
}
