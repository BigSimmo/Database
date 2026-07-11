import type { DocumentLabelType } from "@/lib/types";

export const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;

export const mobileSectionFabMediaQuery =
  "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";

export const recentQueryStorageKey = "clinical-kb-recent-queries";

export type DocumentPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
};

export type DocumentDrawerMode = "recent" | "library" | "source" | "admin";

export type DocumentDrawerStatusFilter = "all" | "indexed" | "indexing" | "failed";

export type LabelReviewMutationBody =
  { labelId: string; action: "approve" | "hide" | "restore" } | { label: string; label_type: DocumentLabelType };
