import { FORMS_AWAITING_REVIEW_NOTE } from "@/lib/form-catalog";
import { getFormRecord } from "@/lib/forms";
import type { ServiceRecord } from "@/lib/services";
import { isRetainedBootstrapReleaseId } from "@/lib/site-content/site-content-health";

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
 * Gate
 * ----
 * The bundled preference applies ONLY while the served active release is still
 * a retained epoch-zero bootstrap identity (`isRetainedBootstrapReleaseId`).
 * Once an operator publishes and activates a non-bootstrap release, that
 * release's form projections win and this helper becomes a no-op — otherwise
 * every future clinician-reviewed publish would keep losing to the bundle.
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

/** Pull `releaseId` from a `read_site_content_public_records` snapshot object. */
export function siteContentSnapshotReleaseId(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const releaseId = (snapshot as Record<string, unknown>).releaseId;
  return typeof releaseId === "string" ? releaseId : null;
}

export function preferBundledFormRecord<T extends MappedFormEntry>(
  kind: string,
  mapped: T,
  options?: { activeReleaseId?: string | null },
): T {
  if (kind !== "form") return mapped;
  const activeReleaseId = options?.activeReleaseId;
  // Strict retained-bootstrap gate: without a recognised bootstrap release id,
  // leave the canonical projection alone so post-publish updates can win.
  if (!activeReleaseId || !isRetainedBootstrapReleaseId(activeReleaseId)) return mapped;
  const bundled = getFormRecord(mapped.record.slug);
  if (!bundled) return mapped;
  const swapped = { ...mapped, record: bundled };
  if (!mapped.governance || !awaitsClinicalReview(bundled)) return swapped;
  return { ...swapped, governance: { ...mapped.governance, validationStatus: "unverified" } };
}
