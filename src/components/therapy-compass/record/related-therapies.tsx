"use client";

import { ChevronRight } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

import { cardPreviewText } from "../data/select";
import type { RelatedTherapy } from "../data/related";
import { therapyBtn } from "../controls";

/**
 * Nearest neighbours, each carrying the reason it is here.
 *
 * The reason is the change that matters. The previous list weighted every
 * shared tag equally, and in this catalogue `Crisis/risk` is on 196 of 205
 * records — so the panel reliably suggested four therapies from the same
 * category and left the reader to guess what the connection was. Now the rank
 * comes from rarer signals (the record naming the therapy, rare shared tags,
 * overlapping targets) and the strongest one is printed on the row.
 *
 * Full width rather than a narrow rail card: these are the page's onward
 * journeys, and a two-line name in a 344px column was the reason every subtitle
 * ended in an ellipsis.
 */
export function RelatedTherapies({ related, onOpen }: { related: RelatedTherapy[]; onOpen: (slug: string) => void }) {
  if (!related.length) return null;

  return (
    <section className={cn(cardSurface, "overflow-hidden")} aria-labelledby="therapy-related-heading">
      <h2
        id="therapy-related-heading"
        className="border-b border-[color:var(--border)] px-4 py-3 text-sm font-semibold text-[color:var(--text-heading)] sm:px-5"
      >
        Related therapies
      </h2>
      <ul className="m-0 list-none p-0">
        {related.map(({ therapy, reason }) => (
          <li key={therapy.slug} className="border-b border-[color:var(--border)] last:border-b-0">
            <button
              type="button"
              onClick={() => onOpen(therapy.slug)}
              className={cn(
                therapyBtn,
                "flex min-h-tap w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-subtle)] sm:px-5",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{therapy.name}</span>
                  <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-px text-3xs font-semibold text-[color:var(--clinical-accent)]">
                    {reason}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[color:var(--text-muted)]">
                  {cardPreviewText(therapy.bestUsedFor ?? therapy.clinicalSummary, {
                    exclude: therapy.name,
                    maxSentences: 1,
                  }) || therapy.category}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
