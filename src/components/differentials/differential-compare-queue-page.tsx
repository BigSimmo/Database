"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitCompareArrows, Search, X } from "lucide-react";

import { appModeHomeHref } from "@/lib/app-modes";
import { differentialRouteWithQuery } from "@/lib/differentials-navigation";

export type DifferentialCompareQueueItem = {
  slug: string;
  title: string;
};

type DifferentialCompareQueuePageProps = {
  query?: string;
  items: DifferentialCompareQueueItem[];
  openComparisonHref: string;
};

function searchHref(query: string) {
  return appModeHomeHref("differentials", {
    query: query.trim() || undefined,
    run: Boolean(query.trim()),
    focus: true,
  });
}

export function DifferentialCompareQueuePage({
  query = "",
  items,
  openComparisonHref,
}: DifferentialCompareQueuePageProps) {
  const router = useRouter();
  const trimmedQuery = query.trim();

  function removeId(slug: string) {
    const nextIds = items.map((item) => item.slug).filter((id) => id !== slug);
    router.replace(differentialRouteWithQuery("/differentials/compare", trimmedQuery, nextIds));
  }

  if (items.length === 0) {
    return (
      <main
        data-testid="differential-compare-empty"
        className="min-h-[calc(100dvh-var(--shell-header-h))] bg-[color:var(--background)] px-4 py-10 text-[color:var(--text)] sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid w-full max-w-3xl gap-6">
          <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">Compare</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
              Tick diagnoses on Search to build a comparison
            </h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
              The compare queue is empty. Search differentials, select diagnoses, then return here to open a
              side-by-side presentation workflow.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={searchHref(trimmedQuery)}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent-contrast)]"
              >
                <Search className="h-4 w-4" aria-hidden />
                {trimmedQuery ? "Back to Search results" : "Open Search"}
              </Link>
              <Link
                href="/differentials/diagnoses"
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-heading)]"
              >
                Browse diagnoses
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="differential-compare-queue"
      className="min-h-[calc(100dvh-var(--shell-header-h))] bg-[color:var(--background)] px-4 py-10 text-[color:var(--text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                Compare queue
              </p>
              <h1 className="mt-1 text-3xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
                {items.length} diagnosis{items.length === 1 ? "" : "es"} selected
              </h1>
              <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
                Review the queue, remove any diagnosis you do not need, then open the comparison workspace.
              </p>
              {trimmedQuery ? (
                <p className="mt-2 text-sm font-bold text-[color:var(--clinical-accent)]">Query: {trimmedQuery}</p>
              ) : null}
            </div>
            <Link
              href={searchHref(trimmedQuery)}
              className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Search
            </Link>
          </div>
        </section>

        <section className="grid gap-2" aria-label="Selected diagnoses">
          {items.map((item) => (
            <div
              key={item.slug}
              className="flex min-h-tap items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)]"
            >
              <Link
                href={`/differentials/diagnoses/${item.slug}`}
                className="min-w-0 text-sm font-bold text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)]"
              >
                <span className="line-clamp-2">{item.title}</span>
              </Link>
              <button
                type="button"
                onClick={() => removeId(item.slug)}
                aria-label={`Remove ${item.title} from compare queue`}
                className="grid h-tap w-tap shrink-0 place-items-center rounded-md border border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--danger-border)] hover:text-[color:var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          <Link
            href={openComparisonHref}
            data-testid="differential-compare-open"
            className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent-contrast)]"
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden />
            Open comparison
          </Link>
          <Link
            href={searchHref(trimmedQuery)}
            className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-heading)]"
          >
            Edit selection on Search
          </Link>
        </div>
      </div>
    </main>
  );
}
