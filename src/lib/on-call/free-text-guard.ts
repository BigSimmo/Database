import { identifierShapeWarning } from "@/lib/clinical-ask/context";

/**
 * Spec review 11: the server refuses text that looks like a patient identifier in
 * Admin's free-text fields, reusing the one identifier pattern the app already has.
 * Update 1's only Admin free-text field is `proofNote`; update 2 adds its own.
 * Server-side only: the entries routes call it after parsing and before writing.
 */
export function adminFreeTextProblem(details: unknown): string | null {
  if (typeof details !== "object" || details === null) return null;
  const note = (details as { proofNote?: unknown }).proofNote;
  return typeof note === "string" && identifierShapeWarning(note)
    ? "Keep patient details out of this note. Say where your proof is, for example: email from Ahpra."
    : null;
}
