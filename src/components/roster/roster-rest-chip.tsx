import { TriangleAlert } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import type { RestCue } from "@/lib/roster/rest-cues";

/**
 * A small cue on one of my shifts: "9 h rest", "2nd night of 3". Neutral by
 * default. The review tone (the same amber the team calendar uses for a rule
 * flag) appears only when the team's own rule is crossed, and then the rule's
 * words are written out and an icon carries the meaning without colour.
 */

const REVIEW = "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]";
const NEUTRAL = "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** `9 h rest`, `9 h 30 min rest`, `3 days' rest`. Rounded down, so it never claims more rest than there was. */
export function restWords(hours: number): string {
  const minutes = Math.max(0, Math.floor(hours * 60));
  if (minutes >= 48 * 60) return `${Math.floor(minutes / (24 * 60))} days' rest`;
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (whole === 0) return `${rest} min rest`;
  return rest === 0 ? `${whole} h rest` : `${whole} h ${rest} min rest`;
}

/** The cue's visible words, or null when there is nothing to say. */
export function restCueWords(cue: RestCue): string | null {
  const parts = [
    cue.restHours !== null ? restWords(cue.restHours) : null,
    cue.nightOf ? `${ordinal(cue.nightOf.n)} night of ${cue.nightOf.of}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(" · ") : null;
}

export function RosterRestChip({ cue, testId }: { readonly cue: RestCue | undefined; readonly testId?: string }) {
  if (!cue) return null;
  const words = restCueWords(cue);
  if (!words && !cue.warning) return null;
  return (
    <span
      data-testid={testId}
      data-warning={cue.warning ? "true" : undefined}
      className={cn(
        "nums inline-flex max-w-full items-start gap-1 rounded-md border px-2 py-0.5 text-xs forced-colors:border",
        cue.warning ? REVIEW : NEUTRAL,
      )}
    >
      {cue.warning ? <TriangleAlert aria-hidden="true" className="size-icon-xs mt-0.5 shrink-0" /> : null}
      <span className="min-w-0 break-words">
        {words}
        {cue.warning ? (
          <>
            {words ? ". " : null}
            <span className="font-medium">{cue.warning}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}
