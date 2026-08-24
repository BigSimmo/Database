// src/components/ward-management/ward-pressure.ts
import { clockState, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { EmergencyDepartment, Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

export type EdPressure = {
  ed: EmergencyDepartment;
  waiting: number;
  longestWaitMinutes: number;
  breaching: number;
};

/**
 * Worst first: a passed legal deadline outranks a long wait, which outranks sheer volume.
 *
 * `movements` defaults to the live fixture but is deliberately injectable — this is the mirror
 * of `queueOrder(movements, now)` in `ward-priority.ts`, just with the parameter order kept as
 * `(now, movements)` because `now` is the argument every existing and planned call site passes
 * first. Without the injection point, every assertion about this function is forced to key off
 * the one fixture, which happens to have every department busy and every wait positive — that
 * is what let three false-positive tests through review the first time.
 */
export function edPressure(now: Instant, movements: Movement[] = wardMovements): EdPressure[] {
  return allEmergencyDepartments()
    .map((ed) => {
      const open = movements.filter((movement) => isOpen(movement) && movement.originEdId === ed.id);
      // A movement authored with a future `openedAt` must never surface as a negative wait on
      // a coordinator's card — clamp at zero rather than display something that reads as true
      // and isn't.
      const waits = open.map((movement) => Math.max(0, minutesUntil(now, movement.openedAt)));
      return {
        ed,
        waiting: open.length,
        longestWaitMinutes: waits.length ? Math.max(...waits) : 0,
        // "Breached" already has one definition, owned by ward-clock.ts: `clockState` returns
        // "breached" exactly when the deadline has passed. Reuse it rather than re-deriving the
        // same condition inline, so the two never quietly drift apart. A form with no `dueAt` is
        // never breached — `undefined` must never reach `clockState`'s arithmetic. As of the
        // 2026-08-23 product-owner correction, neither a Form 1A nor a Form 3B carries one any
        // longer (Task 6A first established this for 3B; see `LegalForm`'s doc comment in
        // ward-model.ts) — only the transport/transfer forms (4A/4C) still do, and none of those
        // are due in the past on today's fixture, so this evaluates to 0 today.
        breaching: open.filter(
          (movement) =>
            movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
        ).length,
      };
    })
    .sort((a, b) => b.breaching - a.breaching || b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);
}
