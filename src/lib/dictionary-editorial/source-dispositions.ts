import dispositionData from "@/data/dictionary-source-dispositions.json";
import { sourceAcquisitionRecords } from "@/lib/sources/acquisition-ledger";

/**
 * What happened to each of the 58 handover sources, and what is still owed.
 *
 * Registering a source is not ingesting it. The eight stages below are kept apart
 * because collapsing them is how "we added the source" comes to be heard as "the
 * guideline is searchable": a ledger row is metadata, and metadata is the first of
 * eight steps. Nothing past `catalogued` has been attempted for any of these.
 */
export const SOURCE_RECEIPT_STAGES = [
  "staged",
  "catalogued",
  "bytesAcquired",
  "extractionChecked",
  "indexed",
  "retrievalVerified",
  "clinicallyApproved",
  "activated",
] as const;

export type SourceReceiptStage = (typeof SOURCE_RECEIPT_STAGES)[number];

export type SourceReceiptStatus = "not_attempted" | "not_applicable" | "blocked" | "failed" | "verified";

/**
 * `held` is a real outcome, not a failure. A source with no established publication
 * date is more useful recorded as held with the missing field named than admitted
 * with a date nobody can stand behind.
 */
export type DictionarySourceLedgerOutcome = "admitted_as_candidate" | "held" | "reuse" | "skip" | "conflict";

export type DictionarySourceBlocker = {
  code: string;
  blocker: string;
  nextAction: string;
};

export type DictionarySourceDisposition = {
  handoverSourceId: string;
  title: string | null;
  ledgerOutcome: DictionarySourceLedgerOutcome;
  /** The `src/data/source-acquisitions.json` id, for admitted candidates only. */
  ledgerRecordId: string | null;
  catalogueIdentityOutcome: "reuse" | "held" | "conflict";
  existingDictionarySourceId: string | null;
  catalogueIdentityReason: string;
  blockers: readonly DictionarySourceBlocker[];
  decisionOwner: string;
  stages: Record<SourceReceiptStage, SourceReceiptStatus>;
  /** Stays null until bytes are actually acquired under a separate approval. */
  originalBytesSha256: string | null;
  documentId: string | null;
  jobId: string | null;
  /**
   * What was found when the publisher's own page was read, and when.
   *
   * `checkedOn: null` means nobody has looked — which is a different and weaker
   * statement than "the publisher states no date", and the two are worth telling
   * apart before anyone decides the source is unusable.
   */
  publisherCheck: { checkedOn: string | null; finding: string };
};

export const dictionarySourceDispositions: readonly DictionarySourceDisposition[] = (
  dispositionData as { sources: readonly DictionarySourceDisposition[] }
).sources;

export function heldDictionarySources(): readonly DictionarySourceDisposition[] {
  return dictionarySourceDispositions.filter((disposition) => disposition.ledgerOutcome === "held");
}

/** Structural defects in the disposition set. An empty array means it is sound. */
export function dictionarySourceDispositionIssues(
  dispositions: readonly DictionarySourceDisposition[] = dictionarySourceDispositions,
): string[] {
  const issues: string[] = [];
  const ledgerIds = new Set(sourceAcquisitionRecords.map((record) => record.id));
  const seen = new Set<string>();

  for (const disposition of dispositions) {
    const id = disposition.handoverSourceId;
    if (seen.has(id)) issues.push(`${id}: duplicate disposition`);
    seen.add(id);

    if (disposition.ledgerOutcome === "admitted_as_candidate") {
      if (!disposition.ledgerRecordId) {
        issues.push(`${id}: admitted but names no ledger record`);
      } else if (!ledgerIds.has(disposition.ledgerRecordId)) {
        issues.push(`${id}: names ledger record ${disposition.ledgerRecordId}, which is not in the ledger`);
      }
    } else if (disposition.ledgerRecordId) {
      issues.push(`${id}: not admitted but names a ledger record`);
    }

    // A hold with no named blocker is indistinguishable from a source nobody looked
    // at, which is the state this file exists to make impossible.
    if (disposition.ledgerOutcome === "held" && disposition.blockers.length === 0) {
      issues.push(`${id}: held with no blocker recorded`);
    }
    for (const blocker of disposition.blockers) {
      if (!blocker.blocker.trim()) issues.push(`${id}: blocker ${blocker.code} has no description`);
      if (!blocker.nextAction.trim()) issues.push(`${id}: blocker ${blocker.code} has no next action`);
    }

    for (const stage of SOURCE_RECEIPT_STAGES) {
      if (!disposition.stages[stage]) issues.push(`${id}: missing receipt for stage ${stage}`);
    }

    if (!disposition.publisherCheck.finding.trim()) issues.push(`${id}: publisherCheck has no finding`);
    // Every claim past metadata needs a receipt to back it. None exists yet, and a
    // stage marked verified without one is exactly the overstatement to catch.
    if (disposition.stages.indexed === "verified" && !disposition.documentId) {
      issues.push(`${id}: indexed is verified but no document id is recorded`);
    }
    if (disposition.stages.bytesAcquired === "verified" && !disposition.originalBytesSha256) {
      issues.push(`${id}: bytesAcquired is verified but no original byte hash is recorded`);
    }
    if (disposition.stages.clinicallyApproved === "verified") {
      issues.push(`${id}: no source from this handover has been clinically approved`);
    }
  }

  return issues;
}
