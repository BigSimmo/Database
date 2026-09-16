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
 * while leaving canonical governance / release identity to the caller. Services
 * and other kinds are unchanged.
 */
export function preferBundledFormRecord<T extends { record: ServiceRecord }>(kind: string, mapped: T): T {
  if (kind !== "form") return mapped;
  const bundled = getFormRecord(mapped.record.slug);
  if (!bundled) return mapped;
  return { ...mapped, record: bundled };
}
