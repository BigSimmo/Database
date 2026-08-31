"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";

interface MobileKeyboardContextState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
}

const MobileKeyboardContext = createContext<MobileKeyboardContextState>({
  isKeyboardOpen: false,
  keyboardHeight: 0,
});

const keyboardDetectionThreshold = 150;
const keyboardOverlayThreshold = 50;
/** Visual growth past the orientation-change occluded height that means the keyboard is closing. */
const deferredKeyboardCloseGrowth = 48;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function resolveMobileKeyboardViewport(args: {
  maxVisualHeight: number;
  currentVisualHeight: number;
  maxLayoutHeight: number;
  currentLayoutHeight: number;
  /** Only lift when a text field is focused — avoids headless/CI viewport false positives. */
  hasEditableFocus?: boolean;
}): MobileKeyboardContextState {
  if (args.hasEditableFocus === false) {
    return { isKeyboardOpen: false, keyboardHeight: 0 };
  }

  const visualOcclusion = Math.max(0, args.maxVisualHeight - args.currentVisualHeight);
  if (visualOcclusion <= keyboardDetectionThreshold) return { isKeyboardOpen: false, keyboardHeight: 0 };

  // With interactive-widget=resizes-content, the layout and visual viewports
  // shrink together, so fixed chrome already sits above the keyboard. Only the
  // residual visual-only shrink needs a CSS lift on overlay/fallback browsers.
  const layoutResize = Math.max(0, args.maxLayoutHeight - args.currentLayoutHeight);
  const overlayHeight = Math.max(0, Math.round(visualOcclusion - layoutResize));
  return {
    isKeyboardOpen: true,
    keyboardHeight: overlayHeight > keyboardOverlayThreshold ? overlayHeight : 0,
  };
}

export type MobileKeyboardBaseline = {
  maxVisualHeight: number;
  maxLayoutHeight: number;
};

export type MobileKeyboardBaselineResolution = MobileKeyboardBaseline & {
  pendingOrientationRebase: boolean;
  deferredOccludedVisualHeight: number | null;
};

/**
 * Orientation / breakpoint width changes must not adopt an already-occluded
 * viewport as the new unobstructed baseline while the keyboard is open.
 * Prefer a stored baseline for the new width; otherwise carry the prior
 * occlusion into the new orientation and finish the rebase once the keyboard
 * closes (visual height grows past the deferred occluded height).
 */
export function resolveMobileKeyboardBaselines(args: {
  widthChanged: boolean;
  hasEditableFocus: boolean;
  keyboardWasOpen: boolean;
  pendingOrientationRebase: boolean;
  currentVisualHeight: number;
  currentLayoutHeight: number;
  previousVisualHeight: number;
  previousLayoutHeight: number;
  maxVisualHeight: number;
  maxLayoutHeight: number;
  storedBaseline?: MobileKeyboardBaseline | null;
  deferredOccludedVisualHeight?: number | null;
}): MobileKeyboardBaselineResolution {
  const grow = {
    maxVisualHeight: Math.max(args.maxVisualHeight, args.currentVisualHeight),
    maxLayoutHeight: Math.max(args.maxLayoutHeight, args.currentLayoutHeight),
  };

  if (!args.widthChanged) {
    if (
      args.pendingOrientationRebase &&
      args.deferredOccludedVisualHeight != null &&
      args.currentVisualHeight > args.deferredOccludedVisualHeight + deferredKeyboardCloseGrowth
    ) {
      return {
        maxVisualHeight: args.currentVisualHeight,
        maxLayoutHeight: args.currentLayoutHeight,
        pendingOrientationRebase: false,
        deferredOccludedVisualHeight: null,
      };
    }

    return {
      ...grow,
      pendingOrientationRebase: args.pendingOrientationRebase,
      deferredOccludedVisualHeight: args.deferredOccludedVisualHeight ?? null,
    };
  }

  if (args.storedBaseline) {
    return {
      maxVisualHeight: Math.max(args.storedBaseline.maxVisualHeight, args.currentVisualHeight),
      maxLayoutHeight: Math.max(args.storedBaseline.maxLayoutHeight, args.currentLayoutHeight),
      pendingOrientationRebase: false,
      deferredOccludedVisualHeight: null,
    };
  }

  if (args.hasEditableFocus && args.keyboardWasOpen) {
    // Carry the previous occlusion into the new orientation instead of treating
    // the already-shrunken viewport as the unobstructed baseline.
    const priorVisualOcclusion = Math.max(0, args.maxVisualHeight - args.previousVisualHeight);
    const priorLayoutOcclusion = Math.max(0, args.maxLayoutHeight - args.previousLayoutHeight);
    return {
      maxVisualHeight: args.currentVisualHeight + priorVisualOcclusion,
      maxLayoutHeight: args.currentLayoutHeight + priorLayoutOcclusion,
      pendingOrientationRebase: true,
      deferredOccludedVisualHeight: args.currentVisualHeight,
    };
  }

  return {
    maxVisualHeight: args.currentVisualHeight,
    maxLayoutHeight: args.currentLayoutHeight,
    pendingOrientationRebase: false,
    deferredOccludedVisualHeight: null,
  };
}

