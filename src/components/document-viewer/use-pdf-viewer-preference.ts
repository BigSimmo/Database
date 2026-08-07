"use client";

import { useEffect, useState } from "react";

import {
  getDefaultPdfViewerMode,
  getInitialPdfViewerMode,
  pdfViewerModeNativeValue,
  pdfViewerModeStorageKey,
  pdfViewerModeValue,
  pdfViewerNativeModeBreakpoint,
} from "@/components/document-viewer/pdf-viewer-mode";

/**
 * Canvas vs native PDF preference: localStorage + responsive default when the
 * clinician has not explicitly chosen a mode.
 */
export function usePdfViewerPreference() {
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(getDefaultPdfViewerMode);
  const [hasExplicitPdfViewerMode, setHasExplicitPdfViewerMode] = useState(false);
  const [viewerModeInitialized, setViewerModeInitialized] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const initialMode = getInitialPdfViewerMode();
      setUseNativePdfViewer(initialMode.useNativePdfViewer);
      setHasExplicitPdfViewerMode(initialMode.hasExplicitPdfViewerMode);
      setViewerModeInitialized(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !viewerModeInitialized || hasExplicitPdfViewerMode) return;

    const syncDefaultViewerMode = () => {
      setUseNativePdfViewer(getDefaultPdfViewerMode());
    };

    const smallScreen = window.matchMedia(`(max-width: ${pdfViewerNativeModeBreakpoint}px)`);

    const syncFrame = window.requestAnimationFrame(syncDefaultViewerMode);
    smallScreen.addEventListener("change", syncDefaultViewerMode);

    return () => {
      window.cancelAnimationFrame(syncFrame);
      smallScreen.removeEventListener("change", syncDefaultViewerMode);
    };
  }, [viewerModeInitialized, hasExplicitPdfViewerMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== pdfViewerModeStorageKey || !event.newValue) return;
      if (event.newValue === pdfViewerModeValue.native) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(true);
      } else if (event.newValue === pdfViewerModeValue.canvas) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(false);
      }
    };

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  useEffect(() => {
    if (!viewerModeInitialized || !hasExplicitPdfViewerMode) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        pdfViewerModeStorageKey,
        useNativePdfViewer ? pdfViewerModeNativeValue : pdfViewerModeValue.canvas,
      );
    } catch {
      // localStorage can be unavailable in hardened browsers/private mode.
    }
  }, [useNativePdfViewer, viewerModeInitialized, hasExplicitPdfViewerMode]);

  const togglePdfViewerMode = () => {
    setHasExplicitPdfViewerMode(true);
    setUseNativePdfViewer((current) => !current);
  };

  return {
    useNativePdfViewer,
    setUseNativePdfViewer,
    hasExplicitPdfViewerMode,
    setHasExplicitPdfViewerMode,
    viewerModeInitialized,
    togglePdfViewerMode,
  };
}
