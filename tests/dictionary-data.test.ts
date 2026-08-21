import { describe, expect, it } from "vitest";

import {
  dictionaryAliasSenses,
  dictionaryBrowseLetter,
  dictionaryCatalogue,
  dictionaryCatalogueIssues,
  dictionaryClearedQueryKeys,
  dictionaryCompareHref,
  dictionaryComparisonPair,
  parseDictionaryCatalogueParams,
  parseDictionaryFilters,
  searchDictionary,
} from "@/lib/dictionary";
import { dictionaryEntries, dictionaryEntryKinds, dictionarySources, dictionaryTopics } from "@/lib/dictionary-data";

const baseFilters = {
  q: "",
  view: "all" as const,
  topics: [],
  kinds: [],
  sources: [],
  sort: "relevance" as const,
};

const baseCatalogue = {
  q: "",
  scope: "definitions" as const,
  letter: "all",
  topics: [],
  kinds: [],
  sources: [],
  sort: "az" as const,
};

describe("clinical dictionary catalogue", () => {
  it("publishes exactly 96 unique canonical entries across 12 unique topics", () => {
    expect(dictionaryEntries).toHaveLength(96);
    expect(new Set(dictionaryEntries.map((entry) => entry.slug)).size).toBe(96);
    expect(dictionaryTopics).toHaveLength(12);
    expect(new Set(dictionaryTopics.map((topic) => topic.slug)).size).toBe(12);
    expect(dictionaryTopics.every((topic) => topic.entrySlugs.length === 8)).toBe(true);
    expect(dictionaryCatalogueIssues()).toEqual([]);
  });

  it("keeps every published entry source linked, approval pending, and fully linked", () => {
    const sourceIds = new Set<string>(dictionarySources.map((source) => source.id));
    const entrySlugs = new Set(dictionaryEntries.map((entry) => entry.slug));
    for (const entry of dictionaryEntries) {
      expect(entry.sourceRefs.length).toBeGreaterThan(0);
      expect(entry.sourceRefs.every((reference) => sourceIds.has(reference.sourceId))).toBe(true);
      expect(entry.review.status).toBe("source-linked");
      expect(entry.review.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.review.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.review.clinicalApproval).toBe("pending");
      expect(entry.relatedSlugs).toHaveLength(4);
      expect(entry.relatedSlugs.every((slug) => entrySlugs.has(slug))).toBe(true);
    }
    for (const source of dictionarySources) expect(source.url).toMatch(/^https?:\/\//);
  });

  it("groups ACT into two recognised abbreviation senses and resolves unambiguous aliases", () => {
    expect(
      dictionaryAliasSenses("ACT")
        .map((entry) => entry.slug)
        .sort(),
    ).toEqual(["acceptance-and-commitment-therapy", "assertive-community-treatment"]);
    expect(dictionaryAliasSenses("MSE").map((entry) => entry.slug)).toEqual(["mental-state-examination"]);
    const actHits = searchDictionary({ ...baseFilters, q: "ACT", view: "abbreviations" });
    expect(actHits).toHaveLength(1);
    expect(actHits[0]).toMatchObject({ type: "abbreviation", abbreviation: "ACT", senses: { length: 2 } });
  });

  it("uses one predicate for lens counts and topic, kind and source filters", () => {
    const topic = dictionaryTopics[0]!;
    const topicHits = searchDictionary({ ...baseFilters, view: "definitions", topics: [topic.slug] });
    expect(topicHits).toHaveLength(topic.entrySlugs.length);
    expect(topicHits.every((hit) => hit.type === "entry" && hit.entry.topicSlug === topic.slug)).toBe(true);

    const assessmentHits = searchDictionary({ ...baseFilters, view: "definitions", kinds: ["assessment"] });
    expect(assessmentHits.length).toBeGreaterThan(0);
    expect(assessmentHits.every((hit) => hit.type === "entry" && hit.entry.kind === "assessment")).toBe(true);

    const source = dictionarySources[0]!;
    const sourceHits = searchDictionary({ ...baseFilters, view: "definitions", sources: [source.id] });
    expect(sourceHits.length).toBeGreaterThan(0);
    expect(
      sourceHits.every(
        (hit) => hit.type === "entry" && hit.entry.sourceRefs.some((reference) => reference.sourceId === source.id),
      ),
    ).toBe(true);
  });

  it("normalises invalid URL filters without throwing", () => {
    const filters = parseDictionaryFilters(
      new URLSearchParams("q=MSE&view=bad&topic=missing&kind=bad&source=missing&updated=old&sort=random"),
    );
    // `updated=old` is deliberately still in the query string: the retired
    // "recently updated" lens must be ignored, not resurrected.
    expect(filters).toEqual({ ...baseFilters, q: "MSE" });
    expect(dictionaryEntryKinds).not.toContain("bad");
  });

  it("keeps compare links unique and relationship summaries explicitly curated", () => {
    expect(dictionaryCompareHref(["mood", "mood", "affect"])).toBe("/dictionary/compare?a=mood&b=affect");
    expect(dictionaryCompareHref(["missing", "mood"])).toBe("/dictionary/compare?a=mood");
    expect(dictionaryComparisonPair("mental-state-examination", "mini-mental-state-examination")?.summary).toMatch(
      /MSE/,
    );
    expect(dictionaryComparisonPair("affect", "delirium")).toBeNull();
  });

  it("files every browse hit under the letter the alphabetical index offers", () => {
    // The catalogue header derives its selectable letters from
    // `dictionaryBrowseLetter` and offers the rest inert. If the two ever
    // disagreed the index would strand the reader on an empty page, which is the
    // failure this pins: for both scopes, a letter the helper reports must
    // return results, and a letter it does not report must return none.
    for (const scope of ["definitions", "abbreviations"] as const) {
      const all = dictionaryCatalogue({ ...baseCatalogue, scope });
      expect(all.length).toBeGreaterThan(0);
      const available = new Set(all.map(dictionaryBrowseLetter));
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const hits = dictionaryCatalogue({ ...baseCatalogue, scope, letter });
        expect(hits.length > 0).toBe(available.has(letter));
      }
      // Every hit accounted for exactly once across the per-letter partition.
      const partitioned = [...available].reduce(
        (total, letter) => total + dictionaryCatalogue({ ...baseCatalogue, scope, letter }).length,
        0,
      );
      expect(partitioned).toBe(all.length);
    }
  });
});

