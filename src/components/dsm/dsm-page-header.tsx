import Link from "next/link";
import { ArrowLeft, BookOpenCheck, GitCompareArrows, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn, codeText, metadataPill, pageContainer } from "@/components/ui-primitives";

export function DsmPageHeader({
  eyebrow = "DSM-5 Diagnosis",
  title,
  description,
  code,
  category,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  code?: string;
  category?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-[color:var(--border)] bg-[color:var(--surface)]", className)}>
      <div className={cn(pageContainer, "px-4 py-4 sm:px-6 sm:py-5 lg:px-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-4xl">
            <Link
              href="/dsm"
              className="mb-3 inline-flex min-h-tap items-center gap-2 rounded-lg text-xs font-bold text-[color:var(--clinical-accent)] transition hover:text-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              DSM-5 Diagnosis home
            </Link>
            <p className="text-2xs font-extrabold uppercase tracking-[0.09em] text-[color:var(--clinical-accent)]">
              {eyebrow}
            </p>
            <div className="mt-1.5 flex min-w-0 items-start gap-3">
              <span className="mt-0.5 hidden h-tap w-tap shrink-0 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:grid">
                <BookOpenCheck className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-balance text-2xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-3xl">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1.5 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {description}
                  </p>
                ) : null}
                {code || category ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {code ? <span className={cn(metadataPill, codeText)}>{code}</span> : null}
                    {category ? <span className={metadataPill}>{category}</span> : null}
                    <span className={metadataPill}>Local clinical reference</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function DsmHeaderActions({ compareHref = "/dsm/compare" }: { compareHref?: string }) {
  return (
    <>
      <Link
        href="/dsm/search"
        className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-xs font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]"
      >
        <Search className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
        Search
      </Link>
      <Link
        href={compareHref}
        className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare
      </Link>
    </>
  );
}
