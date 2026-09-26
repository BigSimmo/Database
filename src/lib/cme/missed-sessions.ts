import { z } from "zod";

import { cmeDateSchema } from "@/lib/cme/schemas";

/**
 * A teaching or supervision session lost to clinical work, with the ordinary
 * CME activity that replaced it (if any) linked back.
 *
 * This record earns **no CPD credit of its own** — see `docs/cme` for the
 * design decision. It must never be read by `@/lib/cme/evaluate`, year close,
 * the CSV export or the annual summary: nothing here may change hours or a
 * requirement's status. The replacement is an ordinary `cme_entries` row,
 * logged and counted through the normal save path.
 */

export type CmeMissedSessionKind = "teaching" | "supervision";

export type CmeMissedSession = {
  readonly id: string;
  readonly occurredOn: string;
  readonly kind: CmeMissedSessionKind;
  readonly title: string;
  readonly minutesLost: number;
  readonly reason: string | null;
  readonly replacementEntryId: string | null;
};

export const CME_MISSED_SESSION_TITLE_MIN = 3;
export const CME_MISSED_SESSION_TITLE_MAX = 200;
export const CME_MISSED_SESSION_MINUTES_MIN = 1;
export const CME_MISSED_SESSION_MINUTES_MAX = 600;
export const CME_MISSED_SESSION_REASON_MAX = 200;

/** Shown beside the reason field. The reason is never sent anywhere but the owner's own record. */
export const CME_MISSED_SESSION_REASON_HINT = "Don't include patient details.";

// A real calendar date, so an impossible one is a 400 rather than a Postgres `date` error (500).
const isoDate = cmeDateSchema;

/** Full-replace shape, used for both create and update — same idiom as `cmeEntryUpdateSchema`. */
export const cmeMissedSessionCreateSchema = z
  .object({
    occurredOn: isoDate,
    kind: z.enum(["teaching", "supervision"]),
    title: z.string().trim().min(CME_MISSED_SESSION_TITLE_MIN).max(CME_MISSED_SESSION_TITLE_MAX),
    minutesLost: z.number().int().min(CME_MISSED_SESSION_MINUTES_MIN).max(CME_MISSED_SESSION_MINUTES_MAX),
    // Empty string and omission both mean "no reason"; the repository stores either as null.
    reason: z
      .string()
      .trim()
      .max(CME_MISSED_SESSION_REASON_MAX)
      .nullable()
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .strict();

export type CmeMissedSessionCreateInput = z.infer<typeof cmeMissedSessionCreateSchema>;
/** An edit is a full replace, so it takes the same body as a create. */
export type CmeMissedSessionUpdateInput = CmeMissedSessionCreateInput;

/** `replacementEntryId: null` unlinks; a uuid links (or re-links) a replacement. */
export const cmeMissedSessionReplacementSchema = z
  .object({ replacementEntryId: z.string().uuid().nullable() })
  .strict();
export type CmeMissedSessionReplacementInput = z.infer<typeof cmeMissedSessionReplacementSchema>;

type MissedSessionRow = {
  id: string;
  occurred_on: string;
  kind: string;
  title: string;
  minutes_lost: number;
  reason: string | null;
  replacement_entry_id: string | null;
};

export function rowToCmeMissedSession(row: MissedSessionRow): CmeMissedSession {
  return {
    id: row.id,
    occurredOn: row.occurred_on,
    kind: row.kind as CmeMissedSessionKind,
    title: row.title,
    minutesLost: row.minutes_lost,
    reason: row.reason,
    replacementEntryId: row.replacement_entry_id,
  };
}
