import { loadAdminClient } from "./eval-utils";

type MissRow = {
  id: string;
  query: string;
  normalized_query: string;
  query_class: string | null;
  clicked_document_id: string | null;
  top_files: string[] | null;
  top_chunk_ids: string[] | null;
  candidate_aliases: string[] | null;
  candidate_labels: Array<{
    label?: string;
    label_type?: string;
    document_id?: string;
    confidence?: number;
  }> | null;
  created_at: string;
};

function argValue(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function unique(values: Array<string | null | undefined>, limit = 12) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).slice(0, limit);
}

async function resolveDocumentDisplayNames(supabase: Awaited<ReturnType<typeof loadAdminClient>>, rows: MissRow[]) {
  const chunkIds = unique(
    rows.flatMap((row) => row.top_chunk_ids ?? []),
    2_000,
  );
  const documentIds = new Set<string>(
    rows
      .flatMap((row) => [
        row.clicked_document_id,
        ...(row.candidate_labels ?? []).map((label) => label.document_id ?? null),
      ])
      .filter((id): id is string => Boolean(id)),
  );
  const chunkDocumentIds = new Map<string, string>();

  if (chunkIds.length > 0) {
    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("id,document_id")
      .in("id", chunkIds);
    if (chunksError) throw new Error(chunksError.message);
    for (const chunk of chunks ?? []) {
      documentIds.add(chunk.document_id);
      chunkDocumentIds.set(chunk.id, chunk.document_id);
    }
  }

  const ids = Array.from(documentIds).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return { byDocumentId: new Map<string, string>(), byChunkId: new Map<string, string>() };
  }
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id,title,file_name")
    .in("id", ids);
  if (documentsError) throw new Error(documentsError.message);

  const byDocumentId = new Map(
    (documents ?? []).map((document) => [
      document.id,
      document.file_name?.trim() || document.title?.trim() || document.id,
    ]),
  );
  const byChunkId = new Map<string, string>();
  for (const [chunkId, documentId] of chunkDocumentIds) {
    const displayName = byDocumentId.get(documentId);
    if (displayName) byChunkId.set(chunkId, displayName);
  }
  return { byDocumentId, byChunkId };
}

async function main() {
  const supabase = await loadAdminClient();
  const minCount = Number(argValue("min-count") ?? 2);
  const limit = Number(argValue("limit") ?? 200);
  const applyLabels = process.argv.includes("--apply-labels");

  const { data, error } = await supabase
    .from("rag_query_misses")
    .select(
      "id,query,normalized_query,query_class,clicked_document_id,top_files,top_chunk_ids,candidate_aliases,candidate_labels,created_at",
    )
    .is("promoted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const groups = new Map<string, MissRow[]>();
  for (const row of (data ?? []) as MissRow[]) {
    groups.set(row.normalized_query, [...(groups.get(row.normalized_query) ?? []), row]);
  }
  const documentDisplayNames = await resolveDocumentDisplayNames(supabase, (data ?? []) as MissRow[]);

  const promotable = Array.from(groups.entries())
    .map(([query, rows]) => ({
      query,
      rows,
      aliases: unique(rows.flatMap((row) => row.candidate_aliases ?? [])),
      files: unique(
        rows.flatMap((row) => [
          ...(row.top_files ?? []),
          ...(row.top_chunk_ids ?? []).map((chunkId) => documentDisplayNames.byChunkId.get(chunkId)),
          ...(row.clicked_document_id ? [documentDisplayNames.byDocumentId.get(row.clicked_document_id)] : []),
          ...(row.candidate_labels ?? []).map((label) =>
            label.document_id ? documentDisplayNames.byDocumentId.get(label.document_id) : undefined,
          ),
        ]),
      ),
      labels: rows.flatMap((row) => row.candidate_labels ?? []),
    }))
    .filter((group) => group.rows.length >= minCount)
    .sort((a, b) => b.rows.length - a.rows.length || a.query.localeCompare(b.query));

  if (promotable.length === 0) {
    console.log(`No repeated unpromoted query misses found with min-count=${minCount}.`);
    return;
  }

  for (const group of promotable) {
    console.log(`MISS x${group.rows.length}: ${group.query}`);
    console.log(`  top_files=${group.files.join(", ") || "none"}`);
    console.log(`  candidate_aliases=${group.aliases.join(", ") || "none"}`);
    const labelPreview = unique(group.labels.map((label) => label.label)).join(", ");
    console.log(`  candidate_labels=${labelPreview || "none"}`);
  }

  if (!applyLabels) {
    console.log("Review only. Re-run with --apply-labels to insert candidate labels as manual labels.");
    return;
  }

  let inserted = 0;
  for (const group of promotable) {
    const labels = group.labels.filter(
      (label): label is typeof label & { document_id: string; label: string; label_type: string } =>
        Boolean(label.document_id && label.label && label.label_type),
    );
    for (const label of labels) {
      const { error: labelError } = await supabase.from("document_labels").upsert(
        {
          document_id: label.document_id,
          label: label.label,
          label_type: label.label_type,
          source: "manual",
          confidence: Math.max(0.55, Math.min(0.9, Number(label.confidence ?? 0.6))),
          metadata: {
            promoted_from_query_miss: group.query,
            promoted_at: new Date().toISOString(),
          },
        },
        { onConflict: "document_id,label_type,label,source" },
      );
      if (labelError) throw new Error(labelError.message);
      inserted += 1;
    }
    await supabase
      .from("rag_query_misses")
      .update({ promoted_at: new Date().toISOString() })
      .in(
        "id",
        group.rows.map((row) => row.id),
      );
  }

  console.log(`Promoted ${inserted} label candidate(s) from ${promotable.length} repeated miss group(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
