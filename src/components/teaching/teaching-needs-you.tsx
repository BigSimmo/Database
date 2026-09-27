"use client";

import { NotebookText } from "lucide-react";
import type { ReactNode } from "react";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { withUnit } from "@/components/teaching/teaching-number";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";

/*
 * Today's "Needs you": one row per thing the reader owes, and nothing at all
 * when they owe nothing (no empty module). Only a count crosses the wire. A
 * failed count shows nothing rather than an error: the module is a nudge, and
 * the Logbook carries the same fact. `extraRows` is where the supervision
 * tasks add their rows.
 */
export function NeedsYou({ live, extraRows }: { live: boolean; extraRows?: ReactNode }) {
  const unlogged = useTeachingResource<{ count: number }>(live ? "/api/teaching?view=unlogged-count" : null);
  const count = unlogged.data?.count ?? 0;
  if (count === 0 && !extraRows) return null;
  return (
    <ModeGroupedList eyebrow="Needs you" headerIcon={NotebookText} mode="teaching" testId="teaching-needs-you">
      {count > 0 ? (
        <ModeRow
          href="/teaching/logbook"
          title={`Log ${withUnit(count, count === 1 ? "session" : "sessions")} to CPD`}
          subtitle="Attended, not yet in your CPD log"
        />
      ) : null}
      {extraRows}
    </ModeGroupedList>
  );
}
