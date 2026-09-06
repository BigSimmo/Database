"use client";

import { CloudOff } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { formatClinicalDate } from "@/lib/source-metadata";

export interface OnCallOfflineBannerProps {
  /** ISO timestamp of when the shown copy was cached, or `null` if unknown. */
  savedAt: string | null;
  testId?: string;
}

/**
 * Shown when contacts render from the offline cache rather than a live fetch
 * (spec §6, §8.5). Names the date the saved copy was taken.
 *
 * The visible banner is deliberately NOT itself a live region — no `role`,
 * no `aria-live` on this element — because the page can mount it already
 * visible on first paint, and an always-on live region announces its own
 * mount as if it just changed. The announcement instead goes through a
 * paired `sr-only` `aria-live="polite"` node, which is the one channel a
 * screen-reader user actually needs: a spoken heads-up that this is not
 * live data.
 */
export function OnCallOfflineBanner({ savedAt, testId = "on-call-offline-banner" }: OnCallOfflineBannerProps) {
  const savedLabel = savedAt ? formatClinicalDate(savedAt) : "an earlier date";
  const message = `You are offline. Showing a saved copy from ${savedLabel}.`;

  return (
    <>
      <div
        data-testid={testId}
        className={cn(
          "flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--warning)]",
        )}
      >
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
        <span>{message}</span>
      </div>
      <span data-testid={`${testId}-announcement`} role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </>
  );
}
