import { type z } from "zod";

import { COMPLIANCE_KIND } from "@/lib/on-call/compliance";
import { onCallDetailsSchemaFor, type OnCallSection } from "@/lib/on-call/entry-model";
import { ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";

/**
 * What survives from a stored `details` object the section schema REFUSES.
 *
 * A whole-object parse is all-or-nothing, and treating its failure as an empty
 * object is a silent wipe: the merge would then start from `{}`, the form would
 * overlay the handful of keys it owns, and every other stored field would leave
 * the database for good. On a compliance requirement that is the expiry date,
 * what lapsing costs, the issuing body, the evidence link and the provenance —
 * gone because the owner opened the row and corrected its title. One stray
 * character in any stored value, or one unrecognised extra key (every section
 * schema is `.strict()`), is enough to start it. The row still renders, because
 * `rowToOnCallEntry` nulls details it cannot read and returns the row anyway,
 * so nothing warns anybody first.
 *
 * So a failed parse falls back to a key-by-key salvage: every stored key the
 * schema knows AND whose own value the schema accepts is kept, and only the
 * keys it actually rejects are dropped.
 *
 * Keeping the rejected values too would be worse, not better, and this is the
 * reason it is not done. The API validates `details` against this same strict
 * schema on write (`src/app/api/on-call/entries/[id]/route.ts`), and so does
 * the editor before it sends. A value the schema refuses therefore cannot be
 * written back by any route in this app: carrying it through the merge would
 * turn a silent wipe into a row that can never be saved again, which is not an
 * improvement for the person holding it. Salvage preserves everything that is
 * actually writable, and the fields it drops are exactly the ones the owner can
 * see and retype in the form.
 */
function salvageExistingDetails(section: OnCallSection, existingDetails: unknown): Record<string, unknown> {
  const schema = onCallDetailsSchemaFor(section);
  const parsed = schema.safeParse(existingDetails);
  if (parsed.success && parsed.data && typeof parsed.data === "object") {
    return { ...(parsed.data as Record<string, unknown>) };
  }
  if (!existingDetails || typeof existingDetails !== "object") return {};

  // Every section schema is a `z.object(...).strict()`, so `shape` is the map
  // of keys to their own validators. Read defensively rather than asserted: if
  // a section ever moves to a union or an intersection there is no shape to
  // walk, and returning nothing salvageable is the behaviour this fix replaced
  // — bad, but not newly bad, and it cannot throw in the owner's face.
  const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (!shape) return {};

  const salvaged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existingDetails as Record<string, unknown>)) {
    if (value === undefined) continue;
    // An unrecognised key is dropped, exactly as a successful strict parse
    // drops it: smuggling it onward would make the save fail for a reason the
    // editor cannot name against any field.
    const field = shape[key];
    if (!field) continue;
    const parsedField = field.safeParse(value);
    if (parsedField.success) salvaged[key] = parsedField.data;
  }
  return salvaged;
}

/**
 * Overlay the editor's form-owned keys onto the existing validated details.
 *
 * PATCH is a full replace (`updateOnCallEntrySchema`), and the editor only
 * owns a subset of each section's keys — it has no inputs for `kind`,
 * `checklist`, or (historically) `nextOccurrenceDate`. Starting from the
 * already-validated object and overlaying what the form actually sent is what
 * stops an ordinary title edit from turning a role explainer into a dialling
 * contact, an expiring requirement into an admin note, or deleting a checklist.
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
 * stored value, and silence cannot do that. It is also how the editor removes
 * the fields that belong to the Admin/Compliance taxonomy a row has just left,
 * which must be deleted rather than left behind where no page renders them.
 *
 * A stored object the schema refuses is salvaged key by key rather than
 * treated as empty — see `salvageExistingDetails`. Deliberate clearing is
 * unaffected: `clearedKeys` is applied after the overlay either way.
 */
export function mergeOnCallEditorDetails({
  section,
  formDetails,
  existingDetails,
  roleExplainer,
  complianceRequirement,
  clearedKeys,
}: {
  section: OnCallSection;
  formDetails: Record<string, unknown>;
  existingDetails?: unknown;
  /** Explicit Who's who discriminator. `true` writes it, `false` strips it, omitted leaves whatever merged. */
  roleExplainer?: boolean;
  /**
   * Explicit Compliance discriminator, the `logistics` mirror of
   * `roleExplainer`. `true` writes it, `false` strips it, omitted leaves
   * whatever merged.
   *
   * Separate from `roleExplainer` despite writing the same `kind` key, because
   * the two mean different things in different sections and a shared flag would
   * let a contacts form strip a compliance row's discriminator.
   */
  complianceRequirement?: boolean;
  /** Keys the form actively turned off, removed after the overlay. See above. */
  clearedKeys?: readonly string[];
}): Record<string, unknown> {
  const base = salvageExistingDetails(section, existingDetails);
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

  if (section === "logistics" && complianceRequirement !== undefined) {
    if (complianceRequirement) merged.kind = COMPLIANCE_KIND;
    else delete merged.kind;
  }

  return merged;
}
