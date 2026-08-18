// src/components/ward-management/ward-pressure.ts
import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { EmergencyDepartment } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

export type EdPressure = {
  ed: EmergencyDepartment;
  waiting: number;
  longestWaitMinutes: number;
  breaching: number;
};

/** Worst first: a passed legal deadline outranks a long wait, which outranks sheer volume. */
export function edPressure(now: Instant): EdPressure[] {
  return allEmergencyDepartments()
    .map((ed) => {
      const open = wardMovements.filter((movement) => isOpen(movement) && movement.originEdId === ed.id);
      // A movement authored with a future `openedAt` must never surface as a negative wait on
      // a coordinator's card — clamp at zero rather than display something that reads as true
      // and isn't.
      const waits = open.map((movement) => Math.max(0, now - movement.openedAt));
      return {
        ed,
        waiting: open.length,
        longestWaitMinutes: waits.length ? Math.max(...waits) : 0,
        // "Breached" already has one definition, owned by ward-clock.ts: `clockState` returns
        // "breached" exactly when the deadline has passed. Reuse it rather than re-deriving the
        // same condition inline, so the two never quietly drift apart.
        breaching: open.filter(
          (movement) => movement.legalForm !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
        ).length,
      };
    })
    .sort((a, b) => b.breaching - a.breaching || b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);
}
