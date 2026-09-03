import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * Shifts a seeded Ward Flow state onto a different anchor, preserving every relative offset.
 *
 * WHY THIS EXISTS. The whole fixture is authored relative to `NOW_ANCHOR` (10:42), so a
 * demonstration opened at any other hour showed a board stuck at 10:42 — and, worse, seeded
 * discharge predictions read as already overdue after about forty-five minutes of a live session,
 * because the clock ticked forward while the fixture stayed where it was authored. Task 1 of the
 * truthfulness plan moves the demo clock to the real time of page load with "the seeded relative
 * offsets preserved so the fixture's shape is unchanged". Shifting every instant by one offset is
 * exactly that: durations, gaps, overdue-ness and ordering are all differences, and differences are
 * invariant under a shift.
 *
 * WHY THE SHIFT HAPPENS HERE AND NOT IN THE SEED FILES. Making `NOW_ANCHOR` itself read the wall
 * clock would re-anchor the seeds for free - and would make all 53 test files that read it
 * non-deterministic, with outcomes depending on the hour the suite happened to run. The seeds stay
 * authored against a fixed constant, the provider re-anchors what it hands the app, and the tests
 * keep the frozen night they were measured against. That is why `WardFlowProvider` applies this and
 * nothing else does.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH. `clockOffsetMinutes` is a DURATION the user has added with
 * the advance-clock control, not a point in time, so shifting it would double-count. Durations are
 * already invariant. The rule is mechanical rather than a judgement: only the field names in
 * `INSTANT_FIELDS` move, and that set is pinned to the model's own type declarations by
 * `tests/ward-reanchor.test.ts`, which fails if a new `Instant` field appears in `ward-model.ts`
 * without being considered here. A missed field is the failure mode that matters: it would leave one
 * timestamp on the old anchor, silently, on a screen that a clinician reads as a data error rather
 * than a bug.
 */

/**
 * Every field name whose value is an `Instant` - a point on the synthetic day, as opposed to a
 * duration or a count. Kept as names rather than a typed walk because the state is a tree of plain
 * seeded objects and the shift is uniform; the guard test is what keeps the list honest.
 *
 * ⚠️ **"THE GUARD TEST KEEPS THIS HONEST" WAS TRUE OF ONE FILE AND FALSE OF THE OTHER, FOR MONTHS.**
 * `tests/ward-reanchor.test.ts` scanned `ward-model.ts` and nothing else, while `Admission` lives
 * in `ward-admissions.ts` — which `ward-model.ts` does not even import. So the guard was green and
 * blind: of the seven `Instant` fields on `Admission`, exactly ONE (`arrivedAt`) was in this set,
 * and six were silently left on the old anchor while `now` moved away from them.
 *
 * ⚠️ **THAT PRODUCED WRONG NUMBERS ON A CLINICAL SCREEN, NOT A LATENT RISK.** The offset is
 * `wallClockNow() - NOW_ANCHOR`, so it ranges from −642 to +797 minutes and is zero only during the
 * single minute of 10:42. `ward-board.tsx` computes "At an emergency department for N hours — the
 * bed is still theirs" from `now - awayAtEmergencyDepartmentSince`, and that field was unshifted:
 * somebody two hours in an ED read as fifteen hours in an evening session. `pulledAt` was the same
 * shape and also ordered the incoming list, so the ordering was wrong too.
 *
 * Measured against the real seed at a 500-minute offset before the fix: `arrivedAt` moved 500,
 * every other `Admission` instant moved 0.
 *
 * The fix is these names plus a guard that reads BOTH files — see that test. Adding a field to
 * either one now fails the guard rather than quietly producing a plausible wrong duration.
 */
export const INSTANT_FIELDS: ReadonlySet<string> = new Set([
  "acceptedAt",
  "referredAt",
  "arrivedAt",
  "at",
  "pullExpiresAt",
  "cancelledAt",
  "collectedAt",
  "confirmedAt",
  "decidedAt",
  "dueAt",
  "enRouteAt",
  "expectedAt",
  "expectedReturn",
  "formedAt",
  "openedAt",
  "raisedAt",
  // ── `Admission`, in `ward-admissions.ts`. Absent until 2026-08-31 because the guard test never
  //    looked at that file; see this set's own comment for what each one was getting wrong.
  "pulledAt",
  "awayAtEmergencyDepartmentSince",
  "expectedDischargeAt",
  "dischargeDateSetAt",
  "dischargeConfirmedAt",
  "leftAt",
  // Nested one level down, inside `Admission.followUp`. `shift` recurses, so a name is still all
  // it takes — but a nested instant is exactly the kind this set loses track of, which is why it is
  // named here rather than left for the reader to notice.
  "recordedAt",
  // 2026-08-30, with `Referral.triagedAt`. Added because the guard test refused the commit
  // that introduced it, which is the whole point of that test: a triage instant left on the
  // old anchor would put a patient in the department for an extra day, beside a referral time
  // that had moved — and "18h in department" beside "40m since referral" reads as a data
  // error, not a bug, to the person looking at it.
  "triagedAt",
]);

/**
 * Returns a structurally identical copy with every `INSTANT_FIELDS` number moved by `offsetMinutes`.
 *
 * An offset of zero returns an equivalent copy rather than the original: the pinned path (tests,
 * deterministic renders) and the live path then differ only in the offset, never in whether a copy
 * was taken. A path that is only exercised when the offset is non-zero is a path no test runs.
 */
export function shiftInstants<T>(value: T, offsetMinutes: number): T {
  return shift(value, offsetMinutes) as T;
}

function shift(value: unknown, offsetMinutes: number): unknown {
  if (Array.isArray(value)) return value.map((entry) => shift(entry, offsetMinutes));
  if (value === null || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] =
      INSTANT_FIELDS.has(key) && typeof entry === "number"
        ? ((entry + offsetMinutes) as Instant)
        : shift(entry, offsetMinutes);
  }
  return result;
}
