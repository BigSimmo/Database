"use client";

import type { z } from "zod";
import type { rosterMakerComparisonRowSchema } from "@/lib/roster/maker/workflow-model";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";

type Row = z.infer<typeof rosterMakerComparisonRowSchema>;

export function RosterProposalComparison({
  before,
  after,
  names = {},
  sites = {},
}: {
  before: Row[];
  after: Row[];
  names?: Record<string, string>;
  sites?: Record<string, string>;
}) {
  function rows(items: Row[]) {
    return items.length ? (
      <ul className="grid gap-2 text-sm">
        {items.map((row, index) => (
          <li
            key={`${row.userId}:${row.startsAt}:${index}`}
            className="rounded border border-[color:var(--border)] p-2"
          >
            <span className="block font-medium">
              {row.userId ? (names[row.userId] ?? row.rosterName ?? "Doctor") : (row.rosterName ?? "Unfilled shift")}
            </span>
            {formatPerthDay(perthDateOf(row.startsAt))} · {row.shiftCode} · {perthTimeOf(row.startsAt)}–
            {perthTimeOf(row.endsAt)}
            {perthDateOf(row.startsAt) !== perthDateOf(row.endsAt)
              ? ` (${formatPerthDay(perthDateOf(row.endsAt))})`
              : ""}
            <span className="block">
              {row.siteId ? (sites[row.siteId] ?? "Specified team site") : "Site not specified"} ·{" "}
              {row.grade ?? "Grade not specified"}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm">No duties</p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <details open>
        <summary className="cursor-pointer font-medium">Before · {before.length} duties</summary>
        {rows(before)}
      </details>
      <details open>
        <summary className="cursor-pointer font-medium">After · {after.length} duties</summary>
        {rows(after)}
      </details>
    </div>
  );
}
