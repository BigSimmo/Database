"use client";

import { useState, useRef, useId } from "react";
import Link from "next/link";
import { UploadCloud, Loader2, RefreshCw, Sparkles, ShieldCheck, ExternalLink } from "lucide-react";
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
import { exceedsClientUploadSize, getClientMaxUploadMb, uploadSizeLimitMessage } from "@/lib/upload-limits";
import { StatusBadge } from "@/components/clinical-dashboard/badges";
import { PrivacyInputNotice } from "@/components/privacy-input-notice";
import type { IngestionJob, ImportBatch } from "@/lib/types";
import {
  fallbackSetupChecks,
  type IngestionQualityReviewItem,
  type IngestionQualityReviewType,
  type SetupCheck,
  type SetupCheckStatus,
} from "@/components/clinical-dashboard/document-manager-contracts";

export {
  fallbackSetupChecks,
  hasReadyPublicSearchSetup,
  hasReadyRequiredPublicSearchConfig,
} from "@/components/clinical-dashboard/document-manager-contracts";
export type {
  IngestionQualityReviewItem,
  IngestionQualityReviewType,
  SetupCheck,
  SetupCheckStatus,
} from "@/components/clinical-dashboard/document-manager-contracts";

// Setup and quality types
const demoUploadReadOnlyMessage =
  "Demo mode is read-only. Configure Supabase, OpenAI, and the local worker before uploading private guideline files.";

export type IndexingMonitorFilter = "all" | "active" | "failed";

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
                  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-2xs font-bold",
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

/**
 * Uploads one file via XMLHttpRequest so the browser reports byte-level upload
 * progress (fetch offers no request-body progress). Resolves on 2xx, rejects
 * with the server's error message otherwise.
 */
export type UploadOutcome =
  | { kind: "queued"; fileName: string; documentId: string; jobId: string }
  | { kind: "duplicate"; fileName: string; documentId: string; message: string }
  | { kind: "failed"; fileName: string; status: number; code: string; message: string };

export function uploadBatchCompletion(outcomes: UploadOutcome[]) {
  const queued = outcomes.filter((outcome) => outcome.kind === "queued");
  const duplicates = outcomes.filter((outcome) => outcome.kind === "duplicate");
  const failures = outcomes.filter((outcome) => outcome.kind === "failed");
  return {
    queued,
    duplicates,
    failures,
    shouldClearInput: queued.length + duplicates.length > 0,
    shouldRefreshDocuments: queued.length > 0,
  };
}

type UploadResponsePayload = {
  error?: string;
  message?: string;
  code?: string;
  duplicate?: boolean;
  document?: { id?: string };
  job?: { id?: string };
};
export function uploadOutcomeFromResponse(
  fileName: string,
  status: number,
  payload: UploadResponsePayload,
): UploadOutcome {
  const documentId = payload.document?.id ?? "";
  if (status >= 200 && status < 300 && payload.duplicate) {
    return {
      kind: "duplicate",
      fileName,
      documentId,
      message: payload.message ?? "This exact document already exists; no indexing job was queued.",
    };
  }
  if (status >= 200 && status < 300) {
    return { kind: "queued", fileName, documentId, jobId: payload.job?.id ?? "" };
  }
  return {
    kind: "failed",
    fileName,
    status,
    code: payload.code ?? `http_${status}`,
    message: payload.message ?? payload.error ?? "Upload failed",
  };
}

