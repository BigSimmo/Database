"use client";

import { cn, textMuted, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";
import { fallbackSetupChecks, type SetupCheck } from "@/components/clinical-dashboard/document-manager-contracts";
import type { ClinicalDocument, ImportBatch, IngestionJob } from "@/lib/types";

export type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";

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
      value: loading ? "" : `${indexedDocuments} indexed`,
      tone: loading ? toneNeutral : indexedDocuments ? toneSuccess : toneWarning,
      actionLabel: "Show indexed document files",
    },
    {
      target: "setup" as const,
      label: "Setup",
      value: loading ? "" : `${readyChecks}/${checks.length || fallbackSetupChecks.length} ready`,
      tone: loading
        ? toneNeutral
        : readyChecks === (checks.length || fallbackSetupChecks.length)
          ? toneSuccess
          : toneWarning,
      actionLabel: "Show setup checks",
    },
    {
      target: "indexing" as const,
      label: "Indexing",
      value: loading ? "" : activeJobs + activeBatches ? `${activeJobs + activeBatches} active` : "Idle",
      tone: loading ? toneNeutral : activeJobs + activeBatches ? toneInfo : toneNeutral,
      actionLabel: "Show indexing progress",
    },
    {
      target: "failures" as const,
      label: "Failures",
      value: loading ? "" : failedWork ? `${failedWork} needs review` : "None",
      tone: loading ? toneNeutral : failedWork ? toneDanger : toneNeutral,
      actionLabel: "Show failed indexing work",
    },
  ];

  return (
    <section
      data-testid="library-health-strip"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
      aria-label="Library health"
      style={{ containIntrinsicSize: "auto 76px", contentVisibility: "auto" }}
    >
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">Library health</p>
        <span className={cn("text-2xs font-semibold", textMuted)}>Read-only status</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelectTarget?.(item.target)}
            className={cn(
              "min-h-12 rounded-md border px-2.5 py-2 text-left transition hover:-translate-y-px hover:shadow-[var(--e2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] active:translate-y-0",
              item.tone,
            )}
            aria-label={item.actionLabel}
            aria-busy={loading || undefined}
            style={{ containIntrinsicSize: "auto 48px", contentVisibility: "auto" }}
          >
            <p className="text-2xs font-bold uppercase tracking-label">{item.label}</p>
            {loading ? (
              <div
                className="mt-1 h-4 w-16 animate-skeleton-shimmer rounded bg-[color:var(--surface-inset)]"
                data-testid="library-health-skeleton"
              />
            ) : (
              <p className="mt-1 text-xs font-semibold">{item.value}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
