"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  cn,
  panelSubtle,
  textMuted,
  sourceCard,
  metadataPill,
  floatingControl,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
  EmptyState,
} from "@/components/ui-primitives";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { emptyStates, errorCopy } from "@/lib/ui-copy";
import { StatusBadge } from "@/components/clinical-dashboard/badges";
import type {
  ClinicalDocument,
  IngestionJob,
  ImportBatch,
} from "@/lib/types";

// Setup and quality types
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
  | "failed_ocr"
  | "low_extraction_confidence"
  | "missing_tables"
  | "image_only_pages"
  | "failed_job"
  | "manual_review";

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

export function hasReadyPublicSearchSetup(checks: SetupCheck[]) {
  return Array.from(publicSearchSetupCheckIds).every(
    (id) => checks.find((check) => check.id === id)?.status === "ready",
  );
}

function setupBadgeClasses(status: SetupCheckStatus) {
  if (status === "ready") {
    return toneSuccess;
  }
  if (status === "needs_setup") {
    return toneWarning;
  }
  return toneNeutral;
}

function setupBadgeLabel(status: SetupCheckStatus) {
  if (status === "ready") return "Ready";
  if (status === "needs_setup") return "Needs setup";
  return "Unknown";
}

export function SetupChecklist({ checks }: { checks: SetupCheck[] }) {
  const items = checks.length > 0 ? checks : fallbackSetupChecks;

  return (
    <div className={cn(panelSubtle, "p-3")}>
      <p className="text-sm font-semibold text-[color:var(--text)]">First-run setup checklist</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className={cn(sourceCard, "min-h-10 px-3 py-2")}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-semibold text-[color:var(--text)]">{item.label}</span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-bold",
                  setupBadgeClasses(item.status),
                )}
              >
                {setupBadgeLabel(item.status)}
              </span>
            </div>
            <p className={cn("mt-1 line-clamp-2 text-xs leading-5", textMuted)}>{item.detail}</p>
          </div>
        ))}
      </div>
      <p className={cn("mt-3 text-xs leading-5", textMuted)}>
        Setup status is read-only and never exposes secret values. Worker status is inferred from recent ingestion
        activity.
      </p>
    </div>
  );
}