export function uploadFileWithProgress(
  file: File,
  authorizationHeader: Record<string, string>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    // FormData sets its own multipart Content-Type (with boundary); only the
    // auth header is forwarded, matching the previous fetch() call.
    for (const [key, value] of Object.entries(authorizationHeader)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let payload: UploadResponsePayload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(uploadOutcomeFromResponse(file.name, xhr.status, payload));
      } else {
        resolve(uploadOutcomeFromResponse(file.name, xhr.status, payload));
      }
    };
    xhr.onerror = () =>
      resolve({
        kind: "failed",
        fileName: file.name,
        status: 0,
        code: "network_error",
        message: errorCopy.uploadFailed,
      });
    xhr.onabort = () =>
      resolve({
        kind: "failed",
        fileName: file.name,
        status: 0,
        code: "upload_cancelled",
        message: "Upload cancelled.",
      });
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function UploadPanel({
  onUploaded,
  demoMode,
  canUpload,
  authorizationHeader,
  registerAuthRequest,
  isAuthEpochCurrent,
  onSessionExpired,
  status,
  setStatus,
}: {
  onUploaded: () => void;
  demoMode: boolean;
  canUpload: boolean;
  authorizationHeader: Record<string, string>;
  registerAuthRequest?: (controller: AbortController) => { epoch: number; release: () => void };
  isAuthEpochCurrent?: (epoch: number) => boolean;
  onSessionExpired?: () => void;
  status?: string | null;
  setStatus?: (status: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileHintId = useId();

  const displayStatus = status !== undefined ? status : localStatus;
  const changeStatus = setStatus || setLocalStatus;

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) {
      changeStatus(demoUploadReadOnlyMessage);
      return;
    }
    if (!canUpload) {
      changeStatus(
        demoMode ? demoUploadReadOnlyMessage : "Uploads are unavailable until this public workspace is configured.",
      );
      return;
    }

    const input = fileInputRef.current;
    const files = Array.from(input?.files || []);
    if (files.length === 0) {
      changeStatus("Select at least one PDF file to upload.");
      return;
    }

    setUploading(true);
    setUploadPercent(0);
    changeStatus(
      files.length === 1 ? `Uploading ${files[0].name}...` : `Uploading 1 of ${files.length}: ${files[0].name}`,
    );

    const outcomes: UploadOutcome[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        // Pre-check the size before spending the transfer. Prefer
        // NEXT_PUBLIC_MAX_UPLOAD_MB (clamped to the ceiling) so a lowered
        // operator limit matches the UI; the server still enforces
        // env.MAX_UPLOAD_MB as the authority. The rest of the batch still
        // uploads, matching the server's per-file outcome semantics.
        const clientMaxUploadMb = getClientMaxUploadMb();
        if (exceedsClientUploadSize(file.size)) {
          outcomes.push({
            kind: "failed",
            fileName: file.name,
            status: 413,
            code: "payload_too_large",
            message: uploadSizeLimitMessage(clientMaxUploadMb),
          });
          continue;
        }
        changeStatus(
          files.length === 1 ? `Uploading ${file.name}...` : `Uploading ${index + 1} of ${files.length}: ${file.name}`,
        );
        // Overall percent spans all files: completed files + the current file's
        // byte fraction, so the bar advances smoothly across a multi-file batch.
        const controller = new AbortController();
        const authRequest = registerAuthRequest?.(controller);
        const outcome = await uploadFileWithProgress(
          file,
          authorizationHeader,
          (fraction) => {
            setUploadPercent(Math.min(100, Math.round(((index + fraction) / files.length) * 100)));
          },
          controller.signal,
        );
        authRequest?.release();
        if (authRequest && isAuthEpochCurrent && !isAuthEpochCurrent(authRequest.epoch)) {
          changeStatus("Upload cancelled because the signed-in session changed.");
          setUploading(false);
          setUploadPercent(null);
          return;
        }
        outcomes.push(outcome);
        if (outcome.kind === "failed" && outcome.status === 401) onSessionExpired?.();
      } catch (error) {
        outcomes.push({
          kind: "failed",
          fileName: file.name,
          status: 0,
          code: "upload_failed",
          message: error instanceof Error ? error.message : errorCopy.uploadFailed,
        });
      }
    }

    const { queued, duplicates, failures, shouldClearInput, shouldRefreshDocuments } = uploadBatchCompletion(outcomes);
    setUploadPercent(failures.length === 0 ? 100 : null);
    if (failures.length === 0) {
      const parts = [
        queued.length ? `${queued.length} queued for indexing` : null,
        duplicates.length ? `${duplicates.length} already existed; no indexing job was queued` : null,
      ].filter(Boolean);
      changeStatus(parts.join(". ") + ".");
    } else {
      const successful = queued.length + duplicates.length;
      changeStatus(
        `Upload complete: ${successful} accepted; ${failures.length} failed. ${failures.map((outcome) => `${outcome.fileName}: ${outcome.message}`).join("; ")}`,
      );
    }
    if (input && shouldClearInput) input.value = "";
    if (shouldRefreshDocuments) onUploaded();
    setUploading(false);
    setUploadPercent(null);
  }

  return (
    <form onSubmit={handleFormSubmit} className={cn(panelSubtle, "p-3")}>
      <PrivacyInputNotice className="mb-2" returnMode="documents" />
      <label className="block text-xs font-semibold text-[color:var(--text)]">
        Guideline PDF files
        <input
          ref={fileInputRef}
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          multiple
          disabled={demoMode || !canUpload || uploading}
          aria-describedby={fileHintId}
          onChange={() => changeStatus(null)}
          className="mt-2 block w-full text-xs font-medium text-[color:var(--text-muted)] file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-md file:border file:border-[color:var(--border)] file:bg-[color:var(--surface)] file:px-3 file:text-xs file:font-semibold file:text-[color:var(--text)] file:shadow-[var(--shadow-inset)] file:transition file:hover:bg-[color:var(--surface-subtle)] disabled:opacity-50"
        />
      </label>
      <p id={fileHintId} className={cn(textMuted, "mt-2 text-xs")}>
        PDF only, up to {getClientMaxUploadMb()} MB per file.
      </p>
      <div className="mt-3">
        <button
          type="submit"
          disabled={uploading || (!demoMode && !canUpload)}
          className={cn(floatingControl, "w-full justify-center")}
        >
          {uploading ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
          )}
          Upload guidelines
        </button>
      </div>
      {uploading && uploadPercent !== null && (
        <div className="mt-2" aria-hidden="false">
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={uploadPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-[color:var(--clinical-accent)] transition-transform duration-[var(--duration-moderate)] ease-[var(--ease-out-keyword)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${uploadPercent / 100})` }}
            />
          </div>
        </div>
      )}
      {(displayStatus || demoMode) && (
        <p
          aria-live="polite"
          className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]"
          data-testid="upload-status"
        >
          {displayStatus ?? demoUploadReadOnlyMessage}
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
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {documentTitle}: {job.status}, {job.progress}%
            </span>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text)]">{documentTitle}</p>
                <p className={cn("mt-1 truncate text-xs", textMuted)}>{job.stage}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div
              role="progressbar"
              aria-label={`${documentTitle} indexing progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={job.progress}
              className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
            >
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
                  {busy ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  )}
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => onReindex(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                )}
                Reindex
              </button>
              <button
                type="button"
                onClick={() => onEnrich(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                )}
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
            <span key={type} className={cn(metadataPill, "min-h-7 px-2 text-2xs")}>
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
                    <span className={cn(metadataPill, "min-h-6 px-2 text-2xs", qualityReviewTone(item.severity))}>
                      {qualityReviewLabels[item.type]}
                    </span>
                    {item.qualityScore !== null ? (
                      <span className={cn(metadataPill, "nums min-h-6 px-2 text-2xs")}>
                        index {item.qualityScore.toFixed(2)}
                      </span>
                    ) : null}
                    {item.extractionQuality ? (
                      <span className={cn(metadataPill, "min-h-6 px-2 text-2xs")}>
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
                        <span key={reason} className={cn(metadataPill, "text-2xs")}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/documents/${item.documentId}`} className={cn(floatingControl, "min-h-9 px-3 text-xs")}>
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    Open
                  </Link>
                  {item.jobId ? (
                    <button
                      type="button"
                      onClick={() => item.jobId && onRetry(item.jobId)}
                      disabled={busy}
                      className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                    >
                      {busy ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />
                      )}
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onReindex(item.documentId)}
                    disabled={busy}
                    className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                  >
                    {busy ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    )}
                    Reindex
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnrich(item.documentId)}
                    disabled={busy}
                    className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                  >
                    {busy ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles aria-hidden="true" className="h-4 w-4" />
                    )}
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

function indexingWorkMatchesFilter(item: Pick<IngestionJob | ImportBatch, "status">, filter: IndexingMonitorFilter) {
  if (filter === "all") return true;
  if (filter === "active") return item.status === "pending" || item.status === "processing" || item.status === "queued";
  return item.status === "failed";
}
