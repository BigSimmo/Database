"use client";

import { useEffect, useRef } from "react";

import { cn, floatingControl } from "@/components/ui-primitives";

const AUTO_DISMISS_MS = 6_000;

/**
 * The one "Saved · Undo" bar every real toggle on New job shares (standard
 * §7, ui-lane-rules "Undo"): 48px, sits above where a floating Add would be,
 * and clears itself after about six seconds if nobody taps Undo.
 */
export function AdminSavedUndoBar({
  label = "Saved",
  onUndo,
  onDismiss,
  testId = "admin-saved-undo-bar",
}: {
  label?: string;
  onUndo: () => void;
  onDismiss: () => void;
  testId?: string;
}) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      data-testid={testId}
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[var(--z-chrome)] flex justify-center px-4 print:hidden"
    >
      <div className="flex min-h-12 items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 shadow-[var(--e3)]">
        <span className="text-sm text-[color:var(--text)]">{label}</span>
        <button
          type="button"
          onClick={onUndo}
          data-testid={`${testId}-undo`}
          className={cn(floatingControl, "text-xs")}
        >
          Undo
        </button>
      </div>
    </div>
  );
}
