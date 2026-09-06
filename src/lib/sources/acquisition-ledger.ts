import { canonicalizeSourceReferences, safeHttpsUrl } from "@/lib/sources/catalogue-core";
import type {
  ClinicalSourceReferenceInput,
  ClinicalSourceType,
  SourceCatalogueWarning,
  SourceContentMode,
  SourceGeographyScope,
} from "@/lib/sources/catalogue-types";
import { strictSourceDate } from "@/lib/sources/source-date-policy";
import acquisitionLedger from "@/data/source-acquisitions.json";

/**
 * Acquisition rungs are the search order the source-acquisition protocol follows:
 * exhaust local WA material before state, state before national, national before
 * other Australian states, and only then look overseas. The rung a record claims
 * is checked against the geography the catalogue independently derives from its
 * publisher, so a source cannot be filed at a rung it does not belong to.
 *
 * See docs/source-acquisition-protocol.md.
 */
export const SOURCE_ACQUISITION_RUNGS = [
  { rung: 1, label: "WA local (hospital or health service)", scope: "wa" },
  { rung: 2, label: "WA state", scope: "wa" },
  { rung: 3, label: "Australian national", scope: "australian_national" },
  { rung: 4, label: "Other Australian state", scope: "australian_state" },
  { rung: 5, label: "International", scope: "international" },
] as const satisfies readonly { rung: number; label: string; scope: SourceGeographyScope }[];

export type SourceAcquisitionRung = (typeof SOURCE_ACQUISITION_RUNGS)[number]["rung"];

/**
 * `adopted` sources are cited by clinical content and must be signed off.
 * `candidate` sources are captured and awaiting review, which is the ordinary
 * state of a freshly pulled source. `rejected` sources are kept deliberately so
 * the same ground is not searched twice; they enter the catalogue as excluded.
 */
export type SourceAcquisitionDisposition = "adopted" | "candidate" | "rejected";

/** Publishers frequently date a document to a year or month only. Recording the
 * precision keeps 2020-01-01 from being read as a real publication day. */
export type SourceAcquisitionDatePrecision = "day" | "month" | "year";

export type SourceAcquisitionRecord = {
  id: string;
  title: string;
  publisher: string;
  publisherCode: string | null;
  canonicalUrl: string | null;
  jurisdiction: string;
  version: string;
  publicationDate: string | null;
  datePrecision: SourceAcquisitionDatePrecision;
  reviewDate: string | null;
  expiryDate: string | null;
  evidenceType: Exclude<ClinicalSourceType, "unknown">;
  documentStatus: "current" | "review_due" | "outdated";
  validationStatus: "approved" | "locally_reviewed" | "unverified";
  contentMode: SourceContentMode;
  topics: string[];
  rung: SourceAcquisitionRung;
  capturedAt: string;
  capturedFor: string;
  disposition: SourceAcquisitionDisposition;
  dispositionReason: string | null;
  supersededBy: string[];
  notes: string | null;
};

/**
 * Warnings that mean the metadata itself is incomplete or contradictory. These
 * are what produced the existing D-band backlog, and no new capture may carry
 * one. `verification_unknown`, `outdated` and `superseded` are deliberately not
 * here: they are true governance states, not defects, and an unreviewed source
 * is the expected state of a fresh capture.
 */
export const ACQUISITION_METADATA_DEFECTS = [
  "ambiguous_identity",
  "invalid_date",
  "metadata_conflict",
  "missing_dates",
  "missing_publisher",
  "missing_version",
  "unknown_evidence_type",
  "unknown_jurisdiction",
  "unsafe_location",
] as const satisfies readonly SourceCatalogueWarning[];

const metadataDefects = new Set<SourceCatalogueWarning>(ACQUISITION_METADATA_DEFECTS);
const rungScopes = new Map(SOURCE_ACQUISITION_RUNGS.map((entry) => [entry.rung, entry.scope]));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const sourceAcquisitionRecords = acquisitionLedger as readonly SourceAcquisitionRecord[];

function acquisitionReference(record: SourceAcquisitionRecord): ClinicalSourceReferenceInput {
  return {
    // Left null so a captured source shares catalogue identity with any content
    // reference to the same URL, rather than splitting into a second entry.
    sourceId: null,
    documentId: null,
    title: record.title,
    aliases: [],
    publisher: record.publisher,
    publisherCode: record.publisherCode,
    canonicalUrl: record.canonicalUrl,
    datasetLocation: null,
    version: record.version,
    publicationDate: record.publicationDate,
    reviewDate: record.reviewDate,
    expiryDate: record.expiryDate,
    jurisdiction: record.jurisdiction,
    evidenceType: record.evidenceType,
    documentStatus: record.documentStatus,
    validationStatus: record.validationStatus,
    contentMode: record.contentMode,
    lifecycleStatus: record.disposition === "rejected" ? "excluded" : "active",
    supersedes: [],
    supersededBy: record.supersededBy,
    topics: record.topics,
    usage: {
      modeId: "sources",
      recordId: record.id,
      recordLabel: record.title,
      field: "acquisition_ledger",
    },
    referenceText: null,
  };
}

export function acquisitionSourceReferences(
  records: readonly SourceAcquisitionRecord[] = sourceAcquisitionRecords,
): ClinicalSourceReferenceInput[] {
  return records.map(acquisitionReference);
}

