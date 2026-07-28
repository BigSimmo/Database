import { useState, useEffect } from "react";

export type PresenceStage = "unmounted" | "entering" | "mounted" | "exiting";

export function useOverlayPresence(open: boolean, exitDurationMs: number = 140) {
  const [stage, setStage] = useState<PresenceStage>(open ? "mounted" : "unmounted");

  useEffect(() => {
    if (open) {
      setStage("mounted");
    } else {
      setStage((current) => {
        if (current === "unmounted") return "unmounted";
        return "exiting";
      });
      const timeout = setTimeout(() => {
        setStage("unmounted");
      }, exitDurationMs);
      return () => clearTimeout(timeout);
    }
  }, [open, exitDurationMs]);

  return {
    stage,
    isMounted: stage !== "unmounted",
  };
}
