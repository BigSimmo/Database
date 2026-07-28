"use client";

import { useEffect, useState } from "react";

/**
 * Enables sidebar grid-template-columns transitions only after mount so a
 * remounted shell (Answer ↔ namespaced mode) does not animate from the default
 * track width.
 */
export function useSidebarColumnTransitionReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return ready;
}