export function UploadPanel({
  onUploaded,
  demoMode,
  canUpload,
  authorizationHeader,
  status,
  setStatus,
}: {
  onUploaded: () => void;
  demoMode: boolean;
  canUpload: boolean;
  authorizationHeader: Record<string, string>;
  status?: string | null;
  setStatus?: (status: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayStatus = status !== undefined ? status : localStatus;
  const changeStatus = setStatus || setLocalStatus;

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) {
      changeStatus("Demo mode is serving seeded documents. Configure .env.local, run supabase/schema.sql, and start npm run worker to upload real files.");
      return;
    }
    if (!canUpload) {
      changeStatus("Sign in before uploading private guideline files.");
      return;
    }

    const input = fileInputRef.current;
    const files = Array.from(input?.files || []);
    if (files.length === 0) {
      changeStatus("Select at least one PDF file to upload.");
      return;
    }

    setUploading(true);
    changeStatus(files.length === 1 ? "Uploading private document to Supabase Storage..." : `Uploading 1 of ${files.length}: ${files[0].name}`);

    const failures: string[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        if (index > 0) {
          changeStatus(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        }
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", headers: authorizationHeader, body: formData });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Upload failed");
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : errorCopy.uploadFailed}`);
      }
    }

    if (failures.length === 0) {
      changeStatus(files.length === 1 ? "Successfully uploaded private document to storage queue." : `Successfully uploaded ${files.length} private documents.`);
      if (input) input.value = "";
      onUploaded();
    } else {
      changeStatus(`Upload complete with failures: ${failures.join("; ")}`);
    }
    setUploading(false);
  }

  return (
    <form onSubmit={handleFormSubmit} className={cn(panelSubtle, "p-3")}>
      <label className="block text-xs font-semibold text-[color:var(--text)]">
        Guideline PDF files
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          disabled={demoMode || !canUpload || uploading}
          onChange={() => changeStatus(null)}
          className="mt-2 block w-full text-xs font-medium text-[color:var(--text-muted)] file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-md file:border file:border-[color:var(--border)] file:bg-[color:var(--surface)] file:px-3 file:text-xs file:font-semibold file:text-[color:var(--text)] file:shadow-[var(--shadow-inset)] file:transition file:hover:bg-[color:var(--surface-subtle)] file:disabled:opacity-50"
        />
      </label>
      <div className="mt-3">
        <button
          type="submit"
          disabled={uploading || (!demoMode && !canUpload)}
          className={cn(floatingControl, "w-full justify-center")}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Upload guidelines
        </button>
      </div>
      {displayStatus && (
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]" data-testid="upload-status">
          {displayStatus}
        </p>
      )}
    </form>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function IndexingMonitor({
  jobs,
  batches,
  filter,
  actionId,
  onRetry,
  onReindex,
  onEnrich,
}: {
  jobs: IngestionJob[];
  batches: ImportBatch[];
  filter: IndexingMonitorFilter;
  actionId: string | null;
  onRetry: (jobId: string) => void;
  onReindex: (documentId: string) => void;
  onEnrich: (documentId: string) => void;
}) {
  const visibleJobs = jobs.filter((job) => indexingWorkMatchesFilter(job, filter));
  const visibleBatches = batches.filter((batch) => indexingWorkMatchesFilter(batch, filter));
  const filterTitle =
    filter === "active" ? "Active indexing work" : filter === "failed" ? "Failed indexing work" : "All indexing work";

  if (visibleJobs.length === 0 && visibleBatches.length === 0) {
    return (
      <EmptyState
        icon={UploadCloud}
        title={
          filter === "failed"
            ? emptyStates.ingestionJobs.noneFailed
            : filter === "active"
              ? emptyStates.ingestionJobs.noneActive
              : emptyStates.ingestionJobs.none
        }
        body={
          filter === "failed"
            ? "Failed jobs and batches appear here when indexing needs review."
            : filter === "active"
              ? "Queued and processing jobs appear here while indexing is running."
              : "Queued uploads and worker progress appear here."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className={cn(panelSubtle, "p-3")}>
        <p className="text-sm font-semibold text-[color:var(--text)]">{filterTitle}</p>
        <p className={cn("mt-1 text-xs", textMuted)}>
          {visibleJobs.length} job{visibleJobs.length === 1 ? "" : "s"} · {visibleBatches.length} batch
          {visibleBatches.length === 1 ? "" : "es"}
        </p>
      </div>

      {visibleBatches.slice(0, 3).map((batch) => (
        <div key={batch.id} className={cn(panelSubtle, "p-3")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--text)]">{batch.name}</p>
              <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                {batch.total_files} files · {formatBytes(batch.total_bytes)} · {batch.queued_files} queued ·{" "}
                {batch.skipped_files} exact copies skipped · {batch.failed_files} failed
              </p>
            </div>
            <StatusBadge status={batch.status} />
          </div>
        </div>
      ))}

      <p className={cn("text-xs leading-5", textMuted)}>
        Keep `npm run worker` open while jobs are pending or processing. Failed jobs can be retried after fixing the
        cause.
      </p>

      {visibleJobs.slice(0, 10).map((job) => {
        const documentTitle = job.documents?.title ?? job.documents?.file_name ?? "Document";
        const busy = actionId === job.id || actionId === job.document_id;
        return (
          <div key={job.id} className={cn(panelSubtle, "p-3")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text)]">{documentTitle}</p>
                <p className={cn("mt-1 truncate text-xs", textMuted)}>{job.stage}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
              <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${job.progress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn("text-xs", textMuted)}>
                Attempt {job.attempt_count ?? 0}/{job.max_attempts ?? 3}
              </span>
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  disabled={busy}
                  className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => onReindex(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reindex
              </button>
              <button
                type="button"
                onClick={() => onEnrich(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enrich
              </button>
            </div>
            {job.error_message && (
              <p className={cn("mt-2 line-clamp-2 text-xs leading-5", textMuted)}>{job.error_message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const qualityReviewLabels: Record<IngestionQualityReviewType, string> = {
  failed_ocr: "OCR",
  low_extraction_confidence: "Extraction",
  missing_tables: "Tables",
  image_only_pages: "Image-only",
  failed_job: "Failed job",
  manual_review: "Manual review",
};

function qualityReviewTone(severity: IngestionQualityReviewItem["severity"]) {
  if (severity === "danger") return toneDanger;
  if (severity === "warning") return toneWarning;
  return toneInfo;
}

export function IngestionQualityConsole({
  items,
  actionId,
  onRetry,
  onReindex,
  onEnrich,
}: {
  items: IngestionQualityReviewItem[];
  actionId: string | null;
  onRetry: (jobId: string) => void;
  onReindex: (documentId: string) => void;
  onEnrich: (documentId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={emptyStates.ingestionQuality.title}
        body={emptyStates.ingestionQuality.body}
      />
    );
  }

  const counts = items.reduce<Record<IngestionQualityReviewType, number>>(
    (current, item) => ({ ...current, [item.type]: current[item.type] + 1 }),
    {
      failed_ocr: 0,
      low_extraction_confidence: 0,
      missing_tables: 0,
      image_only_pages: 0,
      failed_job: 0,
      manual_review: 0,
    },
  );

  return (
    <div className="space-y-3">
      <div className={cn(panelSubtle, "p-3")}>
        <p className="text-sm font-semibold text-[color:var(--text)]">Ingestion quality review</p>
        <p className={cn("mt-1 text-xs leading-5", textMuted)}>
          {items.length} item{items.length === 1 ? "" : "s"} need manual review across the loaded library.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(counts) as IngestionQualityReviewType[]).map((type) => (
            <span key={type} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
              {qualityReviewLabels[type]}: {counts[type]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        {items.slice(0, 12).map((item) => {
          const busy = actionId === item.jobId || actionId === item.documentId;
          return (
            <article key={item.id} className={cn(sourceCard, "p-3")}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(metadataPill, "min-h-6 px-2 text-[10px]", qualityReviewTone(item.severity))}>
                      {qualityReviewLabels[item.type]}
                    </span>
                    {item.qualityScore !== null ? (
                      <span className={cn(metadataPill, "nums min-h-6 px-2 text-[10px]")}>
                        index {item.qualityScore.toFixed(2)}
                      </span>
                    ) : null}
                    {item.extractionQuality ? (
                      <span className={cn(metadataPill, "min-h-6 px-2 text-[10px]")}>
                        extraction:{item.extractionQuality}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-[color:var(--text)]">
                    {cleanDisplayTitle(item.documentTitle)}
                  </p>
                  <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                    {item.title}: {item.detail}
                  </p>
                  {item.reasons.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.reasons.slice(0, 4).map((reason) => (
                        <span key={reason} className={cn(metadataPill, "text-[11px]")}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/documents/${item.documentId}`} className={cn(floatingControl, "min-h-9 px-3 text-xs")}>
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Link>
                  {item.jobId ? (
                    <button
                      type="button"
                      onClick={() => item.jobId && onRetry(item.jobId)}
                      disabled={busy}
                      className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onReindex(item.documentId)}
                    disabled={busy}
                    className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Reindex
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnrich(item.documentId)}
                    disabled={busy}
                    className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Enrich
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function LibraryHealthStrip({
  documents,
  jobs,
  batches,
  checks,
  loading,
  onSelectTarget,
}: {
  documents: ClinicalDocument[];
  jobs: IngestionJob[];
  batches: ImportBatch[];
  checks: SetupCheck[];
  loading: boolean;
  onSelectTarget?: (target: LibraryHealthTarget) => void;
}) {
  const readyChecks = checks.filter((check) => check.status === "ready").length;
  const indexedDocuments = documents.filter((document) => document.status === "indexed").length;
  const activeJobs = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
  const activeBatches = batches.filter((batch) => batch.status === "queued" || batch.status === "processing").length;
  const failedWork =
    jobs.filter((job) => job.status === "failed").length + batches.filter((batch) => batch.status === "failed").length;
  const items = [
    {
      target: "documents" as const,
      label: "Documents",
      value: loading ? "Loading" : `${indexedDocuments} indexed`,
      tone: loading ? toneNeutral : indexedDocuments ? toneSuccess : toneWarning,
      actionLabel: "Show indexed document files",
    },
    {
      target: "setup" as const,
      label: "Setup",
      value: `${readyChecks}/${checks.length || fallbackSetupChecks.length} ready`,
      tone: readyChecks === (checks.length || fallbackSetupChecks.length) ? toneSuccess : toneWarning,
      actionLabel: "Show setup checks",
    },
    {
      target: "indexing" as const,
      label: "Indexing",
      value: activeJobs + activeBatches ? `${activeJobs + activeBatches} active` : "Idle",
      tone: activeJobs + activeBatches ? toneInfo : toneNeutral,
      actionLabel: "Show indexing progress",
    },
    {
      target: "failures" as const,
      label: "Failures",
      value: failedWork ? `${failedWork} needs review` : "None",
      tone: failedWork ? toneDanger : toneNeutral,
      actionLabel: "Show failed indexing work",
    },
  ];

  return (
    <section
      data-testid="library-health-strip"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
      aria-label="Library health"
    >
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Library health</p>
        <span className={cn("text-[11px] font-semibold", textMuted)}>Read-only status</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelectTarget?.(item.target)}
            className={cn(
              "rounded-md border px-2.5 py-2 text-left transition hover:-translate-y-px hover:shadow-[var(--shadow-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] active:translate-y-0",
              item.tone,
            )}
            aria-label={item.actionLabel}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] opacity-80">{item.label}</p>
            <p className="mt-1 text-xs font-semibold">{item.value}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function indexingWorkMatchesFilter(item: Pick<IngestionJob | ImportBatch, "status">, filter: IndexingMonitorFilter) {
  if (filter === "all") return true;
  if (filter === "active") return item.status === "pending" || item.status === "processing" || item.status === "queued";
  return item.status === "failed";
}
