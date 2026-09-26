import { acquisitionSourceReferences, type SourceAcquisitionRecord } from "@/lib/sources/acquisition-ledger";
import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import type {
  ClinicalSourceCatalogueEntry,
  ClinicalSourceReferenceInput,
  SourceCatalogueWarning,
} from "@/lib/sources/catalogue-types";

/**
 * What the owner sees about a ledger source's rating before signing it off with
 * `npm run clinical:review -- --kind source` (scripts/lib/signoff-kinds/sources.mjs).
 *
 * Two views, because they answer different questions:
 *
 * - `standalone`: the record rated on its own, exactly as `check:source-acquisitions`
 *   rates it. Signing moves `validationStatus` from `unverified` to `locally_reviewed`,
 *   which lifts accuracy assurance from 5 to 20 and clears `verification_unknown`.
 * - `catalogue`: the entry `/sources` shows, which merges every reference to the same
 *   source. The merge keeps the weakest validation status, so signing one ledger record
 *   does not lift an entry while another reference to it (a duplicate ledger record, or a
 *   content reference that is itself unverified) stays unverified.
 *
 * Both are computed from repository references only; `/sources` in production also merges
 * hosted documents, which need the database and are not consulted here.
 */

type AcquisitionRatingSummary = {
  band: ClinicalSourceCatalogueEntry["rating"]["band"];
  score: number;
  validationStatus: ClinicalSourceCatalogueEntry["validationStatus"];
  geography: string;
  warnings: SourceCatalogueWarning[];
  /** How many distinct places (ledger records and content citations) the entry lists as using it. */
  usages: number;
};

type AcquisitionSignOffRating = {
  standalone: { now: AcquisitionRatingSummary; ifReviewed: AcquisitionRatingSummary };
  catalogue: { now: AcquisitionRatingSummary; ifReviewed: AcquisitionRatingSummary } | null;
};

/** The validation status an owner sign-off writes: `unverified` becomes `locally_reviewed`. */
export function signedValidationStatus(
  status: SourceAcquisitionRecord["validationStatus"],
): SourceAcquisitionRecord["validationStatus"] {
  return status === "unverified" ? "locally_reviewed" : status;
}

const isLedgerUsage = (reference: ClinicalSourceReferenceInput) =>
  reference.usage.modeId === "sources" && reference.usage.field === "acquisition_ledger";

function summary(entry: ClinicalSourceCatalogueEntry, usages: number): AcquisitionRatingSummary {
  return {
    band: entry.rating.band,
    score: entry.rating.score,
    validationStatus: entry.validationStatus,
    geography: entry.geography.label,
    warnings: entry.warnings,
    usages,
  };
}

/** The entry holding one ledger record, from a set of references it belongs to. */
function entryFor(references: readonly ClinicalSourceReferenceInput[], id: string) {
  const entries = canonicalizeSourceReferences(references);
  return entries.find((entry) =>
    entry.usedBy.some(
      (usage) => usage.modeId === "sources" && usage.field === "acquisition_ledger" && usage.recordId === id,
    ),
  );
}

/**
 * Ratings for every ledger record, now and as they would stand once signed.
 *
 * `contentReferences` are the repository's other references (everything
 * `repositorySourceReferences()` returns except the ledger's own). References are grouped by
 * the catalogue identity each has on its own, so only the group a record merges with is
 * re-rated; tests/signoff-sources.test.ts checks that this equals the full catalogue.
 */
export function acquisitionSignOffRatings(
  records: readonly SourceAcquisitionRecord[],
  contentReferences: readonly ClinicalSourceReferenceInput[] = [],
): Record<string, AcquisitionSignOffRating> {
  const ledgerReferences = acquisitionSourceReferences(records);
  const everyReference = [...contentReferences.filter((reference) => !isLedgerUsage(reference)), ...ledgerReferences];
  const groups = new Map<string, ClinicalSourceReferenceInput[]>();
  const groupOf = new Map<ClinicalSourceReferenceInput, string>();
  for (const reference of everyReference) {
    const [solo] = canonicalizeSourceReferences([reference]);
    const key = solo?.id ?? "";
    groupOf.set(reference, key);
    const group = groups.get(key);
    if (group) group.push(reference);
    else groups.set(key, [reference]);
  }

  const ratings: Record<string, AcquisitionSignOffRating> = {};
  records.forEach((record, index) => {
    const reference = ledgerReferences[index]!;
    const signedRecord = { ...record, validationStatus: signedValidationStatus(record.validationStatus) };
    const [signedReference] = acquisitionSourceReferences([signedRecord]);
    const [standaloneNow] = canonicalizeSourceReferences([reference]);
    const [standaloneSigned] = canonicalizeSourceReferences([signedReference!]);
    const group = groups.get(groupOf.get(reference)!) ?? [reference];
    const merged = entryFor(group, record.id);
    const mergedSigned = entryFor(
      group.map((member) => (member === reference ? signedReference! : member)),
      record.id,
    );
    ratings[record.id] = {
      standalone: { now: summary(standaloneNow!, 1), ifReviewed: summary(standaloneSigned!, 1) },
      catalogue:
        merged && mergedSigned
          ? {
              now: summary(merged, merged.usedBy.length),
              ifReviewed: summary(mergedSigned, mergedSigned.usedBy.length),
            }
          : null,
    };
  });
  return ratings;
}
