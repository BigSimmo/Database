import { CircleDashed, Diamond, Triangle } from "lucide-react";

import type { RowUrgency } from "@/components/admin/renewals/urgency";
import { cn } from "@/components/ui-primitives";

/**
 * The status word with its grey shape (final design, screens-v3): a triangle
 * for "start renewing now", a diamond for a passed date, a dashed ring for
 * "not recorded yet". A row with no shape (a future start date, or the plain
 * "Recorded" of a no-end-date row) prints the word alone. Always grey — this
 * page never colours urgency (AGENTS.md "RAG ranking protection" is unrelated;
 * the no-colour rule is the Admin design rules carried into this round).
 */
export function ChecklistStatus({ urgency, testId }: { readonly urgency: RowUrgency; readonly testId?: string }) {
  const Icon =
    urgency.shape === "triangle"
      ? Triangle
      : urgency.shape === "diamond"
        ? Diamond
        : urgency.shape === "ring"
          ? CircleDashed
          : null;
  return (
    <span
      data-testid={testId}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-[color:var(--text-muted)]"
    >
      {Icon ? <Icon aria-hidden="true" strokeWidth={1.75} className={cn("size-icon-xs shrink-0")} /> : null}
      {urgency.word}
    </span>
  );
}
