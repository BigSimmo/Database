import type { ReactNode } from "react";

import { onCallModuleSurface } from "@/components/on-call/kit/recipes";
import { onCallNumberText } from "@/components/on-call/kit/type";
import { cn } from "@/components/ui-primitives";

/**
 * Standard module 2, fact tiles: a label (12px muted) over a value (15–17px at
 * 400). Values wrap and are never truncated. `OnCallFactTiles` lays them two
 * across and lets them stack when text is enlarged.
 */
export function OnCallFactTile({
  label,
  value,
  size = "body",
  testId,
}: {
  readonly label: string;
  readonly value: ReactNode;
  /** `body` 15px, `large` 17px. */
  readonly size?: "body" | "large";
  readonly testId?: string;
}) {
  return (
    <div className={cn(onCallModuleSurface, "grid min-w-0 gap-0.5 p-3")} data-testid={testId}>
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <span
        className={cn(
          onCallNumberText,
          size === "large" ? "text-lg-minus" : "text-base-minus",
          "break-words text-[color:var(--text-heading)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function OnCallFactTiles({ children, testId }: { readonly children: ReactNode; readonly testId?: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3" data-testid={testId}>
      {children}
    </div>
  );
}
