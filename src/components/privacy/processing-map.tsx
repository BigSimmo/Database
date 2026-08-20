import { MapPin } from "lucide-react";

import { privacyToneSurface, privacyToneText } from "@/components/privacy/tone";
import { cn } from "@/components/ui-primitives";
import { PRIVACY_PROCESSING_MAP } from "@/lib/privacy-page-content";

/**
 * Precision instrument — three equal cells at every width.
 * Soft tone washes + MapPin marks; never horizontal pill/circle chips that clip External.
 *
 * Each cell now carries what actually travels there. Naming the payload is the
 * difference between a label and a map: "External / OpenAI API" says nothing
 * about whether the thing you just typed is in it.
 */
export function ProcessingMap({ density = "comfortable" }: { density?: "comfortable" | "compact" }) {
  const compact = density === "compact";
  return (
    <section aria-label="Where processing happens" className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
          Processing map
        </p>
        <p className="text-3xs font-medium text-[color:var(--text-muted)]">Operator must verify regions</p>
      </div>
      <div
        className={cn(
          "grid grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--border)] shadow-[var(--shadow-inset)]",
          "bg-[color:var(--surface-raised)]",
        )}
      >
        {PRIVACY_PROCESSING_MAP.map((cell, index) => (
          <div
            key={cell.place}
            className={cn(
              "relative min-w-0",
              compact ? "px-2 py-2 sm:px-3 sm:py-2.5" : "px-2.5 py-2.5 sm:px-4 sm:py-3.5",
              index > 0 && "border-l border-[color:var(--border)]",
              privacyToneSurface[cell.tone],
            )}
          >
            <div className={cn("flex items-start", compact ? "gap-1" : "gap-1.5")}>
              <MapPin
                aria-hidden="true"
                className={cn(
                  "mt-0.5 shrink-0 opacity-80",
                  compact ? "h-3 w-3" : "h-3.5 w-3.5",
                  privacyToneText[cell.tone],
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-extrabold uppercase tracking-kicker",
                    compact ? "text-3xs leading-3" : "text-3xs leading-3 sm:text-2xs sm:leading-4",
                    privacyToneText[cell.tone],
                  )}
                >
                  {cell.place}
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-semibold tracking-display text-[color:var(--text-heading)]",
                    compact ? "text-2xs leading-4" : "text-2xs leading-4 sm:text-sm sm:leading-5",
                  )}
                >
                  {cell.role}
                </p>
                <p className="mt-1 text-3xs leading-4 text-[color:var(--text-muted)]">{cell.carries}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-3xs leading-4 text-[color:var(--text-muted)]">
        Question text and selected excerpts can leave Australia.
      </p>
    </section>
  );
}
