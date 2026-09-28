"use client";

import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import type { RosterAssignment } from "@/lib/roster/team/model";

export function RosterSwapTicket({ shift, label }: { shift: RosterAssignment; label: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
      <p className="font-medium">
        {formatPerthDay(perthDateOf(shift.startsAt))} · {SHIFT_KIND_LABEL[shift.kind]}
      </p>
      <p className="text-sm text-[color:var(--text-muted)]">
        {perthTimeOf(shift.startsAt)}–{perthTimeOf(shift.endsAt)}
        {shift.siteName ? ` · ${shift.siteName}` : ""}
      </p>
    </div>
  );
}
