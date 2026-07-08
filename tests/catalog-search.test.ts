import { describe, expect, it } from "vitest";
import { compactSearchText, normalizeSearchText, rankCatalogRecords } from "../src/lib/catalog-search";

type Item = { title: string; slug: string; tags: string[]; body: string };

const items: Item[] = [
  { title: "Clozapine Monitoring", slug: "clozapine-monitoring", tags: ["antipsychotic"], body: "ANC FBC thresholds" },
  { title: "Lithium Levels", slug: "lithium-levels", tags: ["mood stabiliser"], body: "Serum level monitoring" },
  { title: "Transfer Checklist", slug: "transfer-checklist", tags: ["transport"], body: "Receiving service details" },
];

function rank(query: string, overrides: Partial<Parameters<typeof rankCatalogRecords<Item>>[2]> = {}) {
  return rankCatalogRecords(items, query, {
    fields: [
      { id: "title", weight: 6, text: (item) => normalizeSearchText(`${item.title} ${item.slug}`) },
      { id: "tags", weight: 3, text: (item) => normalizeSearchText(item.tags.join(" ")) },
    ],
    fullText: (item) => normalizeSearchText(`${item.title} ${item.tags.join(" ")} ${item.body}`),
    ...overrides,
  });
}

describe("normalizeSearchText (shared)", () => {
  it("keeps dose-string characters that the retired per-domain normalizers disagreed on", () => {
    expect(normalizeSearchText("0.5mg IM/PO 5+5 co-located")).toBe("0.5mg im/po 5+5 co-located");
  });

  it("strips diacritics and collapses punctuation to single spaces", () => {
    expect(normalizeSearchText("Sérum;  Lévels!")).toBe("serum levels");
  });

  it("compacts whitespace for compact-query matching", () => {
    expect(compactSearchText("clozapine monitoring")).toBe("clozapinemonitoring");
  });
});

describe("rankCatalogRecords", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(rank("")).toEqual([]);
    expect(rank("   ")).toEqual([]);
  });

  it("weights field matches by their configured weight plus the content weight", () => {
    const [top] = rank("clozapine");
    expect(top.record.slug).toBe("clozapine-monitoring");
    // title (6) + content (2) + whole-query phrase (4) — a single-term query IS its own
    // phrase, matching the historical per-domain rankers.
    expect(top.score).toBe(12);
    expect(top.signals.fields.title).toBe(1);
    expect(top.signals.content).toBe(1);
    expect(top.signals.phrase).toBe(true);
  });

  it("drops records with no matching signal", () => {
    const results = rank("clozapine");
    expect(results.some((match) => match.record.slug === "lithium-levels")).toBe(false);
  });

  it("applies the whole-phrase bonus on top of term matches", () => {
    const [top] = rank("clozapine monitoring");
    // 2 title terms (12) + 2 content terms (4) + phrase (4).
    expect(top.score).toBe(20);
    expect(top.signals.phrase).toBe(true);
  });

  it("grants the exact bonus only on strict equality with a configured exact value", () => {
    const options = {
      exactValues: (item: Item) => [normalizeSearchText(item.title), normalizeSearchText(item.slug)],
      exactBonus: 10,
    };
    const exact = rank("clozapine monitoring", options)[0];
    const partial = rank("clozapine", options)[0];
    expect(exact.signals.exact).toBe(true);
    expect(partial.signals.exact).toBe(false);
    expect(exact.score).toBe(30);
  });

  it("grants the compact bonus when the de-spaced query appears in the compacted haystack", () => {
    const [top] = rank("clozapinemonitoring", { compactBonus: 6 });
    expect(top.signals.compact).toBe(true);
    // The de-spaced term matches nothing term-wise; only the compact bonus scores it,
    // which is exactly how a run-together query survived in the historical rankers.
    expect(top.score).toBe(6);
  });

  it("adds the broad-catalogue bonus to every record when a broad term is present", () => {
    const results = rank("transport checklist", { broadTerms: ["transport"], broadBonus: 1 });
    expect(results[0].record.slug).toBe("transfer-checklist");
    for (const match of results) expect(match.signals.broad).toBe(true);
  });

  it("expands query terms through the expandTokens hook", () => {
    const results = rank("cloz", {
      expandTokens: (terms) => (terms.includes("cloz") ? [...terms, "clozapine"] : terms),
    });
    expect(results[0].record.slug).toBe("clozapine-monitoring");
  });

  it("breaks score ties by input order unless a tieBreak is supplied", () => {
    const tied: Item[] = [
      { title: "Zeta Monitoring", slug: "zeta", tags: [], body: "" },
      { title: "Alpha Monitoring", slug: "alpha", tags: [], body: "" },
    ];
    const byInput = rankCatalogRecords(tied, "monitoring", {
      fields: [{ id: "title", weight: 6, text: (item) => normalizeSearchText(item.title) }],
      fullText: (item) => normalizeSearchText(item.title),
    });
    expect(byInput.map((match) => match.record.slug)).toEqual(["zeta", "alpha"]);

    const byTitle = rankCatalogRecords(tied, "monitoring", {
      fields: [{ id: "title", weight: 6, text: (item) => normalizeSearchText(item.title) }],
      fullText: (item) => normalizeSearchText(item.title),
      tieBreak: (left, right) => left.title.localeCompare(right.title),
    });
    expect(byTitle.map((match) => match.record.slug)).toEqual(["alpha", "zeta"]);
  });

  it("applies the limit after ranking", () => {
    const results = rank("monitoring checklist", { limit: 1 });
    expect(results).toHaveLength(1);
  });
});
