import Link from "next/link";
import { ArrowRight, Check, GitCompareArrows, Layers3 } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { dictionaryCompareHref, dictionaryKindLabel, type DictionarySearchHit } from "@/lib/dictionary";

const tone = {
  entry: {
    spine: "bg-[color:var(--clinical-accent)]",
    badge:
      "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  },
  abbreviation: {
    spine: "bg-[color:var(--tone-purple)]",
    badge:
      "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]",
  },
  topic: {
    spine: "bg-[color:var(--info)]",
    badge: "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info)]",
  },
} as const;

export function DictionaryResultRow({ hit, compareWith }: { hit: DictionarySearchHit; compareWith?: string }) {
  if (hit.type === "abbreviation") {
    const primary = hit.senses[0];
    return (
      <article className="relative grid min-w-0 grid-cols-[0.1875rem_minmax(0,1fr)] border-b border-[color:var(--border)] bg-[color:var(--surface)] last:border-b-0">
        <span className={tone.abbreviation.spine} aria-hidden="true" />
        <div className="min-w-0 px-3 py-3.5 sm:px-4 sm:py-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold leading-5 text-[color:var(--text-heading)] sm:text-lg">
                  {hit.abbreviation}
                </h2>
                <span
                  className={cn("rounded-md border px-1.5 py-0.5 text-3xs font-extrabold", tone.abbreviation.badge)}
                >
                  Abbreviation
                </span>
                {hit.senses.length > 1 ? (
                  <span className="rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--warning)]">
                    {hit.senses.length} meanings
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                {hit.senses.map((entry) => entry.term).join(" · ")}
              </p>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
                {hit.senses.length > 1
                  ? "Choose the meaning that fits the clinical or service context."
                  : primary?.definition}
              </p>
            </div>
            {primary && hit.senses.length === 1 ? (
              <Link
                href={`/dictionary/${primary.slug}`}
                aria-label={`Open ${primary.term}`}
                className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10 sm:min-w-10"
              >
                <ArrowRight className="size-icon-sm" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-2.5">
            {hit.senses.map((entry) => (
              <div key={entry.slug} className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/dictionary/${entry.slug}`}
                  className="min-h-tap min-w-0 flex-1 rounded-md py-2 text-sm font-bold text-[color:var(--clinical-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
                >
                  {entry.term}
                  <span className="mt-0.5 block text-xs font-medium leading-4 text-[color:var(--text-muted)]">
                    {dictionaryKindLabel(entry.kind)} · {entry.definition}
                  </span>
                </Link>
                <Link
                  href={dictionaryCompareHref([compareWith ?? "", entry.slug])}
                  aria-label={`Add ${entry.term} to comparison`}
                  className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-bold text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Add to compare</span>
                </Link>
              </div>
            ))}
          </div>
          <SourceLine label={hit.reason} />
        </div>
      </article>
    );
  }

  if (hit.type === "topic") {
    return (
      <article className="grid min-w-0 grid-cols-[0.1875rem_minmax(0,1fr)] border-b border-[color:var(--border)] bg-[color:var(--surface)] last:border-b-0">
        <span className={tone.topic.spine} aria-hidden="true" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3.5 sm:px-4 sm:py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold leading-5 text-[color:var(--text-heading)] sm:text-lg">
                {hit.topic.title}
              </h2>
              <span className={cn("rounded-md border px-1.5 py-0.5 text-3xs font-extrabold", tone.topic.badge)}>
                Topic
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{hit.topic.description}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--text-muted)]">
              <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
              {hit.topic.entrySlugs.length} governed terms
            </p>
          </div>
          <Link
            href={`/dictionary/topics/${hit.topic.slug}`}
            aria-label={`Open ${hit.topic.title}`}
            className="grid min-h-tap min-w-tap place-items-center rounded-lg text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10 sm:min-w-10"
          >
            <ArrowRight className="size-icon-sm" aria-hidden="true" />
          </Link>
        </div>
      </article>
    );
  }

  const { entry } = hit;
  return (
    <article className="grid min-w-0 grid-cols-[0.1875rem_minmax(0,1fr)] border-b border-[color:var(--border)] bg-[color:var(--surface)] last:border-b-0">
      <span className={tone.entry.spine} aria-hidden="true" />
      <div className="min-w-0 px-3 py-3.5 sm:px-4 sm:py-4">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold leading-5 text-[color:var(--text-heading)] sm:text-lg">
                {entry.term}
              </h2>
              <span className={cn("rounded-md border px-1.5 py-0.5 text-3xs font-extrabold", tone.entry.badge)}>
                {dictionaryKindLabel(entry.kind)}
              </span>
            </div>
            {entry.aliases.length ? (
              <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">
                Also known as {entry.aliases.map((alias) => alias.value).join(" · ")}
              </p>
            ) : null}
            <p className="mt-1.5 text-sm leading-5 text-[color:var(--text)] sm:text-base-minus sm:leading-6">
              {entry.definition}
            </p>
          </div>
          <Link
            href={`/dictionary/${entry.slug}`}
            aria-label={`Open ${entry.term}`}
            className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10 sm:min-w-10"
          >
            <ArrowRight className="size-icon-sm" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <SourceLine label={hit.reason} />
          <Link
            href={dictionaryCompareHref([compareWith ?? "", entry.slug])}
            className="inline-flex min-h-8 items-center gap-1 text-2xs font-bold text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            Add to compare
          </Link>
        </div>
      </div>
    </article>
  );
}

function SourceLine({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
      <span className="grid h-4 w-4 place-items-center rounded-full border border-[color:var(--success)] text-[color:var(--success)]">
        <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
      Source linked<span aria-hidden="true">·</span>
      {label}
    </span>
  );
}
