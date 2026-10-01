import { Check } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import type { SwapStep } from "@/lib/roster/team/swap-progress";

const STATE_WORDS: Record<SwapStep["state"], string> = { done: "done", current: "now", todo: "still to come" };

/**
 * Where a swap has got to, as a short list of steps. The current step is marked
 * `aria-current="step"` and every step says its state in words, so nothing
 * depends on colour. A swap that has ended shows how it ended instead of a
 * current step.
 */
export function SwapProgressLine({
  steps,
  waitingOn,
  ended,
  expiresAt,
}: {
  steps: readonly SwapStep[];
  waitingOn: string | null;
  ended: string | null;
  /** When a swap still waiting for an answer runs out, if the read carries it. */
  expiresAt?: string | null;
}) {
  return (
    <div className="grid gap-1">
      <ul role="list" aria-label="Swap progress" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {steps.map((step) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-1",
              step.state === "current" && "font-semibold text-[color:var(--info)]",
              step.state === "done" && "text-[color:var(--text)]",
              step.state === "todo" && "text-[color:var(--text-muted)]",
            )}
          >
            {step.state === "done" ? (
              <Check aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--success)]" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full border border-current",
                  step.state === "current" && "bg-current",
                )}
              />
            )}
            <span>{step.label}</span>
            <span className="sr-only"> ({STATE_WORDS[step.state]})</span>
          </li>
        ))}
      </ul>
      {ended ? (
        <p className="text-sm font-medium text-[color:var(--text-muted)]">{ended}</p>
      ) : waitingOn ? (
        <p className="text-sm text-[color:var(--text-muted)]">
          {waitingOn === "You" ? "Waiting on you" : `Waiting on ${waitingOn}`}
          {expiresAt ? `, expires ${formatPerthDay(perthDateOf(expiresAt))}` : ""}
        </p>
      ) : null}
    </div>
  );
}
