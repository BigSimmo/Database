import { z } from "zod";

export const ON_CALL_SECTIONS = ["contacts", "playbook", "referrals", "orientation", "education", "logistics"] as const;

export type OnCallSection = (typeof ON_CALL_SECTIONS)[number];

/** Twelve months. Derived at read time, never stored, so changing this number
 *  never needs a migration or a backfill. */
export const ON_CALL_REVIEW_INTERVAL_MONTHS = 12;

export type OnCallFreshness =
  | { state: "fresh"; lastVerifiedAt: string }
  | { state: "stale"; reason: "never-verified"; lastVerifiedAt: null }
  | { state: "stale"; reason: "overdue"; lastVerifiedAt: string };

export function onCallEntryFreshness(
  entry: { lastVerifiedAt: string | null },
  now: Date = new Date(),
): OnCallFreshness {
  if (!entry.lastVerifiedAt) return { state: "stale", reason: "never-verified", lastVerifiedAt: null };
  const due = new Date(entry.lastVerifiedAt);
  due.setUTCMonth(due.getUTCMonth() + ON_CALL_REVIEW_INTERVAL_MONTHS);
  // On the boundary counts as overdue: a year-old number is not "still fine today".
  if (due.getTime() <= now.getTime()) {
    return { state: "stale", reason: "overdue", lastVerifiedAt: entry.lastVerifiedAt };
  }
  return { state: "fresh", lastVerifiedAt: entry.lastVerifiedAt };
}

const trimmed = z.string().trim().min(1);

const contactsDetails = z
  .object({
    role: trimmed,
    phone: trimmed.optional(),
    extension: trimmed.optional(),
    afterHoursPhone: trimmed.optional(),
    pager: trimmed.optional(),
    contactName: trimmed.optional(),
    availability: trimmed.optional(),
  })
  .strict();

const playbookDetails = z
  .object({
    trigger: trimmed,
    escalationSteps: z
      .array(
        z
          .object({
            order: z.number().int().min(1),
            whoToCall: trimmed,
            when: trimmed,
            phone: trimmed.optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const referralsDetails = z
  .object({
    accepts: z.array(trimmed).default([]),
    exclusions: z.array(trimmed).default([]),
    catchment: trimmed.optional(),
    hours: trimmed.optional(),
    howToRefer: trimmed.optional(),
    phone: trimmed.optional(),
    fax: trimmed.optional(),
    referralFormUrl: z.string().url().optional(),
  })
  .strict();

const orientationDetails = z.object({ pinnedSummaryIsOwnerNote: z.literal(true) }).strict();

const educationDetails = z
  .object({
    recurrence: trimmed.optional(),
    nextOccurrence: trimmed.optional(),
    presenter: trimmed.optional(),
    location: trimmed.optional(),
    recordingUrl: z.string().url().optional(),
    topics: z.array(trimmed).default([]),
  })
  .strict();

const logisticsDetails = z
  .object({
    category: trimmed,
    location: trimmed.optional(),
    hours: trimmed.optional(),
    phone: trimmed.optional(),
    url: z.string().url().optional(),
  })
  .strict();

const detailsSchemas = {
  contacts: contactsDetails,
  playbook: playbookDetails,
  referrals: referralsDetails,
  orientation: orientationDetails,
  education: educationDetails,
  logistics: logisticsDetails,
} as const satisfies Record<OnCallSection, z.ZodTypeAny>;

export function onCallDetailsSchemaFor(section: OnCallSection) {
  return detailsSchemas[section];
}

export const onCallEntrySchema = z
  .object({
    id: z.string().uuid(),
    section: z.enum(ON_CALL_SECTIONS),
    slug: trimmed,
    title: trimmed,
    subtitle: trimmed.nullable().default(null),
    body: z.string().nullable().default(null),
    details: z.unknown(),
    linkedDocumentIds: z.array(z.string().uuid()).default([]),
    tags: z.array(trimmed).default([]),
    isPersonal: z.boolean().default(false),
    includeOnCard: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
    lastVerifiedAt: z.string().nullable().default(null),
  })
  .strict();

export type OnCallEntry = z.infer<typeof onCallEntrySchema>;
