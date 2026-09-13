import { onCallDetailsSchemaFor, type OnCallSection } from "@/lib/on-call/entry-model";
import { ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";

/**
 * Overlay the editor's form-owned keys onto the existing validated details.
 *
 * PATCH is a full replace (`updateOnCallEntrySchema`), and the editor only
 * owns a subset of each section's keys — it has no inputs for `kind`,
 * `checklist`, or (historically) `nextOccurrenceDate`. Starting from the
 * already-validated object and overlaying what the form actually sent is what
 * stops an ordinary title edit from turning a role explainer into a dialling
 * contact or deleting a checklist.
 *
 * Unrecognised existing details are ignored rather than copied: the schema is
 * `.strict()`, and smuggling an invalid key through would make the save fail
 * for a reason the editor cannot name.
 */
export function mergeOnCallEditorDetails({
  section,
  formDetails,
  existingDetails,
  roleExplainer,
}: {
  section: OnCallSection;
  formDetails: Record<string, unknown>;
  existingDetails?: unknown;
  /** Explicit Who's who discriminator. `true` writes it, `false` strips it, omitted leaves whatever merged. */
  roleExplainer?: boolean;
}): Record<string, unknown> {
  const parsed = onCallDetailsSchemaFor(section).safeParse(existingDetails);
  const base =
    parsed.success && parsed.data && typeof parsed.data === "object"
      ? { ...(parsed.data as Record<string, unknown>) }
      : {};
  const merged: Record<string, unknown> = { ...base, ...formDetails };

  if (section === "orientation") {
    merged.pinnedSummaryIsOwnerNote = true;
  }

  if (section === "contacts" && roleExplainer !== undefined) {
    if (roleExplainer) merged.kind = ROLE_EXPLAINER_KIND;
    else delete merged.kind;
  }

  return merged;
}