/**
 * Global provider for mobile keyboard viewport state.
 * Syncs the virtual keyboard height (visual viewport vs layout viewport discrepancy)
 * to a CSS variable `--keyboard-height` and exposes it via context.
 */
export function MobileKeyboardProvider({ children }: { children: ReactNode }) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    // Track the maximum viewport height to detect when the keyboard shrinks the viewport
    let maxViewportHeight = window.visualViewport.height;
    let maxLayoutHeight = window.innerHeight;
    let prevViewportWidth = window.visualViewport.width;
    let prevViewportHeight = window.visualViewport.height;
    let prevLayoutHeight = window.innerHeight;
    let prevIsMobile = window.matchMedia("(max-width: 1023px)").matches;
    let keyboardWasOpen = false;
    let pendingOrientationRebase = false;
    let deferredOccludedVisualHeight: number | null = null;
    const baselinesByWidth = new Map<number, MobileKeyboardBaseline>();

    function applyKeyboardState(next: MobileKeyboardContextState) {
      keyboardWasOpen = next.isKeyboardOpen;
      setIsKeyboardOpen(next.isKeyboardOpen);
      setKeyboardHeight(next.keyboardHeight);
      document.documentElement.style.setProperty("--keyboard-height", `${next.keyboardHeight}px`);
    }

    function handleResize() {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      if (!isMobile) {
        applyKeyboardState({ isKeyboardOpen: false, keyboardHeight: 0 });
        // Drop mobile occlusion maxima while desktop so a later phone resize
        // cannot treat the desktop visual height as an unobstructed baseline.
        maxViewportHeight = viewport.height;
        maxLayoutHeight = window.innerHeight;
        prevIsMobile = isMobile;
        pendingOrientationRebase = false;
        deferredOccludedVisualHeight = null;
        prevViewportWidth = viewport.width;
        prevViewportHeight = viewport.height;
        prevLayoutHeight = window.innerHeight;
        return;
      }

      const hasEditableFocus = isEditableTarget(document.activeElement);
      // Playwright (and browser chrome) shrink the viewport without a focused
      // field. Never accumulate that as keyboard occlusion — only editable
      // focus may arm --keyboard-height.
      if (!hasEditableFocus) {
        maxViewportHeight = viewport.height;
        maxLayoutHeight = window.innerHeight;
        pendingOrientationRebase = false;
        deferredOccludedVisualHeight = null;
        prevViewportWidth = viewport.width;
        prevIsMobile = isMobile;
        prevViewportHeight = viewport.height;
        prevLayoutHeight = window.innerHeight;
        baselinesByWidth.set(Math.round(viewport.width), {
          maxVisualHeight: maxViewportHeight,
          maxLayoutHeight,
        });
        applyKeyboardState({ isKeyboardOpen: false, keyboardHeight: 0 });
        return;
      }

      const widthChanged = viewport.width !== prevViewportWidth || (!prevIsMobile && isMobile);
      const widthKey = Math.round(viewport.width);
      const nextBaselines = resolveMobileKeyboardBaselines({
        widthChanged,
        hasEditableFocus,
        keyboardWasOpen,
        pendingOrientationRebase,
        currentVisualHeight: viewport.height,
        currentLayoutHeight: window.innerHeight,
        previousVisualHeight: prevViewportHeight,
        previousLayoutHeight: prevLayoutHeight,
        maxVisualHeight: maxViewportHeight,
        maxLayoutHeight,
        storedBaseline: baselinesByWidth.get(widthKey) ?? null,
        deferredOccludedVisualHeight,
      });

      maxViewportHeight = nextBaselines.maxVisualHeight;
      maxLayoutHeight = nextBaselines.maxLayoutHeight;
      pendingOrientationRebase = nextBaselines.pendingOrientationRebase;
      deferredOccludedVisualHeight = nextBaselines.deferredOccludedVisualHeight;
      prevViewportWidth = viewport.width;
      prevIsMobile = isMobile;

      const next = resolveMobileKeyboardViewport({
        maxVisualHeight: maxViewportHeight,
        currentVisualHeight: viewport.height,
        maxLayoutHeight,
        currentLayoutHeight: window.innerHeight,
        hasEditableFocus,
      });

      // Remember unobstructed baselines per width so a later rotation-with-keyboard
      // can restore the correct orientation instead of adopting occluded heights.
      if (!next.isKeyboardOpen && !pendingOrientationRebase) {
        baselinesByWidth.set(widthKey, {
          maxVisualHeight: maxViewportHeight,
          maxLayoutHeight,
        });
      }

      prevViewportHeight = viewport.height;
      prevLayoutHeight = window.innerHeight;
      applyKeyboardState(next);
    }

    // Initial check
    handleResize();

    window.visualViewport.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("focusin", handleResize);
    window.addEventListener("focusout", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("focusin", handleResize);
      window.removeEventListener("focusout", handleResize);
      document.documentElement.style.removeProperty("--keyboard-height");
    };
  }, []);

  return (
    <MobileKeyboardContext.Provider value={{ isKeyboardOpen, keyboardHeight }}>
      {children}
    </MobileKeyboardContext.Provider>
  );
}
