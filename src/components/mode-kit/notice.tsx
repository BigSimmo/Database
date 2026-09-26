import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

/**
 * Standard module 4, the notice: one calm line with a small leading icon on a
 * tinted edge, used only when something needs attention. `warning` (amber) is
 * for a real warning, such as a removed number; everything else is neutral.
 */
export function ModeNotice({
  tone = "neutral",
  children,
  testId,
}: {
  readonly tone?: "neutral" | "warning";
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border border-l-2 border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 text-sm text-[color:var(--text)]",
        tone === "warning" ? "border-l-[color:var(--warning)]" : "border-l-[color:var(--border-strong)]",
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "mt-0.5 size-icon-sm shrink-0",
          tone === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--text-muted)]",
        )}
      />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
