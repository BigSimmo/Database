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
    setTime(Date.now());
    if (updateInterval && updateInterval > 0) {
      const interval = window.setInterval(() => setTime(Date.now()), updateInterval);
      return () => window.clearInterval(interval);
    }
  }, [updateInterval]);

  return time;
}
