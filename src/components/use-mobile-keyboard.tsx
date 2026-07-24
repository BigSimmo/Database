"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
    let prevIsMobile = window.matchMedia("(max-width: 1023px)").matches;

    function applyKeyboardState(next: MobileKeyboardContextState) {
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
        prevIsMobile = isMobile;
        return;
      }

      // Reset baseline if viewport width changed (orientation/breakpoint change) or if just entered mobile mode
      if (viewport.width !== prevViewportWidth || (!prevIsMobile && isMobile)) {
        maxViewportHeight = viewport.height;
        maxLayoutHeight = window.innerHeight;
      } else {
        maxViewportHeight = Math.max(maxViewportHeight, viewport.height);
        maxLayoutHeight = Math.max(maxLayoutHeight, window.innerHeight);
      }

      prevViewportWidth = viewport.width;
      prevIsMobile = isMobile;

      applyKeyboardState(
        resolveMobileKeyboardViewport({
          maxVisualHeight: maxViewportHeight,
          currentVisualHeight: viewport.height,
          maxLayoutHeight,
          currentLayoutHeight: window.innerHeight,
          hasEditableFocus: isEditableTarget(document.activeElement),
        }),
      );
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

export function useMobileKeyboardViewport() {
  return useContext(MobileKeyboardContext);
}
