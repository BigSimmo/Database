import medicationSourceLinkMap from "@/data/medication-source-links.json";
import {
  acquisitionAttestedContentSha256,
  sourceAcquisitionRecords,
  type SourceAcquisitionRecord,
} from "@/lib/sources/acquisition-ledger";
import { safeCanonicalSourceUrl } from "@/lib/sources/source-url-policy";

/** A source link a medication page may show: one the owner has signed off as it now stands. */
export type MedicationSourceLink = {
  id: string;
  title: string;
  publisher: string;
  href: string;
};

/** Medication slug → source-acquisition record ids (ledger #05WXHX step 2). */
export type MedicationSourceLinkMap = Readonly<Record<string, readonly string[]>>;

export const medicationSourceLinkIds: MedicationSourceLinkMap = medicationSourceLinkMap;

/**
 * True only when the owner's sign-off still covers the record exactly as it now
 * stands: reviewed or approved, not rejected, all three attestation fields
 * written, and the attested digest equal to the record's current content digest.
 * A record corrected after sign-off fails the digest and drops back out.
 */
export function isConfirmedAcquisitionRecord(record: SourceAcquisitionRecord): boolean {
  if (record.disposition === "rejected") return false;
  if (record.validationStatus !== "locally_reviewed" && record.validationStatus !== "approved") return false;
  if (!record.attestedBy?.trim() || !record.attestedAt?.trim()) return false;
  const attested = record.attestedAgainstSha256?.trim();
  return Boolean(attested) && attested === acquisitionAttestedContentSha256(record);
}

/**
 * The confirmed source links for one medication page. Anything unconfirmed,
 * stale, missing from the register or without a governed URL renders nothing,
 * so the page is unchanged until the owner signs the record off.
 */
export function medicationSourceLinks(
  slug: string,
  {
    links = medicationSourceLinkIds,
    records = sourceAcquisitionRecords,
  }: { links?: MedicationSourceLinkMap; records?: readonly SourceAcquisitionRecord[] } = {},
): MedicationSourceLink[] {
  const ids = Object.hasOwn(links, slug) ? links[slug] : [];
  if (!ids?.length) return [];
  const byId = new Map(records.map((record) => [record.id, record]));

  return ids.flatMap((id) => {
    const record = byId.get(id);
    if (!record || !isConfirmedAcquisitionRecord(record)) return [];
    const href = safeCanonicalSourceUrl(record.canonicalUrl);
    return href ? [{ id: record.id, title: record.title, publisher: record.publisher, href }] : [];
  });
}