/** The warnings the real catalogue pipeline raises for one record on its own. */
export function acquisitionRecordWarnings(record: SourceAcquisitionRecord): SourceCatalogueWarning[] {
  const [entry] = canonicalizeSourceReferences([acquisitionReference(record)]);
  return entry ? entry.warnings : [];
}

export function acquisitionRecordGeography(record: SourceAcquisitionRecord): SourceGeographyScope {
  const [entry] = canonicalizeSourceReferences([acquisitionReference(record)]);
  return entry ? entry.geography.scope : "unknown";
}

function requireText(value: string | null, field: string, id: string, issues: string[]) {
  if (!value?.trim()) issues.push(`${id}: ${field} is required`);
}

function requireStrictDate(value: string | null, field: string, id: string, issues: string[]) {
  if (value !== null && !strictSourceDate(value)) {
    issues.push(`${id}: ${field} must be an exact YYYY-MM-DD date, got ${JSON.stringify(value)}`);
  }
}

/**
 * Every rule a capture must satisfy before it is allowed into the register.
 * Returns human-readable issues; an empty array means the ledger is clean.
 */
export function acquisitionLedgerIssues(
  records: readonly SourceAcquisitionRecord[] = sourceAcquisitionRecords,
): string[] {
  const issues: string[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const id = record.id || "(record with no id)";
    if (!idPattern.test(record.id ?? "")) {
      issues.push(`${id}: id must be a lower-case hyphenated slug`);
    }
    if (seenIds.has(record.id)) issues.push(`${id}: duplicate ledger id`);
    seenIds.add(record.id);

    // Identity is required of every record, including a rejection: without it the
    // same source cannot be recognised the next time it surfaces in a search.
    requireText(record.title, "title", id, issues);
    requireText(record.publisher, "publisher", id, issues);
    requireText(record.jurisdiction, "jurisdiction", id, issues);
    requireText(record.capturedFor, "capturedFor", id, issues);
    requireStrictDate(record.publicationDate, "publicationDate", id, issues);
    requireStrictDate(record.reviewDate, "reviewDate", id, issues);
    requireStrictDate(record.expiryDate, "expiryDate", id, issues);
    requireStrictDate(record.capturedAt, "capturedAt", id, issues);
    if (!record.capturedAt) issues.push(`${id}: capturedAt is required`);

    // Completeness is required only of sources still in play. Metadata that could
    // not be established is frequently the reason a source was rejected, and a
    // rejection must stay recordable so the ground is not searched again.
    if (record.disposition !== "rejected") {
      requireText(record.version, "version", id, issues);
      if (!record.publicationDate) issues.push(`${id}: publicationDate is required`);
      if (record.datePrecision === "year" && !record.publicationDate?.endsWith("-01-01")) {
        issues.push(`${id}: year-precision publicationDate must be recorded as the first of January`);
      }
      if (record.datePrecision === "month" && !record.publicationDate?.endsWith("-01")) {
        issues.push(`${id}: month-precision publicationDate must be recorded as the first of the month`);
      }
    }

    if (record.canonicalUrl && !safeHttpsUrl(record.canonicalUrl)) {
      let host = "(unparseable URL)";
      try {
        host = new URL(record.canonicalUrl).hostname;
      } catch {
        host = "(unparseable URL)";
      }
      issues.push(
        `${id}: ${host} is not a governed source host. Add it to GOVERNED_SOURCE_HOSTS in ` +
          `src/lib/sources/source-url-policy.ts and update the pinned host count, or drop the URL.`,
      );
    }

    const expectedScope = rungScopes.get(record.rung);
    if (!expectedScope) {
      issues.push(`${id}: rung must be one of 1, 2, 3, 4 or 5`);
    } else {
      const scope = acquisitionRecordGeography(record);
      if (scope === "unknown") {
        issues.push(
          `${id}: publisher ${JSON.stringify(record.publisher)} is not in the source authority register, ` +
            `so the catalogue cannot place it in a jurisdiction and it can never leave D band. ` +
            `Registering it changes retrieval selection, so raise it with the owner before editing ` +
            `src/lib/source-authority-registry.ts.`,
        );
      } else if (scope !== expectedScope) {
        issues.push(
          `${id}: filed at rung ${record.rung} (expects ${expectedScope}) but the register places it in ${scope}`,
        );
      }
    }

    if (record.disposition === "adopted" && record.validationStatus === "unverified") {
      issues.push(`${id}: an adopted source must be reviewed before clinical content cites it`);
    }
    if (record.disposition !== "adopted" && !record.dispositionReason?.trim()) {
      issues.push(`${id}: a ${record.disposition} source must record why`);
    }

    if (record.disposition !== "rejected") {
      const defects = acquisitionRecordWarnings(record).filter((warning) => metadataDefects.has(warning));
      if (defects.length > 0) {
        issues.push(`${id}: incomplete source metadata (${defects.join(", ")})`);
      }
    }
  }

  return issues;
}

/** Records awaiting the owner's clinical sign-off, worst rung first. */
export function acquisitionReviewQueue(records: readonly SourceAcquisitionRecord[] = sourceAcquisitionRecords) {
  return records
    .filter((record) => record.disposition !== "rejected" && record.validationStatus === "unverified")
    .sort((left, right) => left.rung - right.rung || left.title.localeCompare(right.title, "en-AU"));
}
