import { describe, expect, it } from "vitest";

import {
  browseDictionary,
  dictionaryAliasSenses,
  dictionaryBrowseLetter,
  dictionaryCatalogueIssues,
  dictionaryCompareHref,
  dictionaryComparisonPair,
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
    // The browse header derives its selectable letters from
    // `dictionaryBrowseLetter` and offers the rest inert. If the two ever
    // disagreed the index would strand the reader on an empty page, which is the
    // failure this pins: for both views, a letter the helper reports must return
    // results, and a letter it does not report must return none.
    for (const view of ["az", "abbreviations"] as const) {
      const all = browseDictionary({ view, letter: "all", topics: [], kinds: [], sort: "az" });
      expect(all.length).toBeGreaterThan(0);
      const available = new Set(all.map(dictionaryBrowseLetter));
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const hits = browseDictionary({ view, letter, topics: [], kinds: [], sort: "az" });
        expect(hits.length > 0).toBe(available.has(letter));
      }
      // Every hit accounted for exactly once across the per-letter partition.
      const partitioned = [...available].reduce(
        (total, letter) => total + browseDictionary({ view, letter, topics: [], kinds: [], sort: "az" }).length,
        0,
      );
      expect(partitioned).toBe(all.length);
    }
  });
});
