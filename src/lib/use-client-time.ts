"use client";

import { useState, useEffect } from "react";

/**
 * Returns a hydration-safe timestamp.
 * During server-side rendering, it returns the provided fallback (or 0).
 * After mounting on the client, it returns Date.now() and updates on the given interval if specified.
 */
export function useClientTime({ fallback = 0, updateInterval }: { fallback?: number; updateInterval?: number } = {}) {
  const [time, setTime] = useState(fallback);

  useEffect(() => {
    const update = () => setTime(Date.now());
    const frame = window.requestAnimationFrame(update);
    const interval = updateInterval && updateInterval > 0 ? window.setInterval(update, updateInterval) : null;
    return () => {
      window.cancelAnimationFrame(frame);
      if (interval != null) window.clearInterval(interval);
    };
  }, [updateInterval]);

  return time;
}
