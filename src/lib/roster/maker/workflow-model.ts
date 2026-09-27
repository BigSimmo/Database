import { z } from "zod";
import { ROSTER_ASSIGNMENT_KINDS, ROSTER_GRADES } from "@/lib/roster/team/model";

const uuid = z.string().uuid();
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s,
  );
const instant = z.string().datetime({ offset: true });
const changeId = z.string().regex(/^[1-9]\d{0,18}$/);
const need = z
  .object({
    weekday: z.number().int().min(1).max(7).nullable(),
    date: date.nullable(),
    kind: z.enum(["day", "evening", "night", "on_call", "other"]),
    grade: z.enum(["intern", "resident", "registrar", "fellow", "consultant"]).nullable(),
    siteId: uuid.nullable(),
    needed: z.number().int().min(0).max(200),
  })
  .strict()
  .refine((v) => (v.weekday === null) !== (v.date === null));
export const rosterMakerRulesSchema = z
  .object({
    minBreakHours: z.number().min(0).max(48).nullable(),
    maxHours7d: z.number().min(1).max(168).nullable(),
    source: z.string().trim().min(1).max(200).nullable(),
    reviewedOn: date.nullable(),
  })
  .strict();
const reviewedRules = rosterMakerRulesSchema.refine(
  (v) => (v.minBreakHours === null && v.maxHours7d === null) || (v.source !== null && v.reviewedOn !== null),
);
export const rosterMakerComparisonRowSchema = z.object({
  userId: uuid.nullable(),
  rosterName: z.string().nullable(),
  siteId: uuid.nullable(),
  startsAt: instant,
  endsAt: instant,
  shiftCode: z.string(),
  kind: z.enum(ROSTER_ASSIGNMENT_KINDS),
  grade: z.enum(ROSTER_GRADES).nullable(),
});
const rows = z.array(rosterMakerComparisonRowSchema).max(5000);
const affected = z.object({
  userId: uuid,
  displayName: z.string(),
  before: rows,
  after: rows,
  agreedAt: instant.nullable(),
});
export const rosterMakerProposalSchema = z.object({
  id: uuid,
  draftId: uuid,
  draftVersion: version,
  periodStart: date,
  periodEnd: date,
  scope: z.enum(["full", "change"]),
  changeId: changeId.nullable(),
  createdAt: instant,
  status: z.enum(["pending", "stale", "published"]),
  before: rows,
  after: rows,
  affected: z.array(affected).max(5000),
  blockers: z.array(z.enum(["unlinked_duty", "inactive_doctor", "protected_change"])),
  protectedChanges: z.array(z.object({ kind: z.enum(["swap", "open"]), id: uuid, before: rows })),
  canPublish: z.boolean(),
});
export const rosterMakerStateSchema = z.object({
  settingsToken: z.string().min(1),
  needs: z.array(need.safeExtend({ id: uuid })).max(2000),
  rules: rosterMakerRulesSchema,
  proposals: z.array(rosterMakerProposalSchema).max(30),
  reconciliation: z
    .object({ draftId: uuid, draftVersion: version, liveToken: z.string(), before: rows, after: rows })
    .nullable(),
});
export const rosterMyAgreementProposalSchema = z.object({
  id: uuid,
  draftId: uuid,
  draftVersion: version,
  periodStart: date,
  periodEnd: date,
  scope: z.enum(["full", "change"]),
  createdAt: instant,
  status: z.enum(["pending", "stale", "published"]),
  before: rows,
  after: rows,
  agreedAt: instant.nullable(),
});
export const rosterMyAgreementsSchema = z.object({ proposals: z.array(rosterMyAgreementProposalSchema).max(50) });
export const rosterMakerActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("settings.save"),
      expectedToken: z.string().min(1).max(256),
      needs: z.array(need).max(2000),
      rules: reviewedRules,
    })
    .strict(),
  z
    .object({
      action: z.literal("proposal.create"),
      draftId: uuid,
      expectedVersion: version,
      scope: z.enum(["full", "change"]),
      changeId: changeId.optional(),
      overrideChanges: z
        .array(z.object({ kind: z.enum(["swap", "open"]), id: uuid }).strict())
        .max(5000)
        .default([]),
    })
    .strict()
    .refine((v) => (v.scope === "change" ? v.changeId !== undefined : v.changeId === undefined)),
  z.object({ action: z.literal("proposal.publish"), proposalId: uuid }).strict(),
  z
    .object({
      action: z.literal("draft.reconcile"),
      draftId: uuid,
      expectedVersion: version,
      expectedLiveToken: z.string().min(1).max(256),
    })
    .strict(),
]);
export const rosterAgreementActionSchema = z.object({ action: z.literal("agree"), proposalId: uuid }).strict();
export const rosterMakerPublicationReceiptSchema = z.object({
  publicationId: uuid,
  version,
  draftVersion: version,
  changedUserIds: z.array(uuid),
  swapsCancelled: z.array(z.object({ id: uuid, requesterId: uuid, counterpartyId: uuid })),
  replayed: z.boolean(),
});
export type RosterMakerRules = z.infer<typeof rosterMakerRulesSchema>;
export type RosterStaffingNeed = z.infer<typeof rosterMakerStateSchema>["needs"][number];
export type RosterMakerProposal = z.infer<typeof rosterMakerProposalSchema>;
export type RosterMakerState = z.infer<typeof rosterMakerStateSchema>;
export type RosterMyAgreements = z.infer<typeof rosterMyAgreementsSchema>;
export type RosterMakerAction = z.infer<typeof rosterMakerActionSchema>;
