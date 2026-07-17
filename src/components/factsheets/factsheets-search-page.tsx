"use client";

import Link from "next/link";
import { FileSearch, FileText, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { factsheets } from "@/components/factsheets/factsheets-data";
import {
  EmptyState,
  LoadingPanel,
  cn,
  fieldControlWithIcon,
  fieldIcon,
  metadataPill,
  primaryControl,
  quietPanel,
} from "@/components/ui-primitives";

export function FactsheetsSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submittedQuery = (searchParams.get("q") ?? "").trim();
  const [input, setInput] = useState(submittedQuery);
  const [loading, setLoading] = useState(false);

  useEffect(() => setInput(submittedQuery), [submittedQuery]);
  useEffect(() => {
    if (!submittedQuery) return;
    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(timeout);
  }, [submittedQuery]);

  const results = useMemo(() => {
    const normalized = submittedQuery.toLowerCase();
    if (!normalized) return factsheets;
    return factsheets.filter((factsheet) =>
      [factsheet.title, factsheet.summary, factsheet.topic, factsheet.audience]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [submittedQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = input.trim();
    router.push(query ? `/factsheets/search?q=${encodeURIComponent(query)}` : "/factsheets/search");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--clinical-accent)]">
        Find a sheet
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-heading)]">
        Search patient information
      </h1>
      <form onSubmit={submit} role="search" className="mt-5 max-w-3xl">
        <label htmlFor="factsheet-search" className="sr-only">
          Search patient information sheets
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className={fieldIcon} aria-hidden="true" />
            <input
              id="factsheet-search"
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className={fieldControlWithIcon}
              placeholder="Search a topic or keyword"
            />
          </div>
          <button type="submit" className={cn(primaryControl, "px-4")}>
            Search
          </button>
        </div>
      </form>

      <section className="mt-8" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <LoadingPanel label="Searching patient information sheets" variant="skeleton" lines={3} />
        ) : results.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={FileSearch}
              title="No factsheets found"
              body="Try a broader topic, or return to the library to browse the available sample layouts."
            />
            <div className="flex justify-center">
              <Link href="/factsheets" className={primaryControl}>
                Browse sheets
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--text-muted)]">
                {submittedQuery
                  ? `${results.length} result${results.length === 1 ? "" : "s"} for “${submittedQuery}”`
                  : `${results.length} sample factsheets`}
              </p>
              {submittedQuery ? (
                <Link
                  href="/factsheets/search"
                  className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-[color:var(--clinical-accent)]"
                >
                  <X className="size-icon-sm" aria-hidden="true" /> Clear search
                </Link>
              ) : null}
            </div>
            <div className="mt-4 divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
              {results.map((factsheet) => (
                <Link
                  key={factsheet.slug}
                  href={`/factsheets/${factsheet.slug}`}
                  className="group flex min-h-12 items-start gap-3 px-4 py-4 transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <FileText className="size-icon-md" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                        {factsheet.title}
                      </span>
                      <span className={metadataPill}>{factsheet.topic}</span>
                    </span>
                    <span className="mt-1 block max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                      {factsheet.summary}
                    </span>
                    <span className="mt-2 block text-xs font-semibold text-[color:var(--text-soft)]">
                      {factsheet.audience} · {factsheet.readTime}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
      <aside className={cn(quietPanel, "mt-6 max-w-3xl p-4 text-sm leading-6 text-[color:var(--text-muted)]")}>
        <strong className="font-semibold text-[color:var(--text-heading)]">Content status:</strong> These are
        deliberately labelled sample layouts. Connect only governance-approved patient information before publication.
      </aside>
    </div>
  );
}
