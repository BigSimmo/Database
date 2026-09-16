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
 *
 * `clearedKeys` exists because an overlay cannot express "off". The editor omits
 * an empty field rather than sending a blank, which is right for text — clearing
 * a phone number by emptying the box would be indistinguishable from a control
 * the form never rendered. But a control whose off position is a real choice,
 * like a teaching session that no longer repeats, has to be able to beat the
 * stored value, and silence cannot do that.
 */
export function mergeOnCallEditorDetails({
  section,
  formDetails,
  existingDetails,
  roleExplainer,
  clearedKeys,
}: {
  section: OnCallSection;
  formDetails: Record<string, unknown>;
  existingDetails?: unknown;
  /** Explicit Who's who discriminator. `true` writes it, `false` strips it, omitted leaves whatever merged. */
  roleExplainer?: boolean;
  /** Keys the form actively turned off, removed after the overlay. See above. */
  clearedKeys?: readonly string[];
}): Record<string, unknown> {
  const parsed = onCallDetailsSchemaFor(section).safeParse(existingDetails);
  const base =
    parsed.success && parsed.data && typeof parsed.data === "object"
      ? { ...(parsed.data as Record<string, unknown>) }
      : {};
  const merged: Record<string, unknown> = { ...base, ...formDetails };

  // Deleted rather than set to undefined: the schema is `.strict()` and the
  // result is serialised to JSON, so a present-but-undefined key is a different
  // shape from an absent one depending on which of the two reads it first.
  for (const key of clearedKeys ?? []) delete merged[key];

  if (section === "orientation") {
    merged.pinnedSummaryIsOwnerNote = true;
  }

  if (section === "contacts" && roleExplainer !== undefined) {
    if (roleExplainer) merged.kind = ROLE_EXPLAINER_KIND;
    else delete merged.kind;
  }

  return merged;
}
