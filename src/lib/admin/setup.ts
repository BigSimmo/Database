import type { z } from "zod";

import type { createOnCallEntrySchema } from "@/lib/on-call/api-schemas";
import { isComplianceEntry } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/** The setup sheet asks for two dates and nothing else (level is cut from update 1). */
export type SetupRequirement = "registration" | "indemnity";

/** The consequence is editable afterwards on Renewals; both of these stop you working if they lapse. */
const SETUP_REQUIREMENTS = {
  registration: { title: "Medical registration", category: "Registration" },
  indemnity: { title: "Professional indemnity", category: "Indemnity" },
} as const satisfies Record<SetupRequirement, { title: string; category: string }>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function hasCategory(entries: readonly OnCallEntry[], category: string): boolean {
  return entries.some((entry) => {
    if (!isComplianceEntry(entry)) return false;
    const value = (entry.details as { category?: unknown }).category;
    return typeof value === "string" && value.trim().toLowerCase() === category.toLowerCase();
  });
}

/**
 * True while the reader has recorded neither a registration nor an indemnity
 * row (spec review 5: read from the server's rows, never from the device).
 * Drives whether Today opens the setup sheet unprompted on first visit.
 */
export function needsSetup(entries: readonly OnCallEntry[]): boolean {
  return (
    !hasCategory(entries, SETUP_REQUIREMENTS.registration.category) &&
    !hasCategory(entries, SETUP_REQUIREMENTS.indemnity.category)
  );
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
    (kind) => DATE_KEY.test(dates[kind] ?? "") && !hasCategory(existing, SETUP_REQUIREMENTS[kind].category),
  );
}

/** The create body for one setup requirement, through the existing entry contract. */
export function buildSetupComplianceEntry(
  kind: SetupRequirement,
  expiresOn: string,
  slugSuffix: string,
): z.input<typeof createOnCallEntrySchema> {
  const { title, category } = SETUP_REQUIREMENTS[kind];
  return {
    section: "logistics",
    slug: `${kind}-${slugSuffix}`,
    title,
    subtitle: null,
    body: null,
    details: { kind: "compliance", category, consequence: "stops-work", expiresOn, provenance: "typed" },
    linkedDocumentIds: [],
    tags: [],
    // Compliance rows are private by the server whatever the body says (PIA-9); say so here too.
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
  };
}
