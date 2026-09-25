import { z } from "zod";

export const serviceRoles = ["member", "editor", "admin"] as const;
export const serviceSections = [
  "contacts",
  "referrals",
  "resources",
  "documentation",
  "orientation",
  "teaching",
  "admin",
] as const;
export const serviceContentKinds = ["operational", "clinical", "legal"] as const;
export const serviceOrientationPhases = ["before_start", "first_shift", "first_week", "ongoing", "leaving"] as const;
const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(160);
const revision = z.number().int().positive();
const rotation = z.string().trim().min(1).max(100);

/** Links confer no document permissions and never invoke a source fetch. */
export const serviceSourceSchema = z
  .object({
    label: name,
    url: z
      .string()
      .url()
      .max(2000)
      .refine((raw) => {
        try {
          const url = new URL(raw);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !/^(localhost|.*\.localhost|.*\.local|\[.*\]|\d+(?:\.\d+){3})$/i.test(url.hostname)
          );
        } catch {
          return false;
        }
      }, "Use a public HTTPS source link without credentials."),
  })
  .strict();

export const serviceContentSchema = z
  .object({
    siteId: uuid.nullable(),
    section: z.enum(serviceSections),
    kind: z.enum(serviceContentKinds),
    title: name,
    body: z.string().trim().max(6000),
    phone: z.string().trim().max(80).default(""),
    sources: z.array(serviceSourceSchema).max(12),
    orientationPhase: z.enum(serviceOrientationPhases).default("first_shift"),
  })
  .strict();
export type ServiceContent = z.infer<typeof serviceContentSchema>;

export const serviceCreateSchema = z.object({ name, siteName: name }).strict();
export const serviceJoinSchema = z
  .object({
    code: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .transform((value) => value.toLowerCase()),
  })
  .strict();
export const serviceQuerySchema = z.object({ siteId: uuid.optional(), rotation: rotation.optional() });
export const serviceActionSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("site.create"), name }).strict(),
    z
      .object({
        action: z.literal("invitation.create"),
        role: z.enum(serviceRoles),
        expiresInDays: z.number().int().min(1).max(7),
      })
      .strict(),
    z.object({ action: z.literal("invitation.revoke"), invitationId: uuid }).strict(),
    z
      .object({
        action: z.literal("member.update"),
        memberId: uuid,
        role: z.enum(serviceRoles),
        clinicalReviewer: z.boolean(),
      })
      .strict(),
    z.object({ action: z.literal("member.revoke"), memberId: uuid }).strict(),
    serviceContentSchema
      .extend({
        action: z.literal("entry.save"),
        entryId: uuid.optional(),
        expectedRevision: revision.optional(),
        publish: z.boolean(),
      })
      .strict(),
    z
      .object({
        action: z.literal("entry.review"),
        entryId: uuid,
        expectedRevision: revision,
        decision: z.enum(["approve", "return"]),
        comment: z.string().trim().max(1500),
      })
      .strict(),
    z.object({ action: z.literal("entry.withdraw"), entryId: uuid, expectedRevision: revision }).strict(),
    z
      .object({ action: z.literal("report.create"), entryId: uuid, reason: z.string().trim().min(1).max(1500) })
      .strict(),
    z
      .object({ action: z.literal("report.resolve"), reportId: uuid, resolution: z.string().trim().min(1).max(1500) })
      .strict(),
    z
      .object({ action: z.literal("orientation.set"), entryId: uuid, siteId: uuid, rotation, completed: z.boolean() })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.action !== "entry.save") return;
    if (Boolean(value.entryId) !== Boolean(value.expectedRevision))
      ctx.addIssue({ code: "custom", message: "Editing requires the loaded revision.", path: ["expectedRevision"] });
    if (value.kind !== "operational" && value.sources.length === 0)
      ctx.addIssue({
        code: "custom",
        message: "Clinical and legal summaries need an official source link.",
        path: ["sources"],
      });
  });
export type ServiceAction = z.infer<typeof serviceActionSchema>;
export type ServiceRole = (typeof serviceRoles)[number];
export type ServiceSite = { id: string; name: string };
export type ServiceMembership = { role: ServiceRole; clinicalReviewer: boolean };
export type ServiceSummary = ServiceMembership & { id: string; name: string; sites: ServiceSite[] };
export type ServiceEntry = {
  id: string;
  revision: number;
  publishedRevision: number | null;
  content: ServiceContent;
  publishedContent: ServiceContent | null;
  status: "draft" | "pending_review" | "published" | "withdrawn";
  authorId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string;
  updatedAt: string;
};
export type ServiceMember = ServiceMembership & { id: string; joinedAt: string };
export type ServiceInvitation = {
  id: string;
  role: ServiceRole;
  expiresAt: string;
  revokedAt: string | null;
  usedAt: string | null;
};
export type ServiceReport = {
  id: string;
  entryId: string;
  reason: string;
  status: "open" | "resolved";
  resolution: string;
  createdAt: string;
};
export type ServiceOrientation = {
  entryId: string;
  siteId: string;
  rotation: string;
  revision: number;
  completedAt: string;
};
export type ServiceDetail = {
  service: { id: string; name: string };
  membership: ServiceMembership;
  sites: ServiceSite[];
  entries: ServiceEntry[];
  members: ServiceMember[];
  invitations: ServiceInvitation[];
  reports: ServiceReport[];
  orientation: ServiceOrientation[];
};
