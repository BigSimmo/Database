import { describe, expect, it, vi } from "vitest";

import { SourcesCatalogueContent } from "@/components/sources/sources-catalogue-content";
import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import type { ClinicalSourceClientEntry, SourceCatalogueFilters } from "@/lib/sources/catalogue-types";
import {
  SOURCE_CATALOGUE_PAGE_SIZE,
  deriveSourceCatalogueFacetCounts,
  filterAndSortSourceCatalogue,
  parseSourceCatalogueFilters,
  projectSourceCatalogueForClient,
} from "@/lib/sources/catalogue-view";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sources/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * `/sources/search` returned 3,233,140 bytes on production: 1,859,563 of
 * rendered markup and 1,365,372 of RSC flight payload, because all 866
 * catalogue entries were painted into the DOM and serialised again so the
 * browser could filter them.
 *
 * The slice now happens on the server, before anything crosses the RSC
 * boundary. These tests pin the two things that make that safe to keep: only
 * one page of entries reaches the client, and narrowing still searches the
 * whole catalogue rather than the page in front of the reader.
 */

const ENTRIES = projectSourceCatalogueForClient(canonicalizeSourceReferences(repositorySourceReferences()));

type ClientProps = {
  entries: readonly ClinicalSourceClientEntry[];
  totalMatches: number;
  page: number;
  pageCount: number;
  startIndex: number;
  filters: SourceCatalogueFilters;
  facetCounts: ReturnType<typeof deriveSourceCatalogueFacetCounts>;
};

/** The element the server half hands to the client half, without rendering it. */
function clientProps(query: string): ClientProps {
  const element = SourcesCatalogueContent({
    entries: ENTRIES,
    hostedDocuments: "available",
    searchParams: new URLSearchParams(query),
  }) as { props: ClientProps };
  return element.props;
}

function idsFor(query: string) {
  return filterAndSortSourceCatalogue(ENTRIES, parseSourceCatalogueFilters(new URLSearchParams(query), ENTRIES)).map(
    (entry) => entry.id,
  );
}

describe("source catalogue pagination", () => {
  it("has a catalogue large enough for pagination to matter", () => {
    expect(ENTRIES.length).toBeGreaterThan(SOURCE_CATALOGUE_PAGE_SIZE * 4);
  });

  it("sends one page of entries, not the whole catalogue", () => {
    const first = clientProps("");
    expect(first.entries).toHaveLength(SOURCE_CATALOGUE_PAGE_SIZE);
    expect(first.page).toBe(1);
    expect(first.startIndex).toBe(0);
    expect(first.totalMatches).toBe(ENTRIES.length);
    expect(first.pageCount).toBe(Math.ceil(ENTRIES.length / SOURCE_CATALOGUE_PAGE_SIZE));
    expect(first.entries.map((entry) => entry.id)).toEqual(idsFor("").slice(0, SOURCE_CATALOGUE_PAGE_SIZE));
  });

  it("serves later pages as the next slice of the same order", () => {
    const second = clientProps("?page=2");
    expect(second.startIndex).toBe(SOURCE_CATALOGUE_PAGE_SIZE);
    expect(second.entries.map((entry) => entry.id)).toEqual(
      idsFor("").slice(SOURCE_CATALOGUE_PAGE_SIZE, SOURCE_CATALOGUE_PAGE_SIZE * 2),
    );
  });

  it("clamps a page number a link or a narrowed filter left out of range", () => {
    const last = Math.ceil(ENTRIES.length / SOURCE_CATALOGUE_PAGE_SIZE);
    expect(clientProps("?page=99999").page).toBe(last);
    expect(clientProps("?page=0").page).toBe(1);
    expect(clientProps("?page=cheese").page).toBe(1);
  });

  it("keeps filtering across the whole catalogue, not the visible page", () => {
    // An entry that sits well past the first page unfiltered must still be
    // findable by its own filter — the regression a page-local filter causes.
    const all = idsFor("");
    const beyondFirstPage = all[all.length - 1];
    const target = ENTRIES.find((entry) => entry.id === beyondFirstPage);
    expect(target).toBeTruthy();

    const narrowed = clientProps(`?q=${encodeURIComponent(target!.title)}`);
    expect(narrowed.entries.map((entry) => entry.id)).toContain(beyondFirstPage);
    expect(narrowed.totalMatches).toBeLessThan(ENTRIES.length);

    // Sorting is whole-catalogue too: the title-sorted first page is the head of
    // the title-sorted catalogue, not a re-sort of the quality-sorted head.
    expect(clientProps("?sort=title").entries.map((entry) => entry.id)).toEqual(
      idsFor("?sort=title").slice(0, SOURCE_CATALOGUE_PAGE_SIZE),
    );
  });

  it("measurably shrinks what crosses the RSC boundary", () => {
    const whole = JSON.stringify(ENTRIES).length;
    const onePage = JSON.stringify(clientProps("").entries).length;
    // The guard is the order of magnitude, not a byte count every content change
    // would churn: 50 of 866 entries is under a tenth of the catalogue.
    expect(onePage).toBeLessThan(whole * 0.15);
  });
});

describe("source catalogue facet counts", () => {
  /** The definition the browser used to evaluate, per option, per render. */
  function naiveCount(
    filters: SourceCatalogueFilters,
    key: "band" | "jurisdiction" | "topic" | "usedBy",
    value: string,
  ) {
    const current: readonly string[] =
      key === "band"
        ? filters.bands
        : key === "jurisdiction"
          ? filters.jurisdictions
          : key === "topic"
            ? filters.topics
            : filters.usedBy;
    const widened = current.includes(value) ? current : [...current, value];
    const candidate = {
      ...filters,
      ...(key === "band"
        ? { bands: widened as SourceCatalogueFilters["bands"] }
        : key === "jurisdiction"
          ? { jurisdictions: widened as SourceCatalogueFilters["jurisdictions"] }
          : key === "topic"
            ? { topics: [...widened] }
            : { usedBy: widened as SourceCatalogueFilters["usedBy"] }),
    };
    return filterAndSortSourceCatalogue(ENTRIES, candidate).length;
  }

  it("matches the per-option recomputation it replaced, in every filter state", () => {
    for (const query of [
      "",
      "?band=A",
      "?band=A&band=B",
      "?jurisdiction=wa",
      "?q=health",
      "?usedBy=documents&topic=governance",
    ]) {
      const filters = parseSourceCatalogueFilters(new URLSearchParams(query), ENTRIES);
      const counts = deriveSourceCatalogueFacetCounts(ENTRIES, filters);
      for (const key of ["band", "jurisdiction", "topic", "usedBy"] as const) {
        expect(counts[key].length, `${query || "(none)"} ${key}`).toBeGreaterThan(0);
        for (const option of counts[key]) {
          expect(option.count, `${query || "(none)"} ${key}=${option.value}`).toBe(
            naiveCount(filters, key, option.value),
          );
        }
      }
    }
  });

  it("counts the whole catalogue regardless of which page is showing", () => {
    expect(clientProps("?page=7").facetCounts).toEqual(clientProps("").facetCounts);
  });
});
