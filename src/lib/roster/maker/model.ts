import { z } from "zod";

import { ROSTER_ASSIGNMENT_KINDS, ROSTER_GRADES } from "@/lib/roster/team/model";

const uuid = z.string().uuid();
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const changeId = z.string().regex(/^[1-9]\d{0,18}$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, "Choose a valid date.");
const instant = z.string().datetime({ offset: true });
const row = z
  .object({
    userId: uuid.nullable(),
    rosterName: z.string().trim().min(1).max(80).nullable(),
    siteId: uuid.nullable(),
    startsAt: instant,
    endsAt: instant,
    shiftCode: z.string().trim().min(1).max(12),
    kind: z.enum(ROSTER_ASSIGNMENT_KINDS),
    grade: z.enum(ROSTER_GRADES).nullable(),
  })
  .strict();
function validDuration(value: { startsAt: string; endsAt: string }) {
  const hours = (Date.parse(value.endsAt) - Date.parse(value.startsAt)) / 3_600_000;
  return hours > 0 && hours <= 36;
}
export const rosterDraftOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), row: row.refine(validDuration, "Choose a shift of up to 36 hours.") }).strict(),
  z
    .object({ op: z.literal("update"), id: uuid, row: row.partial().refine((value) => Object.keys(value).length > 0) })
    .strict(),
  z.object({ op: z.literal("remove"), id: uuid }).strict(),
]);
export const rosterDraftActionSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("draft.open"), periodStart: date, periodEnd: date }).strict(),
    z
      .object({
        action: z.literal("draft.change"),
        draftId: uuid,
        expectedVersion: version,
        source: z.enum(["grid", "typed", "upload"]),
        ops: z.array(rosterDraftOperationSchema).min(1).max(500),
      })
      .strict(),
    z.object({ action: z.literal("draft.undo"), draftId: uuid, expectedVersion: version, changeId }).strict(),
  ])
  .refine((action) => {
    if (action.action !== "draft.open") return true;
    const days = (Date.parse(action.periodEnd) - Date.parse(action.periodStart)) / 86_400_000;
    return days >= 0 && days <= 186;
  }, "Choose a period of up to 186 days.");

// Read payloads include derived display fields; request rows remain strict.
export const rosterDraftAssignmentSchema = row.extend({ id: uuid }).strip().refine(validDuration);
export const rosterDraftSchema = z.object({
  draft: z.object({ id: uuid, periodStart: date, periodEnd: date, basedOnPublicationId: uuid.nullable(), version }),
  assignments: z.array(rosterDraftAssignmentSchema).max(5000),
  changes: z.array(
    z.object({
      id: changeId,
      actorId: uuid.nullable(),
      at: instant,
      source: z.string(),
      change: z.record(z.string(), z.unknown()),
      undoneAt: instant.nullable(),
      canUndo: z.boolean(),
    }),
  ),
});
export const rosterDraftReceiptSchema = z.object({ draftId: uuid, version });
export type RosterDraft = z.infer<typeof rosterDraftSchema>;
export type RosterDraftAssignment = z.infer<typeof rosterDraftAssignmentSchema>;
export type RosterDraftOperation = z.infer<typeof rosterDraftOperationSchema>;
export type RosterDraftAction = z.infer<typeof rosterDraftActionSchema>;
