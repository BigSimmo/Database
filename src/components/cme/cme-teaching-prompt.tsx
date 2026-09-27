"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cardSurface } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";

/** A quiet handoff: Teaching remains the owner of its unlogged count. */
export function CmeTeachingPrompt() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCount() {
      try {
        const response = await fetch("/api/teaching?view=unlogged-count", {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const value: unknown = await response.json();
        const nextCount =
          value && typeof value === "object" && "count" in value ? (value as { count: unknown }).count : null;
        if (
          !controller.signal.aborted &&
          typeof nextCount === "number" &&
          Number.isSafeInteger(nextCount) &&
          nextCount > 0
        ) {
          setCount(nextCount);
        }
      } catch {
        // The Teaching endpoint is optional until its separate mode is connected.
      }
    }
    void loadCount();
    return () => controller.abort();
  }, []);

  if (count === null) return null;

  return (
    <section
      className={cn(cardSurface, "mt-3 p-4")}
      aria-label="Teaching sessions to log"
      data-testid="cme-teaching-prompt"
    >
      <p className="text-sm font-semibold text-[color:var(--text)]">Next to log: Teaching</p>
      <p className={cn("mt-1 text-sm", textMuted)}>
        {count} {count === 1 ? "teaching session" : "teaching sessions"} ready to review in Teaching.
      </p>
      <Link
        href="/teaching/logbook"
        className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-[color:var(--clinical-accent)] underline underline-offset-2"
      >
        Open Teaching logbook
      </Link>
    </section>
  );
}
