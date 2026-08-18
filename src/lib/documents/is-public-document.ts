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

/**
 * Standardized predicate to determine whether a document (or its metadata)
 * represents a public corpus document vs. a private/tenant-scoped document.
 *
 * In the Database visibility model:
 * 1. Documents with `owner_id === null` on indexed rows belong to the public corpus.
 * 2. Documents whose metadata contains `public_corpus: true`, `is_public: true`,
 *    `public: true`, or `visibility: "public"` are explicitly public.
 * 3. Registry summaries (`source_kind: "registry_record"`) are public catalog items.
 * 4. Documents with an explicit non-null `owner_id` (without explicit public flags)
 *    or `private: true` / `visibility: "private"` are private.
 *
 * @param input - A document row, metadata dictionary, or source metadata object.
 * @returns `true` if the document is public, `false` otherwise.
 */
export function isPublicDocument(input: DocumentVisibilityTarget | ClinicalSourceMetadata): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  const record = input as Record<string, unknown>;

  // Check if input is a document row containing a nested metadata object
  const metadata =
    record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : record;

  // Explicit private flags take precedence
  if (metadata.private === true || metadata.is_private === true || metadata.visibility === "private") {
    return false;
  }

  // Explicit public markers
  if (
    metadata.public_corpus === true ||
    metadata.is_public === true ||
    metadata.public === true ||
    metadata.visibility === "public"
  ) {
    return true;
  }

  // Registry record sources are public
  if (metadata.source_kind === "registry_record" || typeof metadata.registry_record_kind === "string") {
    return true;
  }

  // If a document row has an explicit owner_id property
  if ("owner_id" in record) {
    return record.owner_id === null;
  }

  // If metadata explicitly specifies owner_id
  if ("owner_id" in metadata) {
    return metadata.owner_id === null;
  }

  return false;
}

/**
 * Alias for `isPublicDocument` when operating explicitly on full document rows.
 */
export function isPublicDocumentRow(row: DocumentVisibilityTarget): boolean {
  return isPublicDocument(row);
}
