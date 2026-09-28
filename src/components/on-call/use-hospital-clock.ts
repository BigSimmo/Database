"use client";
import { useEffect, useState } from "react";
/** Minute accuracy for hospital-configured cover boundaries, suspended on unmount. */
export function useHospitalClock(pinned?: Date): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (pinned) return;
    const timer = setTimeout(() => setNow(new Date()), 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(timer);
  }, [now, pinned]);
  return pinned ?? now;
}
