export type IndexingHealthDocument = {
  status: string | null;
  file_name: string | null;
  page_count: number | null;
  chunk_count: number | null;
  metadata: unknown;
};

export function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

export function isRegistryProjectionDocument(document: IndexingHealthDocument) {
  const metadata = metadataRecord(document.metadata);
  return (
    document.file_name?.endsWith(".registry.json") === true &&
    metadata.source_kind === "registry_record" &&
    typeof metadata.registry_record_id === "string"
  );
}

export function isEmptyIndexedDocument(document: IndexingHealthDocument) {
  if (document.status !== "indexed") return false;
  if ((document.chunk_count ?? 0) === 0) return true;

  return !isRegistryProjectionDocument(document) && (document.page_count ?? 0) === 0;
}

export function hasChunkCountMismatch(document: IndexingHealthDocument, actualChunkCount: number) {
  return actualChunkCount !== (document.chunk_count ?? 0);
}
