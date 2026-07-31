"use client";

import { cn } from "@/components/ui-primitives";
import type { ClinicalSourceMetadata } from "@/lib/types";

export type DocumentStatus = NonNullable<ClinicalSourceMetadata["document_status"]>;

/**
 * Status encoded in SHAPE, at one 8px footprint for every state:
 *
 *   current    filled disc
 *   review_due half ring   (right half filled)
 *   outdated   slashed ring
 *   unknown    dashed ring
 *
 * Shape survives greyscale print, colour-blind viewing and forced-colors, none of
 * which a hue does. Colour still rides along for fast scanning; it is the second
 * channel, not the only one.
 *
 * Deliberately NOT applied to every badge. Four shape marks stacked in a dense
 * governance column read as noise rather than signal — the mark earns its place
 * on print, export, lifecycle and single-source surfaces, where a reader is
 * looking at one thing rather than scanning fifty. In a dense table, use the
 * label alone.
 *
 * Always `aria-hidden`: the state is announced by the adjacent text, and a mark
 * that both draws and announces produces a double reading.
 */
export function StatusMark({ status, className }: { status: DocumentStatus; className?: string }) {
  const tone =
    status === "current"
      ? "var(--success)"
      : status === "review_due"
        ? "var(--warning)"
        : status === "outdated"
          ? "var(--danger)"
          : "var(--text-soft)";

  return (
    <span
      aria-hidden
      data-testid="status-mark"
      data-status={status}
      className={cn("relative inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={
        status === "current"
          ? { background: tone }
          : status === "unknown"
            ? { border: `1.5px dashed ${tone}` }
            : { border: `1.5px solid ${tone}` }
      }
    >
      {status === "review_due" ? (
        // Right half filled: "partway through its life", not "failed".
        <span className="absolute inset-y-0 right-0 w-1/2 rounded-r-full" style={{ background: tone }} />
      ) : null}
      {status === "outdated" ? (
        // Slash: the universal "no longer valid" mark, and the only one of the
        // four that reads as negative without colour.
        <span
          className="absolute left-1/2 top-1/2 h-[1.5px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ background: tone }}
        />
      ) : null}
    </span>
  );
}
