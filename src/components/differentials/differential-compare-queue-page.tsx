import Link from "next/link";
import { ArrowRight, Check, GitCompareArrows, ListChecks, Search, X } from "lucide-react";

import { differentialCompareSearchHref, differentialRouteWithQuery } from "@/lib/differentials-navigation";

export type DifferentialCompareQueueItem = {
  slug: string;
  title: string;
};

type DifferentialCompareQueuePageProps = {
  query?: string;
  items: DifferentialCompareQueueItem[];
  openComparisonHref: string;
};

/**
 * Compare queue (empty or selected diagnosis ids). Server Component so the
 * route does not add a client chunk against the repo-wide gzip budget.
 */
export function DifferentialCompareQueuePage({
  query = "",
  items,
  openComparisonHref,
}: DifferentialCompareQueuePageProps) {
  const trimmedQuery = query.trim();
  const selectedIds = items.map((item) => item.slug);
  const editSelectionHref = differentialCompareSearchHref(trimmedQuery, selectedIds);

  if (items.length === 0) {
    return (
      <main
        data-testid="differential-compare-empty"
        className="min-h-[calc(100dvh-var(--shell-header-h))] bg-[color:var(--background)] px-4 py-10 text-[color:var(--text)] sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid w-full max-w-4xl gap-6">
          <section className="overflow-hidden rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--e2)]">
            <div className="h-1 bg-[color:var(--clinical-accent)]" aria-hidden />
            <div className="p-5 sm:p-8">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                <GitCompareArrows className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                Compare differentials
              </p>
              <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
                Tick diagnoses on Search to build a comparison
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base">
                Select one or more diagnoses to review their distinguishing features side by side in a focused clinical
                workspace.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={differentialCompareSearchHref(trimmedQuery)}
                  className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] px-5 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e2)] transition hover:bg-[color:var(--primary-strong)]"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  {trimmedQuery ? "Back to Search results" : "Open Search"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/differentials/diagnoses"
                  className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]"
                >
                  Browse diagnoses
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="differential-compare-queue"
      className="min-h-[calc(100dvh-var(--shell-header-h))] bg-[color:var(--background)] px-4 py-8 text-[color:var(--text)] sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-4xl gap-5 sm:gap-6">
        <section className="overflow-hidden rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--e2)]">
          <div className="h-1 bg-[color:var(--clinical-accent)]" aria-hidden />
          <div className="flex items-center gap-4 p-5 sm:gap-5 sm:p-8">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
              <ListChecks className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
                {items.length} {items.length === 1 ? "diagnosis" : "diagnoses"} selected
              </h1>
              {trimmedQuery ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)]">
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{trimmedQuery}</span>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
          aria-labelledby="selected-diagnoses-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3.5 sm:px-5">
            <h2 id="selected-diagnoses-heading" className="text-sm font-bold text-[color:var(--text-heading)]">
              Selected diagnoses
            </h2>
            <span className="rounded-full bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[color:var(--text-muted)]">
              {items.length} total
            </span>
          </div>
          <ol className="divide-y divide-[color:var(--border)]">
            {items.map((item) => {
              const remainingIds = selectedIds.filter((id) => id !== item.slug);
              return (
                <li
                  key={item.slug}
                  className="group flex min-h-tap items-center gap-3 px-4 py-3 transition hover:bg-[color:var(--surface-subtle)] sm:px-5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                    {selectedIds.indexOf(item.slug) + 1}
                  </span>
                  <Link
                    href={`/differentials/diagnoses/${item.slug}`}
                    className="min-w-0 flex-1 rounded-sm text-sm font-bold text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-base"
                  >
                    <span className="line-clamp-2">{item.title}</span>
                  </Link>
                  <Link
                    href={differentialRouteWithQuery("/differentials/compare", trimmedQuery, remainingIds)}
                    aria-label={`Remove ${item.title} from compare queue`}
                    title={`Remove ${item.title}`}
                    className="grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/50 p-4 sm:p-5"
          aria-label="Comparison actions"
        >
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-[color:var(--text-heading)]">Your shortlist is ready</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                You can return to Search at any time to add or remove diagnoses.
              </p>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Link
              href={openComparisonHref}
              data-testid="differential-compare-open"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] px-5 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e2)] transition hover:bg-[color:var(--primary-strong)]"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              Open comparison
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={editSelectionHref}
              data-testid="differential-compare-edit-selection"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]"
            >
              Edit selection
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
