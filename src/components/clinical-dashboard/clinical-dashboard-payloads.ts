// Payload shapes and dashboard-local constants extracted from ClinicalDashboard.tsx
// to keep the monolith under the maintainability no-growth budget.

import type { SearchFacets } from "@/components/clinical-dashboard/document-search-results";
import type { DocumentPagination } from "@/components/clinical-dashboard/dashboard-contracts";
import type {
  SetupCheck,
  IngestionQualityReviewItem,
} from "@/components/clinical-dashboard/document-manager-contracts";
import type { AnswerPayload } from "@/components/clinical-dashboard/search-utils";
import type { SourceGovernanceWarning } from "@/lib/source-governance";
import type { AppModeSearchKind } from "@/lib/app-modes";
import type {
  ClinicalDocument,
  ClinicalQueryMode,
  DocumentMatch,
  EvidenceRelevance,
  ImportBatch,
  IngestionJob,
  SearchResult,
  SearchScopeSummary,
} from "@/lib/types";

export const documentPageSize = 150;
export const activeIndexingPollFallbackMs = 5_000;
export const indexingWorkDetailsPollMs = 15_000;
export const stagedDashboardExtraction = {
  answerSurface: true,
} as const;

export type RefreshOptions = {
  includeSetup?: boolean;
  includeDashboardData?: boolean;
  includeAdministrationData?: boolean;
  includeDocumentMeta?: boolean;
};

export type PollHint = {
  active?: boolean;
  pollAfterMs?: number | null;
};

export type SetupStatusPayload = {
  demoMode?: boolean;
  checks?: SetupCheck[];
  indexingActive?: boolean;
  pollAfterMs?: number | null;
};

export type DocumentsPayload = {
  documents?: ClinicalDocument[];
  pagination?: DocumentPagination | null;
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  indexing?: PollHint;
};

export type JobsPayload = {
  jobs?: IngestionJob[];
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  hasActiveJobs?: boolean;
  pollAfterMs?: number | null;
};

export type BatchesPayload = {
  batches?: ImportBatch[];
  demoMode?: boolean;
  hasActiveBatches?: boolean;
  pollAfterMs?: number | null;
};

export type IngestionQualityPayload = {
  items?: IngestionQualityReviewItem[];
  demoMode?: boolean;
};

export const clinicalQueryModeOptions: Array<{ value: ClinicalQueryMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "monitoring_schedule", label: "Monitoring" },
  { value: "dose_threshold_lookup", label: "Dose / thresholds" },
  { value: "contraindications_cautions", label: "Cautions" },
  { value: "escalation_criteria", label: "Escalation" },
  { value: "required_documentation", label: "Documentation" },
  { value: "compare_guidance", label: "Compare" },
];

export type SearchResultModePayload =
  | {
      kind: "documents";
      query: string;
      demoMode?: boolean;
      sources: SearchResult[];
      documentMatches: DocumentMatch[];
      relevance?: EvidenceRelevance;
      facets?: SearchFacets;
      scope?: SearchScopeSummary;
      sourceGovernanceWarnings?: SourceGovernanceWarning[];
    }
  | {
      kind: "answer";
      query: string;
      payload: AnswerPayload;
    };

export type SourceLibrarySearchMode = Extract<AppModeSearchKind, "documents" | "differentials">;
