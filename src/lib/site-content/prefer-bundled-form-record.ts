import { FORMS_AWAITING_REVIEW_NOTE } from "@/lib/form-catalog";
import { getFormRecord } from "@/lib/forms";
import type { ServiceRecord } from "@/lib/services";

/**
 * Keep Forms mode synchronized with the in-repo catalogue when the active
 * site-content release still carries an older form projection.
 *
 * Why this exists
 * ---------------
 * `site_content_release_records` is append-only: the
 * `site_content_release_records_immutable` trigger rejects UPDATE/DELETE with
 * `site_content_immutable_row`. A forms handover that only refreshes
 * `formRecords` / the P03 bootstrap blob therefore cannot rewrite payloads
 * already frozen into an initialized active release. Publishing a new release
 * (operator `publish_site_content_record` + activate) is the durable cutover;
 * until that lands, the registry API would otherwise swap the SSR catalogue
 * paint for stale canonical bytes and drop `contentReviewStatus` / guidance.
 *
 * This helper prefers the bundled `formRecords` projection for `kind=form`
 * while leaving release identity to the caller. Services and other kinds are
 * unchanged.
 *
 * Governance must follow the content it describes
 * -----------------------------------------------
 * `canonicalSiteContentGovernance` derives `validationStatus` from the canonical
 * record, which describes the release payload this helper has just replaced. Left
 * alone, a form whose bundled guidance is explicitly drafted and awaiting clinical
 * review would be served carrying the release's `approved` or `locally_reviewed`
 * badge — a sign-off label attached to text nobody has signed off. The record's own
 * awaiting-review note is the signal, so a drafted swap narrows `validationStatus`
 * to `unverified`, which is the conservative value the enum already has.
 *
 * `sourceStatus` is deliberately left canonical: it describes the approved form on
 * the OCP register, which the handover re-verified rather than changed.
 */
type MappedFormEntry = { record: ServiceRecord; governance?: { validationStatus?: string } };

/** True when the bundled record still carries the drafted/awaiting-review caveat. */
function awaitsClinicalReview(record: ServiceRecord) {
  return (record.verification?.notes ?? []).includes(FORMS_AWAITING_REVIEW_NOTE);
}

export function preferBundledFormRecord<T extends MappedFormEntry>(kind: string, mapped: T): T {
  if (kind !== "form") return mapped;
  const bundled = getFormRecord(mapped.record.slug);
  if (!bundled) return mapped;
  const swapped = { ...mapped, record: bundled };
  if (!mapped.governance || !awaitsClinicalReview(bundled)) return swapped;
  return { ...swapped, governance: { ...mapped.governance, validationStatus: "unverified" } };
}
