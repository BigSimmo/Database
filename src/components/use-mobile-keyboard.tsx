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
    let prevViewportWidth = window.visualViewport.width;
    let prevIsMobile = window.matchMedia("(max-width: 1023px)").matches;

    function handleResize() {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      if (!isMobile) {
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
        document.documentElement.style.setProperty("--keyboard-height", "0px");
        prevIsMobile = isMobile;
        return;
      }

      // Reset baseline if viewport width changed (orientation/breakpoint change) or if just entered mobile mode
      if (viewport.width !== prevViewportWidth || (!prevIsMobile && isMobile)) {
        maxViewportHeight = viewport.height;
      } else {
        maxViewportHeight = Math.max(maxViewportHeight, viewport.height);
      }

      prevViewportWidth = viewport.width;
      prevIsMobile = isMobile;

      const diff = maxViewportHeight - viewport.height;

      // Threshold to detect software keyboard (usually > 150px)
      if (diff > 150) {
        setIsKeyboardOpen(true);
        setKeyboardHeight(diff);
        document.documentElement.style.setProperty("--keyboard-height", `${diff}px`);
      } else {
        setIsKeyboardOpen(false);
        setKeyboardHeight(0);
        document.documentElement.style.setProperty("--keyboard-height", "0px");
      }
    }

    // Initial check
    handleResize();

    window.visualViewport.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
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
