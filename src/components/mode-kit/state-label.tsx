"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { modeDot } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

export type ModeLiveTone = "live" | "muted" | "warning";

export const PULSE_MS = 600;

const DOT_TONE: Record<ModeLiveTone, string> = {
  live: "bg-[color:var(--success)]",
  muted: "bg-[color:var(--border-strong)]",
  warning: "bg-[color:var(--warning)]",
};

function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A text status whose dot pulses once on a settled transition to live.
 * The initial computed state and reduced-motion preference never animate.
 */
export function ModeLiveStateLabel({
  tone,
  settled,
  children,
  className,
}: {
  readonly tone: ModeLiveTone;
  /** False until the caller has computed a real state (the server render and first paint). */
  readonly settled: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const last = useRef<{ tone: ModeLiveTone; settled: boolean } | null>(null);
  const ring = useRef<HTMLSpanElement | null>(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const previous = last.current;
    last.current = { tone, settled };
    const turnedLive = tone === "live" && previous !== null && previous.settled && previous.tone !== "live";
    if (!turnedLive || prefersReducedMotion()) return;
    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), PULSE_MS);
    return () => {
      window.clearTimeout(timer);
      setPulsing(false);
    };
  }, [tone, settled]);

  useEffect(() => {
    if (!pulsing) return;
    // Web Animations, so no keyframes are needed in the global stylesheet; absent in old engines and jsdom.
    ring.current?.animate?.(
      [
        { transform: "scale(1)", opacity: 0.6 },
        { transform: "scale(3)", opacity: 0 },
      ],
      { duration: PULSE_MS, easing: "ease-out" },
    );
  }, [pulsing]);

  return (
    // The dots sit beside the words (never alone in a wrapper), so the state always has a text channel.
    <span data-state={tone} className={cn("relative inline-flex min-w-0 items-center gap-1.5", className)}>
      {pulsing ? (
        <span
          ref={ring}
          aria-hidden="true"
          data-pulse=""
          className={cn(modeDot, DOT_TONE.live, "absolute inset-y-0 left-0 my-auto motion-reduce:hidden")}
        />
      ) : null}
      <span aria-hidden="true" data-state-dot="" className={cn(modeDot, DOT_TONE[tone])} />
      <span className="break-words">{children}</span>
    </span>
  );
}

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
