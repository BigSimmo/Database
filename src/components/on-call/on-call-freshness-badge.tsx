"use client";

import { CalendarCheck, CircleHelp, TriangleAlert } from "lucide-react";

import { metadataPillDensity } from "@/components/ui-primitives";
import { cn } from "@/components/ui-primitives";
import { formatClinicalDate } from "@/lib/source-metadata";
import type { OnCallFreshness } from "@/lib/on-call/entry-model";

/**
 * The stale state (spec §8.5) "carries a non-colour channel: an icon and the
 * words 'checked <date>'. Status may never be signalled by colour alone."
 * Colour here only reinforces an already-legible icon-shape + word pairing —
 * delete every colour class and the three states are still unambiguous.
 */
export function OnCallFreshnessBadge({ freshness, className }: { freshness: OnCallFreshness; className?: string }) {
  if (freshness.state === "fresh") {
    return (
      <span
        data-testid="on-call-freshness-badge"
        data-freshness-state="fresh"
        className={cn(metadataPillDensity.standard, "gap-1.5 rounded-full", className)}
      >
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {`Checked ${formatClinicalDate(freshness.lastVerifiedAt)}`}
      </span>
    );
  }

  if (freshness.reason === "never-verified") {
    return (
      <span
        data-testid="on-call-freshness-badge"
        data-freshness-state="stale"
        data-freshness-reason="never-verified"
        className={cn(
          metadataPillDensity.standard,
          "gap-1.5 rounded-full border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Never checked
      </span>
    );
  }

  return (
    <span
      data-testid="on-call-freshness-badge"
      data-freshness-state="stale"
      data-freshness-reason="overdue"
      className={cn(
        metadataPillDensity.standard,
        "gap-1.5 rounded-full border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
        className,
      )}
    >
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {`Checked ${formatClinicalDate(freshness.lastVerifiedAt)} — needs checking`}
    </span>
  );
}

/**
 * The same badge, shown only when it warns.
 *
 * A list row is scanned, not read. "Checked 14/08/2026" on a row where nothing
 * is wrong is a pill wider than most entries' own names — it truncated the
 * service on Referrals and the manual on Orientation to make room for the news
 * that everything is fine — and it doubles the height of a list whose whole
 * promise is that the number you want is near the top.
 *
 * So the rule across the mode is: on a list row, freshness speaks only when it
 * is overdue. The date a current entry was last confirmed is still available
 * wherever the entry is opened or edited, which is where somebody who wants it
 * goes looking.
 */
export function OnCallStaleFlag({ freshness, className }: { freshness: OnCallFreshness; className?: string }) {
  if (freshness.state !== "stale") return null;
  return <OnCallFreshnessBadge freshness={freshness} className={className} />;
}
