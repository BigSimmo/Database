import { documentLabelReviewStatus } from "@/lib/document-tags";
import type { DocumentLabel, RelatedDocument } from "@/lib/types";

type ClientFieldPolicy<T extends object> = {
  [Key in keyof T]-?: "client" | "server";
};

function projectFieldsForClient<T extends object>(value: T, policy: ClientFieldPolicy<T>): Partial<T> {
  return Object.fromEntries(
    (Object.keys(policy) as Array<keyof T>)
      .filter((key) => policy[key] === "client" && Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => [key, value[key]]),
  ) as Partial<T>;
}

const documentLabelFieldPolicy = {
  id: "client",
  document_id: "client",
  owner_id: "server",
  label: "client",
  label_type: "client",
  source: "client",
  confidence: "client",
  metadata: "server",
  created_at: "client",
  updated_at: "client",
} as const satisfies ClientFieldPolicy<DocumentLabel>;

export function projectDocumentLabelForClient(label: DocumentLabel): DocumentLabel {
  return {
    ...projectFieldsForClient(label, documentLabelFieldPolicy),
    // The render layer needs this governance state, but not reviewer ids or
    // arbitrary label metadata.
    metadata: { review_status: documentLabelReviewStatus(label) },
  } as DocumentLabel;
}

export function projectDocumentLabelsForClient(labels: DocumentLabel[] | null | undefined): DocumentLabel[] {
  return (labels ?? [])
    .filter((label) => documentLabelReviewStatus(label) !== "hidden")
    .map(projectDocumentLabelForClient);
}

function compactClientText(value: string | null | undefined, limit = 360): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 3).trimEnd()}...`;
}

function projectMatchReasonForClient(reason: string | null | undefined, labels: DocumentLabel[]) {
  if (!reason) return "Matched indexed passages";
  const labelMatch = /^Matched label:\s*(.+)$/i.exec(reason.trim());
  if (!labelMatch) return reason;
  const matchedLabel = labelMatch[1].trim().toLowerCase();
  return labels.some((label) => label.label.trim().toLowerCase() === matchedLabel)
    ? reason
    : "Matched indexed passages";
}

export function projectRelatedDocumentForClient(document: RelatedDocument): RelatedDocument {
  // Cap labels before match_reason projection so a "Matched label: …" reason
  // cannot refer to a label the client never receives (search payload ships ≤6).
  const labels = projectDocumentLabelsForClient(document.labels).slice(0, 6);
  return {
    document_id: document.document_id,
    title: document.title,
    file_name: document.file_name,
    labels,
    summary: compactClientText(document.summary),
    best_pages: Array.isArray(document.best_pages) ? document.best_pages.slice(0, 5) : [],
    best_chunk_ids: Array.isArray(document.best_chunk_ids) ? document.best_chunk_ids.slice(0, 5) : [],
    image_count: document.image_count,
    ...(document.table_count === undefined ? {} : { table_count: document.table_count }),
    ...(document.cover_image_id === undefined ? {} : { cover_image_id: document.cover_image_id }),
    match_reason: projectMatchReasonForClient(document.match_reason, labels),
    score: document.score,
  };
}
