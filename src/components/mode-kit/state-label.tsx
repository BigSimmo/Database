import type { ReactNode } from "react";

import { modeDot } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

/**
 * A row's state, as muted words with a dot of 6px or less — never a filled chip
 * on a row (standard §3). The words always say the state, so the dot is never
 * the only signal. `warning` (amber) is kept for a real warning, such as a
 * removed number; everything else ("Not set up", "Not recorded") is muted grey.
 * Each mode owns its own words; the kit only draws them.
 */
export function ModeStateLabel({
  tone = "muted",
  children,
  testId,
}: {
  readonly tone?: "muted" | "warning";
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[color:var(--text-muted)]"
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        data-state-dot=""
        className={cn(modeDot, tone === "warning" ? "bg-[color:var(--warning)]" : "bg-[color:var(--border-strong)]")}
      />
      <span className="break-words">{children}</span>
    </span>
  );
}
