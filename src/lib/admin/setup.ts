import type { z } from "zod";

import type { createOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/** The setup sheet asks for two dates and nothing else (level is cut from update 1). */
export type SetupRequirement = "registration" | "indemnity";

/**
 * Each setup requirement is the catalogue item of the same name
 * (`src/lib/admin/requirements.ts`): the row carries its `requirementId`,
 * title and group so Renewals' checklist and Today's count see it as
 * recorded straight away. `legacyCategory` is the category an earlier setup
 * wrote (before the catalogue existed), still recognised so a doctor who ran
 * that setup is never asked again. The consequence is editable afterwards on
 * Renewals; both of these stop you working if they lapse.
 */
const SETUP_REQUIREMENTS = {
  registration: {
    requirementId: "medical-registration-renewal",
    title: "Medical registration renewal",
    category: "registration",
    legacyCategory: "Registration",
  },
  indemnity: {
    requirementId: "professional-indemnity-insurance",
    title: "Indemnity insurance declaration",
    category: "registration",
    legacyCategory: "Indemnity",
  },
} as const satisfies Record<
  SetupRequirement,
  { requirementId: string; title: string; category: string; legacyCategory: string }
>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Whether the reader already has a row for this setup requirement: the
 * catalogue item by `requirementId` or title (as Renewals records it), or the
 * category an earlier setup wrote.
 */
export function setupRequirementRecorded(entries: readonly OnCallEntry[], kind: SetupRequirement): boolean {
  const { requirementId, title, legacyCategory } = SETUP_REQUIREMENTS[kind];
  return entries.some((entry) => {
    if (!isComplianceEntry(entry)) return false;
    const details = entry.details as { category?: unknown; requirementId?: unknown };
    return (
      details.requirementId === requirementId ||
      normalized(entry.title) === normalized(title) ||
      normalized(details.category) === normalized(legacyCategory)
    );
  });
}

/**
 * True while the reader has recorded neither a registration nor an indemnity
 * row (spec review 5: read from the server's rows, never from the device).
 * Drives whether Today opens the setup sheet unprompted on first visit.
 */
export function needsSetup(entries: readonly OnCallEntry[]): boolean {
  return !setupRequirementRecorded(entries, "registration") && !setupRequirementRecorded(entries, "indemnity");
}

/**
 * Which of the two setup requirements are ready to create: a real typed date,
 * and no existing row of that category already recorded. A blank or malformed
 * date creates nothing (spec review 5: no guessed values).
 */
export function setupRequirementsToCreate(
  existing: readonly OnCallEntry[],
  dates: Partial<Record<SetupRequirement, string>>,
): SetupRequirement[] {
  return (Object.keys(SETUP_REQUIREMENTS) as SetupRequirement[]).filter(
    (kind) => DATE_KEY.test(dates[kind] ?? "") && !setupRequirementRecorded(existing, kind),
  );
}

/** The create body for one setup requirement, through the existing entry contract. */
export function buildSetupComplianceEntry(
  kind: SetupRequirement,
  expiresOn: string,
  slugSuffix: string,
): z.input<typeof createOnCallEntrySchema> {
  const { title, category, requirementId } = SETUP_REQUIREMENTS[kind];
  return {
    section: "logistics",
    slug: `${kind}-${slugSuffix}`,
    title,
    subtitle: null,
    body: null,
    details: {
      kind: "compliance",
      category,
      requirementId,
      consequence: "stops-work",
      expiresOn,
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: [],
    // Compliance rows are private by the server whatever the body says (PIA-9); say so here too.
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
  };
}
