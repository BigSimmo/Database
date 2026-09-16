import type { DocumentLabelType } from "@/lib/types";

export const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;

export const mobileSectionFabMediaQuery =
  "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";

export type DocumentPagination = {
  limit: number;
  offset: number;
  /**
   * Null when the count could not be read. `/api/documents` used to answer that case with the
   * page length, so a 5,000-document corpus read back as "150 of 150" — a plausible number that
   * was simply wrong. It now sends null, and the consumer at `document-admin.tsx` renders nothing
   * rather than a lie, because `null > documents.length` is false. `hasMore` still drives paging,
   * so the list keeps working while the total is genuinely unknown.
   */
  total: number | null;
  nextOffset: number;
  hasMore: boolean;
};

export type DocumentDrawerMode = "recent" | "library" | "source" | "admin";

export type DocumentDrawerStatusFilter = "all" | "indexed" | "indexing" | "failed";

export type LabelReviewMutationBody =
  { labelId: string; action: "approve" | "hide" | "restore" } | { label: string; label_type: DocumentLabelType };
