"use client";

import Link from "next/link";
import { ArrowRight, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { factsheets, factsheetTopics } from "@/components/factsheets/factsheets-data";
import {
  cn,
  fieldControlWithIcon,
  fieldIcon,
  metadataPill,
  primaryControl,
  quietPanel,
} from "@/components/ui-primitives";

export function FactsheetsHomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/factsheets/search?q=${encodeURIComponent(value)}` : "/factsheets/search");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section className="max-w-3xl">
        <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--clinical-accent)]">
          Patient information library
        </p>
        <h1 className="mt-3 text-hero font-semibold tracking-tight text-[color:var(--text-heading)]">
          Clear information for the next conversation.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">
          Find a short, plain-language factsheet to support a patient conversation. Every published sheet should be
          sourced, locally approved, and easy to take away.
        </p>
      </section>

      <form onSubmit={submit} className="mt-8 max-w-3xl" role="search">
        <label htmlFor="factsheet-home-search" className="sr-only">
          Search patient information sheets
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className={fieldIcon} aria-hidden="true" />
            <input
              id="factsheet-home-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={fieldControlWithIcon}
              placeholder="Search topics, appointments, support…"
            />
          </div>
          <button type="submit" className={cn(primaryControl, "px-4")}>
            Search sheets
            <ArrowRight className="size-icon-md" aria-hidden="true" />
          </button>
        </div>
      </form>

      <section className="mt-10" aria-labelledby="browse-topics">
        <h2 id="browse-topics" className="text-sm font-semibold text-[color:var(--text-heading)]">
          Browse by topic
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {factsheetTopics.map((topic) => (
            <Link key={topic} href={`/factsheets/search?q=${encodeURIComponent(topic)}`} className={metadataPill}>
              {topic}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t border-[color:var(--border)] pt-7" aria-labelledby="featured-sheets">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="featured-sheets" className="text-lg font-semibold text-[color:var(--text-heading)]">
              Start with a factsheet
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Sample layouts only — not clinical guidance.</p>
          </div>
          <Link
            href="/factsheets/search"
            className="text-sm font-semibold text-[color:var(--clinical-accent)] underline-offset-4 hover:underline"
          >
            View all sheets
          </Link>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {factsheets.map((factsheet) => (
            <Link
              key={factsheet.slug}
              href={`/factsheets/${factsheet.slug}`}
              className={cn(
                quietPanel,
                "group p-4 transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <FileText className="size-icon-md" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-semibold text-[color:var(--text-muted)]">{factsheet.topic}</p>
              <h3 className="mt-1 text-base font-semibold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                {factsheet.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{factsheet.summary}</p>
              <p className="mt-4 text-xs font-semibold text-[color:var(--text-soft)]">{factsheet.readTime}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
