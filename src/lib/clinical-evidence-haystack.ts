import type { SearchResult } from "@/lib/types";

export function clinicalImageEvidenceHaystack(images: SearchResult["images"]) {
  return (images ?? [])
    .map((image) =>
      [
        image.tableTextSnippet,
        image.accessibleTableMarkdown,
        image.caption,
        image.tableTitle,
        image.tableLabel,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

export function clinicalResultEvidenceHaystack(result: SearchResult) {
  const tableFactText = (result.table_facts ?? [])
    .map(
      (fact) =>
        `${fact.table_title ?? ""} ${fact.row_label ?? ""} ${fact.clinical_parameter ?? ""} ${fact.threshold_value ?? ""} ${fact.action ?? ""}`,
    )
    .join(" ");
  const memoryCardText = (result.memory_cards ?? []).map((card) => `${card.title} ${card.content}`).join(" ");
  return `${result.title} ${result.file_name} ${result.section_heading ?? ""} ${result.retrieval_synopsis ?? ""} ${result.content} ${tableFactText} ${memoryCardText} ${clinicalImageEvidenceHaystack(result.images)}`.toLowerCase();
}
