import type { ReactNode } from "react";

import { SourcesCatalogueClient } from "@/components/sources/sources-catalogue-client";
import type { ClinicalSourceClientEntry } from "@/lib/sources/catalogue-types";
import {
  SOURCE_CATALOGUE_PAGE_SIZE,
  deriveSourceCatalogueFacetCounts,
  filterAndSortSourceCatalogue,
  parseSourceCatalogueFilters,
  type ReadableSearchParams,
} from "@/lib/sources/catalogue-view";

/**
 * The synchronous, directly-testable half of the source catalogue route.
 *
 * This stays a plain Server Component (no `"use client"`, no `async`): parsing,
 * filtering, sorting, the facet counts and the pagination slice all happen
 * here, so only the current page's 50 entries — not all 866 — are painted into
 * the markup and serialised again into the RSC flight payload. `/sources/search`
 * was measured at 3,233,140 bytes on production for exactly that reason.
 *
 * Slicing in the client would not have helped: `ReviewStatePageContent` records
 * the same finding — "client-side slicing after the full array had already
 * crossed the RSC boundary didn't actually reduce the transferred payload".
 *
 * Filtering stays whole-catalogue. The filters are applied to every entry here
 * and only then sliced, so narrowing still searches the entire registry rather
 * than the page in front of the reader, and every existing URL parameter is
 * parsed exactly as before.
 */
export function SourcesCatalogueContent({
  entries,
  hostedDocuments,
  searchParams,
}: {
  entries: readonly ClinicalSourceClientEntry[];
  hostedDocuments: "available" | "unavailable";
  searchParams?: ReadableSearchParams;
}): ReactNode {
  const params: ReadableSearchParams = searchParams ?? new URLSearchParams();
  const filters = parseSourceCatalogueFilters(params, entries);
  const matches = filterAndSortSourceCatalogue(entries, filters);
  const facetCounts = deriveSourceCatalogueFacetCounts(entries, filters);

  const pageCount = Math.max(1, Math.ceil(matches.length / SOURCE_CATALOGUE_PAGE_SIZE));
  // Clamped, not trusted: `?page=0`, `?page=cheese` and a page number left over
  // from a wider filter are all ordinary states of a shared or bookmarked link.
  const requested = Number.parseInt(params.get("page") ?? "", 10);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pageCount);
  const startIndex = (page - 1) * SOURCE_CATALOGUE_PAGE_SIZE;

  return (
    <SourcesCatalogueClient
      entries={matches.slice(startIndex, startIndex + SOURCE_CATALOGUE_PAGE_SIZE)}
      hostedDocuments={hostedDocuments}
      filters={filters}
      facetCounts={facetCounts}
      totalMatches={matches.length}
      page={page}
      pageCount={pageCount}
      startIndex={startIndex}
    />
  );
}