describe("merged dictionary catalogue", () => {
  it("lists the whole catalogue on an empty query and narrows the same list on a typed one", () => {
    const everything = dictionaryCatalogue(baseCatalogue);
    expect(everything).toHaveLength(96);

    const narrowed = dictionaryCatalogue({ ...baseCatalogue, q: "tardive dyskinesia", sort: "relevance" });
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.length).toBeLessThan(everything.length);
    // The same rows, from the same list — not a second data source.
    const everythingSlugs = new Set(everything.map((hit) => (hit.type === "entry" ? hit.entry.slug : "")));
    for (const hit of narrowed) {
      if (hit.type === "entry") expect(everythingSlugs.has(hit.entry.slug)).toBe(true);
    }
    // Clearing the query restores the catalogue.
    expect(dictionaryCatalogue({ ...baseCatalogue, q: "" })).toHaveLength(96);
  });

  it("drops the alphabetical index while a query runs, because the chip stands down", () => {
    // The letter chip is replaced by the query line during a search, so a
    // `letter` left in the URL would keep narrowing the list with no visible
    // control to explain it — a filter the reader cannot see or remove.
    const searched = dictionaryCatalogue({ ...baseCatalogue, q: "tardive", letter: "Z", sort: "relevance" });
    expect(searched.length).toBeGreaterThan(0);
    expect(searched).toEqual(dictionaryCatalogue({ ...baseCatalogue, q: "tardive", letter: "all", sort: "relevance" }));
    // Browsing still honours it.
    const browsed = dictionaryCatalogue({ ...baseCatalogue, letter: "A" });
    expect(browsed.length).toBeGreaterThan(0);
    expect(browsed.every((hit) => dictionaryBrowseLetter(hit) === "A")).toBe(true);
  });

  it("keeps the two scopes disjoint and both reachable", () => {
    const terms = dictionaryCatalogue({ ...baseCatalogue, scope: "definitions" });
    const abbreviations = dictionaryCatalogue({ ...baseCatalogue, scope: "abbreviations" });
    expect(terms.every((hit) => hit.type === "entry")).toBe(true);
    expect(abbreviations.every((hit) => hit.type === "abbreviation")).toBe(true);
    expect(abbreviations.length).toBeGreaterThan(0);
  });

  it("degrades the two retired search lenses rather than rendering an empty list", () => {
    // `view=all` and `view=topics` were `/dictionary/search`'s own lenses. Topics
    // is its own mode-nav destination now and `all` mixed two row shapes, so both
    // land on the definitions scope instead of 404-ing a bookmark.
    for (const view of ["all", "topics", "az", "nonsense"]) {
      expect(parseDictionaryCatalogueParams(new URLSearchParams(`view=${view}`)).scope).toBe("definitions");
    }
    expect(parseDictionaryCatalogueParams(new URLSearchParams("view=abbreviations")).scope).toBe("abbreviations");
  });

  it("defaults sort by state: A–Z while browsing, relevance while searching", () => {
    // Relevance against an empty query scores every entry identically, so the
    // catalogue would arrive in source order rather than alphabetically.
    expect(parseDictionaryCatalogueParams(new URLSearchParams()).sort).toBe("az");
    expect(parseDictionaryCatalogueParams(new URLSearchParams("q=mse")).sort).toBe("relevance");
    expect(parseDictionaryCatalogueParams(new URLSearchParams("q=mse&sort=za")).sort).toBe("za");
    expect(parseDictionaryCatalogueParams(new URLSearchParams("sort=nonsense")).sort).toBe("az");

    const ascending = dictionaryCatalogue({ ...baseCatalogue, sort: "az" });
    const descending = dictionaryCatalogue({ ...baseCatalogue, sort: "za" });
    expect(descending).toEqual([...ascending].reverse());
  });

  it("clears every input the search state hides, so dismissing a search really shows the whole catalogue", () => {
    // The regression this pins: `letter` is ignored while a query runs AND its
    // chip stands down, so it is invisible and inert — but it survives in the
    // URL, and the Terms tab's own self-link is one of the things that puts it
    // there. Clearing only `q`/`query`/`run` handed back 6 of 96 entries for
    // `?q=tardive&letter=T` under a control whose accessible name promises the
    // whole catalogue.
    const dismissed = new URLSearchParams("q=tardive&letter=T");
    for (const key of dictionaryClearedQueryKeys) dismissed.delete(key);
    expect(dictionaryCatalogue(parseDictionaryCatalogueParams(dismissed))).toHaveLength(96);

    // Stated directly as well, so a future edit that drops `letter` from the
    // list fails here with the reason rather than only through the count above.
    expect(dictionaryClearedQueryKeys).toContain("letter");
    expect(dictionaryClearedQueryKeys).toContain("run");

    // Facets are deliberately NOT cleared: they stay visible on the band's
    // applied-filter shelf throughout a search, each removable in one tap, so
    // dropping them would discard a choice the reader can still see.
    const withFacet = new URLSearchParams("q=tardive&topic=assessment-and-measurement");
    for (const key of dictionaryClearedQueryKeys) withFacet.delete(key);
    expect(parseDictionaryCatalogueParams(withFacet).topics).toEqual(["assessment-and-measurement"]);
  });

  it("ignores a letter outside A–Z rather than emptying the catalogue", () => {
    expect(parseDictionaryCatalogueParams(new URLSearchParams("letter=AB")).letter).toBe("all");
    expect(parseDictionaryCatalogueParams(new URLSearchParams("letter=4")).letter).toBe("all");
    expect(parseDictionaryCatalogueParams(new URLSearchParams("letter=m")).letter).toBe("M");
  });
});
