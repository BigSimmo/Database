"use client";
import { focusRing } from "@/components/card-recipes";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OnCallHospitalChooser } from "@/components/on-call/kit/handbook-state";
import type { HospitalHandbookState } from "@/components/on-call/use-hospital-handbook";
import type { OnCallShift } from "@/lib/roster/shifts/model";

export function HospitalShiftUpdates({
  handbook,
  shifts,
  now,
}: {
  handbook: HospitalHandbookState;
  shifts: readonly Pick<OnCallShift, "startsAt" | "endsAt" | "workplace">[];
  now: Date;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (handbook.status !== "ready") return null;
  const active = shifts.filter(
    (shift) => Date.parse(shift.startsAt) <= now.getTime() && Date.parse(shift.endsAt) > now.getTime(),
  );
  // Overlapping shifts can disagree: never select one by array order.
  const workplaces = [...new Set(active.flatMap((shift) => (shift.workplace ? [shift.workplace.trim()] : [])))];
  const workplace = workplaces.length === 1 ? workplaces[0] : null;
  const current = handbook.siteName ?? handbook.serviceName;
  const mismatch = workplace && current && workplace.toLocaleLowerCase() !== current.toLocaleLowerCase();
  const promptKey = `${handbook.hospitalKey}:${workplace}`;
  const lastEnd = Math.max(...shifts.map((shift) => Date.parse(shift.endsAt)).filter((time) => time < now.getTime()));
  const changed = Number.isFinite(lastEnd)
    ? handbook.items.filter(
        (item) => item.updatedAt && Date.parse(item.updatedAt) > lastEnd && Date.parse(item.updatedAt) <= now.getTime(),
      )
    : [];
  return (
    <>
      {mismatch && dismissed !== promptKey ? (
        <section className="grid gap-2 px-3" data-testid="on-call-roster-site-prompt">
          <p>
            Your roster says {workplace}; you are viewing {current}. Check the hospital before calling.
          </p>
          <OnCallHospitalChooser handbook={handbook} />
          <Button variant="ghost" onClick={() => setDismissed(promptKey)}>
            Keep this hospital
          </Button>
        </section>
      ) : null}
      {changed.length ? (
        <section className="grid gap-2 px-3" data-testid="on-call-published-changes">
          <h2 className="text-sm font-normal">What changed since your last shift</h2>
          <ul className="grid gap-2">
            {changed.map((item) => (
              <li key={item.id}>
                <Link
                  className={`${focusRing} inline-flex min-h-tap items-center text-[color:var(--clinical-accent)]`}
                  href={`/on-call/service#on-call-entry-${item.id}`}
                >
                  {item.section === "cover" ? "Role cover updated" : item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
