export type RegistryProjectionDocument = {
  file_name?: string | null;
  file_type?: string | null;
  source_path?: string | null;
  metadata: unknown;
};

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isRegistryProjectionDocument(document: RegistryProjectionDocument) {
  const metadata = metadataRecord(document.metadata);
  return (
    metadata.source_kind === "registry_record" ||
    document.file_type === "application/vnd.clinical-kb.registry+json" ||
    document.source_path?.startsWith("registry://") === true ||
    document.file_name?.endsWith(".registry.json") === true
  );
}
