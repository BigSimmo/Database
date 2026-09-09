import type { ClinicalSourceMetadata } from "@/lib/types";

/**
 * Common shape representing either a raw metadata record or a document row
 * containing metadata and/or owner_id.
 */
export type DocumentVisibilityTarget =
  | {
      owner_id?: string | null;
      metadata?: Record<string, unknown> | null;
      [key: string]: unknown;
    }
  | Record<string, unknown>
  | null
  | undefined;

function nestedOrSelfMetadata(record: Record<string, unknown>): Record<string, unknown> {
  return record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : record;
}

function recordedOwnerId(record: Record<string, unknown>, metadata: Record<string, unknown>): unknown {
  if ("owner_id" in record) return record.owner_id;
  if ("owner_id" in metadata) return metadata.owner_id;
  return undefined;
}

/**
 * Standardized predicate for whether a document belongs to the public corpus.
 *
 * Access decisions must match `withOwnerReadScope`: a document is public only when
 * `owner_id` is null *and* `metadata.public_corpus` is true. `documents.owner_id` is
 * `on delete set null`, so a null owner alone is an orphan, not a publication. Legacy
 * metadata aliases (`is_public`, `public`, `visibility`, `source_kind`) do not grant
 * public access. Missing either signal fails closed.
 *
 * @param input - A document row, metadata dictionary, or source metadata object.
 * @returns `true` if the document is public, `false` otherwise.
 */
export function isPublicDocument(input: DocumentVisibilityTarget | ClinicalSourceMetadata): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  const record = input as Record<string, unknown>;
  const metadata = nestedOrSelfMetadata(record);

  if (
    metadata.private === true ||
    metadata.is_private === true ||
    metadata.visibility === "private" ||
    record.private === true ||
    record.is_private === true ||
    record.visibility === "private"
  ) {
    return false;
  }

  return recordedOwnerId(record, metadata) === null && metadata.public_corpus === true;
}

/**
 * Alias for `isPublicDocument` when operating explicitly on full document rows.
 */
export function isPublicDocumentRow(row: DocumentVisibilityTarget): boolean {
  return isPublicDocument(row);
}
