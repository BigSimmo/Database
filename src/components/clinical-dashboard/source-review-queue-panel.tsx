"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import {
  cn,
  panelSubtle,
  SourceProvenance,
  SourceStatusBadge,
  textMuted,
  toneDanger,
  toneWarning,
} from "@/components/ui-primitives";
import { normalizeSourceMetadata, sourceStatusNeedsAttention } from "@/lib/source-metadata";
import type { SearchResult } from "@/lib/types";

export function SourceReviewQueuePanel({ sources }: { sources: SearchResult[] }) {
  const reviewItems = sources.filter((source) => sourceStatusNeedsAttention(normalizeSourceMetadata(source.source_metadata)));

  if (reviewItems.length === 0) return null;

  return (
    <section className={cn(panelSubtle, "p-3")} aria-label="Sources needing governance review">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--warning-soft)] text-[color:var(--warning)]">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Source review queue</h3>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            {reviewItems.length} matched source{reviewItems.length === 1 ? "" : "s"} need clinical review before use.
          </p>
        </div>
      </div>

      <ul className="mt-3 grid gap-2">
        {reviewItems.slice(0, 8).map((source) => {
          const metadata = normalizeSourceMetadata(source.source_metadata);
          const isDanger = metadata.document_status === "outdated" || metadata.extraction_quality === "poor";
          return (
            <li key={source.id} className={cn("rounded-lg border p-3", isDanger ? toneDanger : toneWarning)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={sourceResultHref(source)}
                  className="min-w-0 text-sm font-semibold leading-5 text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  {cleanDisplayTitle(source.title || source.file_name || "Source")}
                </Link>
                <SourceStatusBadge metadata={metadata} showTitle={false} />
              </div>
              <SourceProvenance metadata={metadata} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
