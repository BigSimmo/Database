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
 * Every field name in `ward-model.ts` whose value is an `Instant` - a point on the synthetic day,
 * as opposed to a duration or a count. Kept as names rather than a typed walk because the state is
 * a tree of plain seeded objects and the shift is uniform; the guard test is what keeps the list
 * honest.
 */
export const INSTANT_FIELDS: ReadonlySet<string> = new Set([
  "acceptedAt",
  "arrivedAt",
  "at",
  "bedHeldUntil",
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
