"use client";

import { Lock } from "lucide-react";

import { cn, textMuted } from "@/components/ui-primitives";

/**
 * The drawing's "Private · only you" marker.
 *
 * A lock AND the words, never one or the other: this is the label that tells a
 * reader why a number they expected is not on the screen, and status carried
 * by an icon alone is unreadable to half the people who need it.
 *
 * It marks a row the shared read withholds from everyone else — the predicate
 * in `repository.ts` does that, not this component. Rendering the flag is
 * therefore a statement about a row the viewer can already see, never a
 * promise that anyone else could.
 */
export function OnCallPrivateFlag({ compact = false }: { compact?: boolean }) {
  return (
    <span
      data-testid="on-call-private-flag"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-bold",
        "border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
        textMuted,
      )}
    >
      <Lock aria-hidden="true" className="size-icon-2xs" />
      {compact ? "Private" : "Private · only you"}
    </span>
  );
}
