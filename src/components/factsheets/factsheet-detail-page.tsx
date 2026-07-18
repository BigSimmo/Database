"use client";

import Link from "next/link";
import { ArrowLeft, Check, Copy, FileText, Printer, Share2 } from "lucide-react";
import { useRef, useState } from "react";

import type { Factsheet } from "@/components/factsheets/factsheets-data";
import { Sheet } from "@/components/ui/sheet";
import { cn, floatingControl, metadataPill, primaryControl, quietPanel } from "@/components/ui-primitives";

export function FactsheetDetailPage({ factsheet }: { factsheet: Factsheet }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-10 lg:px-8">
      <Link
        href="/factsheets/search"
        className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft className="size-icon-md" aria-hidden="true" /> All factsheets
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,44rem)_18rem] lg:items-start">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={metadataPill}>{factsheet.topic}</span>
            <span className="text-xs font-semibold text-[color:var(--text-soft)]">{factsheet.readTime}</span>
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            {factsheet.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">{factsheet.summary}</p>
          <div className={cn(quietPanel, "mt-7 flex gap-3 p-4")}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <FileText className="size-icon-md" aria-hidden="true" />
            </span>
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">
              <strong className="font-semibold text-[color:var(--text-heading)]">Sample layout only.</strong> This page
              demonstrates hierarchy and interaction; it is not clinical guidance and must be replaced with approved
              local content before publication.
            </p>
          </div>
          <div className="mt-9 space-y-8">
            {factsheet.sections.map((section) => (
              <section key={section.heading} className="max-w-2xl">
                <h2 className="text-xl font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
                <p className="mt-3 text-base leading-7 text-[color:var(--text-muted)]">{section.body}</p>
              </section>
            ))}
          </div>
        </article>
        <aside className={cn(quietPanel, "space-y-4 p-4 lg:sticky lg:top-6")} aria-label="Factsheet details">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">For</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">{factsheet.audience}</p>
          </div>
          <div className="border-t border-[color:var(--border)] pt-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">Status</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">{factsheet.updated}</p>
          </div>
          <div className="grid gap-2 border-t border-[color:var(--border)] pt-4">
            <button ref={shareButtonRef} type="button" onClick={() => setShareOpen(true)} className={primaryControl}>
              <Share2 className="size-icon-md" aria-hidden="true" /> Share sheet
            </button>
            <button type="button" onClick={() => window.print()} className={floatingControl}>
              <Printer className="size-icon-md" aria-hidden="true" /> Print
            </button>
          </div>
        </aside>
      </div>
      <Sheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this factsheet"
        description="Copy a link for a colleague or patient to open this sample layout."
        returnFocusRef={shareButtonRef}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            Only share published, governance-approved patient information.
          </p>
          <button type="button" onClick={copyLink} className={primaryControl}>
            {copyStatus === "copied" ? (
              <Check className="size-icon-md" aria-hidden="true" />
            ) : (
              <Copy className="size-icon-md" aria-hidden="true" />
            )}
            {copyStatus === "copied" ? "Link copied" : "Copy link"}
          </button>
          {copyStatus === "error" ? (
            <p role="alert" className="text-sm text-[color:var(--danger)]">
              Could not copy the link. Please copy it from your browser address bar.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
