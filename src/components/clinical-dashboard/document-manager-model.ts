// Data-only setup/quality model shared by ClinicalDashboard and the
// DocumentManagerPanel components. Kept free of React/JSX/icon imports so the
// dashboard can consume these types and helpers without statically pulling the
// heavy panel module, which loads via next/dynamic when an admin drawer opens.

export type SetupCheckStatus = "ready" | "needs_setup" | "unknown";
export type SetupCheck = {
  id: "env" | "project" | "schema" | "search" | "openai" | "worker";
  label: string;
  status: SetupCheckStatus;
  detail: string;
};

export type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";
export type IndexingMonitorFilter = "all" | "active" | "failed";

export type IngestionQualityReviewType =
  "failed_ocr" | "low_extraction_confidence" | "missing_tables" | "image_only_pages" | "failed_job" | "manual_review";

export type IngestionQualityReviewItem = {
  id: string;
  type: IngestionQualityReviewType;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  jobId: string | null;
  qualityScore: number | null;
  extractionQuality: string | null;
  reasons: string[];
  metrics: Record<string, unknown>;
  updatedAt: string | null;
};

export const fallbackSetupChecks: SetupCheck[] = [
  {
    id: "env",
    label: ".env.local configured",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "project",
    label: "Clinical KB Database target",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "schema",
    label: "supabase/schema.sql applied",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "search",
    label: "Search RPC and vector indexes",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "openai",
    label: "OpenAI API key available",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "worker",
    label: "npm run worker running",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
];

const publicSearchSetupCheckIds = new Set<SetupCheck["id"]>(["env", "project", "schema", "search", "openai"]);
const requiredPublicSearchConfigCheckIds = new Set<SetupCheck["id"]>(["env", "project", "schema", "openai"]);

export function hasReadyPublicSearchSetup(checks: SetupCheck[]) {
  return Array.from(publicSearchSetupCheckIds).every(
    (id) => checks.find((check) => check.id === id)?.status === "ready",
  );
}

export function hasReadyRequiredPublicSearchConfig(checks: SetupCheck[]) {
  return Array.from(requiredPublicSearchConfigCheckIds).every(
    (id) => checks.find((check) => check.id === id)?.status === "ready",
  );
}
