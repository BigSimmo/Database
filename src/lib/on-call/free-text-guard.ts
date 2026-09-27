import { identifierShapeWarning } from "@/lib/clinical-ask/context";

/**
 * Spec review 11: the server refuses text that looks like a patient identifier in
 * Admin's free-text fields, reusing the one identifier pattern the app already has.
 * Server-side only: the entries routes call it after parsing and before writing.
 */
export function adminFreeTextProblem(entry: {
  section: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  details: unknown;
}): string | null {
  // Admin owns logistics, and reuses contacts for workforce details. Checking
  // the entire parsed entry prevents Quick Add and Help edits bypassing the
  // proof-note check by putting the identifier in their title or body.
  if (entry.section !== "logistics" && entry.section !== "contacts") return null;
  const details =
    typeof entry.details === "object" && entry.details !== null
      ? Object.values(entry.details as Record<string, unknown>)
      : [];
  const fields = [entry.title, entry.subtitle, entry.body, ...details];
  return fields.some((field) => typeof field === "string" && identifierShapeWarning(field))
    ? "Keep patient details out of Admin records. Say where your proof is, for example: email from Ahpra."
    : null;
}
