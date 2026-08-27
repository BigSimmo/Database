"use client";

import { RefreshCw, Square } from "lucide-react";

import { cn, EmptyState, primaryControl } from "@/components/ui-primitives";

/**
 * The notice shown after the reader stops answer generation.
 *
 * It reports on the last action rather than describing the page, so the
 * dashboard renders it with the other top-of-content notices instead of inside
 * the mode-home canvas. In the canvas it was centred as one group with the
 * `SharedHomeEmptyState` hero, which on a phone left it floating in the middle
 * of the screen under a tall empty gap (device report, 2026-08-27).
 *
 * Extracted from ClinicalDashboard so the notice's markup lives with its
 * rationale rather than adding lines to a file under a no-growth budget.
 */
export function AnswerCancelledNotice({ onRunAgain }: { onRunAgain: () => void }) {
  return (
    <EmptyState
      icon={Square}
      title="Generation stopped"
      body="No partial clinical answer was kept. You can safely run the same question again."
      live="polite"
      testId="answer-cancelled"
      actions={
        <button type="button" className={cn(primaryControl, "text-xs")} onClick={onRunAgain}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Run again
        </button>
      }
    />
  );
}
