import { z } from "zod";

/**
 * My shifts: the doctor's own roster, private to them.
 *
 * Only these fields ever leave the device. An imported calendar file can also
 * carry descriptions, attendees and organisers, which can name colleagues; the
 * parsers drop them before anything reaches this shape.
 */

export const ON_CALL_SHIFT_TITLE_MAX = 200;
export const ON_CALL_SHIFT_LOCATION_MAX = 200;
export const ON_CALL_SHIFT_UID_MAX = 300;
/** Most shifts one import may carry (about a year of shifts, and small enough for the request limit). The database also caps an owner's total. */
export const ON_CALL_SHIFT_IMPORT_MAX = 400;
/** Longest believable shift. The database enforces the same limit. */
export const ON_CALL_SHIFT_MAX_HOURS = 36;
/** Most change lines stored per import. The counts stay exact beyond it. */
export const ON_CALL_SHIFT_CHANGES_MAX = 200;

export type OnCallShiftFormat = "ics" | "csv";

/** One shift as parsed or stored. Times are ISO instants. */
export type OnCallShiftInput = {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly title: string;
  readonly location: string | null;
  /** The source calendar's own ID for this shift, when it had one. Used to match revisions. */
  readonly sourceUid: string | null;
};

export type OnCallShift = OnCallShiftInput & { readonly id: string };

/** What a shift looked like, for a change line. No IDs: it is shown, never acted on. */
export type OnCallShiftSnapshot = Pick<OnCallShiftInput, "startsAt" | "endsAt" | "title" | "location">;

export type OnCallShiftChange =
  | { readonly kind: "added"; readonly after: OnCallShiftSnapshot }
  | { readonly kind: "moved"; readonly before: OnCallShiftSnapshot; readonly after: OnCallShiftSnapshot }
  | { readonly kind: "removed"; readonly before: OnCallShiftSnapshot };

export type OnCallShiftImportSummary = {
  readonly id: string;
  readonly importedAt: string;
  readonly format: OnCallShiftFormat;
  /** Perth dates, `YYYY-MM-DD`, inclusive. */
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
  readonly changes: readonly OnCallShiftChange[];
  readonly seenAt: string | null;
};

const isoInstant = z.string().datetime({ offset: true });
const perthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const onCallShiftInputSchema = z
  .object({
    startsAt: isoInstant,
    endsAt: isoInstant,
    title: z.string().trim().min(1).max(ON_CALL_SHIFT_TITLE_MAX),
    location: z.string().trim().max(ON_CALL_SHIFT_LOCATION_MAX).nullable(),
    sourceUid: z.string().trim().max(ON_CALL_SHIFT_UID_MAX).nullable(),
  })
  .strict()
  .refine((shift) => shiftLengthIsValid(shift.startsAt, shift.endsAt), {
    message: `A shift must end after it starts and last at most ${ON_CALL_SHIFT_MAX_HOURS} hours.`,
  });

const snapshotSchema = z
  .object({
    startsAt: isoInstant,
    endsAt: isoInstant,
    title: z.string().max(ON_CALL_SHIFT_TITLE_MAX),
    location: z.string().max(ON_CALL_SHIFT_LOCATION_MAX).nullable(),
  })
  .strict();

export const onCallShiftChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("added"), after: snapshotSchema }).strict(),
  z.object({ kind: z.literal("moved"), before: snapshotSchema, after: snapshotSchema }).strict(),
  z.object({ kind: z.literal("removed"), before: snapshotSchema }).strict(),
]);

/** The body of a roster save. The change list is recomputed on the server, never trusted from here. */
export const onCallShiftImportRequestSchema = z
  .object({
    format: z.enum(["ics", "csv"]),
    windowStart: perthDate,
    windowEnd: perthDate,
    shifts: z.array(onCallShiftInputSchema).max(ON_CALL_SHIFT_IMPORT_MAX),
  })
  .strict()
  .refine((body) => body.windowEnd >= body.windowStart, { message: "The roster dates are the wrong way round." });

export type OnCallShiftImportRequest = z.infer<typeof onCallShiftImportRequestSchema>;

export function shiftLengthIsValid(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end > start && end - start <= ON_CALL_SHIFT_MAX_HOURS * 60 * 60 * 1000;
}

export function shiftSnapshot(shift: OnCallShiftInput): OnCallShiftSnapshot {
  return { startsAt: shift.startsAt, endsAt: shift.endsAt, title: shift.title, location: shift.location };
}
