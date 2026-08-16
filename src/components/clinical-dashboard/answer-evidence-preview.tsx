"use client";

import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

import { cleanDisplayTitle, compactSourceSnippet } from "@/components/clinical-dashboard/display-text";
import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import { cn, panelSubtle, textMuted } from "@/components/ui-primitives";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";

const visiblePreviewSourceLimit = 3;

export function AnswerEvidencePreview({ preview }: { preview: VerifiedEvidencePreviewUnit }) {
  const visibleSources = preview.sources.slice(0, visiblePreviewSourceLimit);

  return (
    <section
      aria-labelledby="answer-evidence-preview-title"
      data-testid="answer-evidence-preview"
      className={cn(panelSubtle, "overflow-hidden")}
    >
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 sm:px-4">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="answer-evidence-preview-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
              Selected evidence — answer still being verified
            </h2>
            <p className={cn("mt-0.5 text-xs leading-5", textMuted)}>
              {preview.selectedContextCount} source passage{preview.selectedContextCount === 1 ? "" : "s"} selected. The
              final answer and source list remain authoritative.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
        {visibleSources.map((source, index) => {
          const title = cleanDisplayTitle(source.title);
          const snippet = compactSourceSnippet(source.content, { dropTitle: title });
          return (
            <Link
              key={`${source.document_id}:${source.id}`}
              href={sourceResultHref(source)}
              aria-label={`Open selected evidence ${index + 1}: ${title}`}
              className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <div className="flex items-start gap-2">
                <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
                  <p className={cn("mt-0.5 text-xs", textMuted)}>
                    p.{source.page_number ?? "n/a"}
                    {source.section_heading ? ` · ${cleanDisplayTitle(source.section_heading)}` : ""}
                  </p>
                </div>
              </div>
              {snippet ? <p className={cn("mt-2 line-clamp-2 text-xs leading-5", textMuted)}>{snippet}</p> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
