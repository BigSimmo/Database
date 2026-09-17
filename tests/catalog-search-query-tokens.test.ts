import { describe, expect, it } from "vitest";

import { fuzzySearchTokenCount, normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";

/**
 * `rankCatalogRecords` tokenizes the query once per search and reuses those tokens
 * for every record and field, instead of re-normalizing the same query string inside
 * each fuzzy comparison. That rewrite is only sound because `normalizeSearchText` is
 * idempotent — the query it receives there has already been normalized once.
 *
 * These tests pin the property the rewrite depends on, and pin that the fuzzy path
 * still scores the way the per-call version did, so a future change to the normalizer
 * that breaks idempotency fails here rather than silently reordering search results.
 */

const IDEMPOTENCY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +./-_,:;()[]'\"éüñÉǺ̈\t\n";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
}

describe("normalizeSearchText", () => {
  it("is idempotent across randomized input", () => {
    const random = seededRandom(20260917);
    const failures: string[] = [];
    for (let i = 0; i < 20_000; i += 1) {
      const length = Math.floor(random() * 30);
      let value = "";
      for (let k = 0; k < length; k += 1)
        value += IDEMPOTENCY_ALPHABET[Math.floor(random() * IDEMPOTENCY_ALPHABET.length)];
      const once = normalizeSearchText(value);
      if (normalizeSearchText(once) !== once) failures.push(JSON.stringify(value));
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("is idempotent on clinical-shaped input", () => {
    const samples = [
      "Lithium 0.5mg",
      "IM/PO",
      "5+5",
      "ECT",
      "Ménière",
      "  spaced   out  ",
      "co-morbid",
      "ADHD/ODD",
      "N-acetylcysteine",
      "25 µg",
      "",
      "   ",
    ];
    for (const sample of samples) {
      const once = normalizeSearchText(sample);
      expect(normalizeSearchText(once), sample).toBe(once);
    }
  });
});

type CatalogueRecord = { id: string; title: string; tag: string; body: string };

const RECORDS: CatalogueRecord[] = [
  { id: "a", title: "clozapine monitoring", tag: "antipsychotic", body: "absolute neutrophil count review schedule" },
  { id: "b", title: "fluoxetine", tag: "ssri", body: "serotonin reuptake inhibitor depression" },
  { id: "c", title: "prednisolone", tag: "steroid", body: "corticosteroid taper" },
  { id: "d", title: "duloxetine", tag: "snri", body: "serotonin noradrenaline reuptake inhibitor" },
  { id: "e", title: "catatonia", tag: "syndrome", body: "lorazepam challenge electroconvulsive therapy" },
];

const OPTIONS = {
  fields: [
    { id: "title", weight: 6, text: (record: CatalogueRecord) => record.title },
    { id: "tag", weight: 3, text: (record: CatalogueRecord) => record.tag },
  ],
  fullText: (record: CatalogueRecord) => `${record.title} ${record.tag} ${record.body}`,
  compactBonus: 3,
  phraseBonus: 4,
  exactValues: (record: CatalogueRecord) => [record.title],
  prefixValues: (record: CatalogueRecord) => [record.title],
  prefixBonus: 2,
};

describe("rankCatalogRecords fuzzy scoring", () => {
  it("still recovers a one-edit typo in a weighted field", () => {
    // "clozepine" is one substitution from "clozapine" and is not a substring of it,
    // so it reaches the typo path rather than the literal-containment shortcut.
    const ranked = rankCatalogRecords(RECORDS, "clozepine", OPTIONS);
    expect(ranked[0]?.record.id).toBe("a");
    expect(ranked[0]?.signals.fuzzy).toBe(1);

    // A transposition recovers too, and still resolves to the intended record.
    expect(rankCatalogRecords(RECORDS, "catatonai", OPTIONS)[0]?.record.id).toBe("e");
  });

  it("keeps distinct long drug names apart", () => {
    // fluoxetine/duloxetine are more than one edit apart and must not cross-match.
    const ranked = rankCatalogRecords(RECORDS, "fluoxetine", OPTIONS);
    expect(ranked[0]?.record.id).toBe("b");
    expect(ranked.map((match) => match.record.id)).not.toContain("d");
  });

  it("scores a pre-normalized query exactly as the raw query", () => {
    // The hoisted tokens come from an already-normalized query; a raw query with
    // punctuation and casing must still rank identically.
    const raw = rankCatalogRecords(RECORDS, "  Clozapine,  MONITORING  ", OPTIONS);
    const normalized = rankCatalogRecords(RECORDS, normalizeSearchText("  Clozapine,  MONITORING  "), OPTIONS);
    expect(JSON.stringify(normalized)).toEqual(JSON.stringify(raw));
  });

  it("agrees with the standalone fuzzy counter it was split from", () => {
    const haystack = "clozapine monitoring";
    // A one-edit typo counts...
    expect(fuzzySearchTokenCount("clozepine", haystack)).toBe(1);
    // ...and normalizing the query first must not change that, which is the property
    // the hoisted-token rewrite relies on.
    expect(fuzzySearchTokenCount(normalizeSearchText("Clozepine"), haystack)).toBe(1);
    // A literal substring is a containment hit, not a typo, so it does not count here.
    expect(fuzzySearchTokenCount("clozapin", haystack)).toBe(0);
    expect(fuzzySearchTokenCount("clozapine", haystack)).toBe(0);
    // A distinct drug name stays more than one edit away.
    expect(fuzzySearchTokenCount("fluoxetine", haystack)).toBe(0);
  });
});
