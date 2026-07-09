import { describe, expect, it } from "vitest";
import {
  buildDocumentBreakdown,
  buildVisualEvidence,
  dedupeSearchResults,
  detectConflictsOrGaps,
  diversifySearchResults,
  extractQuoteCards,
  reconcileQuoteCards,
  selectBestSourceRecommendation,
} from "../src/lib/evidence";
import { documentCitationHref } from "../src/lib/citations";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "chunk-a",
    document_id: "doc-a",
    title: "Synthetic source",
    file_name: "source.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content:
      "Baseline monitoring is required. Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
    image_ids: [],
    similarity: 0.9,
    images: [],
    ...overrides,
  };
}

describe("evidence helpers", () => {
  it("extracts short exact quote text from retrieved chunks", () => {
    const quotes = extractQuoteCards([result({})], "What lithium toxicity symptoms need review?");

    expect(quotes).toHaveLength(1);
    expect(quotes[0].quote).toContain("vomiting");
    expect(quotes[0].page_number).toBe(1);
  });

  it("selects direct cease or discontinue wording for clozapine withhold threshold questions", () => {
    const quotes = extractQuoteCards(
      [
        result({
          id: "clozapine-threshold",
          title: "Clozapine Prescribing",
          content: `Clozapine Prescribing, Administering and Monitoring

State WBC Neutrophil Outcome
Green >= 3.5 >= 2 Continue with regular blood tests
Amber >=3.0 and <3.5 >= 1.5 and <2.0 Twice weekly blood tests required
Red <3 < 1.5 Cease therapy immediately

If the consumer's blood results return in the red range, Clozapine therapy must be discontinued immediately.
The haematologist can assist with altering WCC and ANC thresholds for specific consumers.`,
        }),
      ],
      "What FBC threshold should withhold clozapine?",
    );

    expect(quotes[0].quote.toLowerCase()).toMatch(/cease|discontinued/);
    expect(quotes[0].quote).toContain("State WBC Neutrophil Outcome");
    expect(quotes[0].quote).toContain("Red <3 < 1.5 Cease therapy immediately");
    expect(quotes[0].quote.toLowerCase()).not.toContain("haematologist can assist");
  });

  it("uses image descriptions as quotable indexed evidence", () => {
    const quotes = extractQuoteCards(
      [
        result({
          id: "image-chunk",
          content:
            "[[IMAGE_DATA_START]] Image ID: img-1; Description: Synthetic table showing FBC/ANC, myocarditis, metabolic review, and constipation planning. [[IMAGE_DATA_END]]",
          image_ids: ["img-1"],
        }),
      ],
      "What monitoring items are shown in the table image?",
    );

    expect(quotes[0].quote).toContain("FBC/ANC");
    expect(quotes[0].quote).not.toContain("[[IMAGE_DATA_START]]");
  });

  it("groups sources by document and counts quote cards", () => {
    const sources = [
      result({ id: "a1", document_id: "doc-a", similarity: 0.81 }),
      result({ id: "a2", document_id: "doc-a", page_number: 2, similarity: 0.91 }),
      result({ id: "b1", document_id: "doc-b", title: "Second source", similarity: 0.75 }),
    ];
    const quotes = extractQuoteCards(sources, "monitoring escalation", 3);
    const breakdown = buildDocumentBreakdown(sources, quotes);

    expect(breakdown[0].document_id).toBe("doc-a");
    expect(breakdown[0].pages).toEqual([1, 2]);
    expect(breakdown[0].quote_count).toBeGreaterThan(0);
  });

  it("deduplicates near-identical chunks on the same page", () => {
    const sources = [result({ id: "a1" }), result({ id: "a2" }), result({ id: "a3", page_number: 2 })];

    expect(dedupeSearchResults(sources).map((source) => source.id)).toEqual(["a1", "a3"]);
  });

  it("caps document dominance when diversifying search results", () => {
    const sources = [
      result({ id: "a1", document_id: "doc-a", similarity: 0.98 }),
      result({ id: "a2", document_id: "doc-a", page_number: 2, content: "Second unique A source.", similarity: 0.97 }),
      result({ id: "a3", document_id: "doc-a", page_number: 3, content: "Third unique A source.", similarity: 0.96 }),
      result({ id: "b1", document_id: "doc-b", title: "Second source", content: "Unique B source.", similarity: 0.75 }),
    ];

    const diversified = diversifySearchResults(sources, 3, 2);

    expect(diversified.map((source) => source.id)).toContain("b1");
    expect(diversified.filter((source) => source.document_id === "doc-a")).toHaveLength(2);
  });

  it("can preserve upstream clinical ranking while capping document dominance", () => {
    const sources = [
      result({ id: "ranked-lower-hybrid", document_id: "doc-a", hybrid_score: 0.6, similarity: 0.6 }),
      result({ id: "ranked-higher-hybrid", document_id: "doc-b", hybrid_score: 0.9, similarity: 0.9 }),
    ];

    expect(diversifySearchResults(sources, 2, 4, true).map((source) => source.id)).toEqual([
      "ranked-lower-hybrid",
      "ranked-higher-hybrid",
    ]);
  });

  it("uses stable tie-breaks for equal-scored diversified results", () => {
    const sources = [
      result({ id: "z-chunk", document_id: "doc-z", hybrid_score: 0.7, similarity: 0.7 }),
      result({ id: "a-chunk", document_id: "doc-a", hybrid_score: 0.7, similarity: 0.7 }),
      result({ id: "m-chunk", document_id: "doc-m", hybrid_score: 0.7, similarity: 0.7 }),
    ];

    expect(diversifySearchResults(sources, 3).map((source) => source.id)).toEqual(["a-chunk", "m-chunk", "z-chunk"]);
  });

  it("encodes document ids in citation links", () => {
    expect(
      documentCitationHref({
        chunk_id: "chunk/with space",
        document_id: "doc/with space",
        title: "Source",
        file_name: "source.pdf",
        page_number: 3,
        chunk_index: 0,
      }),
    ).toBe("/documents/doc%2Fwith%20space?page=3&chunk=chunk%2Fwith+space");
  });

  it("falls back to locally extracted exact quotes when proposed quotes are not exact", () => {
    const sources = [result({ id: "a1" })];
    const quotes = reconcileQuoteCards(
      [
        {
          chunk_id: "a1",
          document_id: "doc-a",
          title: "Synthetic source",
          file_name: "source.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Monitoring",
          quote: "This wording is not present in the source.",
        },
      ],
      sources,
      "vomiting dehydration",
    );

    expect(quotes[0].quote).toContain("vomiting");
  });

  it("selects the best source by hybrid score before similarity", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "similarity-winner", similarity: 0.95, hybrid_score: 0.7 }),
      result({ id: "hybrid-winner", document_id: "doc-b", similarity: 0.82, hybrid_score: 0.91 }),
    ]);

    expect(recommendation?.chunk_id).toBe("hybrid-winner");
    expect(recommendation?.viewer_href).toBe("/documents/doc-b?page=1&chunk=hybrid-winner");
  });

  it("uses similarity as a tie-break for best source recommendations", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "lower-similarity", similarity: 0.72, hybrid_score: 0.8 }),
      result({ id: "higher-similarity", similarity: 0.88, hybrid_score: 0.8 }),
    ]);

    expect(recommendation?.chunk_id).toBe("higher-similarity");
  });

  it("falls back to similarity as the best-source score when hybrid score is absent", () => {
    const recommendation = selectBestSourceRecommendation([
      result({ id: "weaker-source", similarity: 0.71 }),
      result({ id: "stronger-source", document_id: "doc-strong", similarity: 0.89 }),
    ]);

    expect(recommendation?.chunk_id).toBe("stronger-source");
    expect(recommendation?.score).toBe(0.89);
  });

  it("prefers exact quote cards from the same source chunk", () => {
    const source = result({ id: "quoted-source" });
    const recommendation = selectBestSourceRecommendation(
      [source],
      [
        {
          chunk_id: "quoted-source",
          document_id: "doc-a",
          title: "Synthetic source",
          file_name: "source.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Monitoring",
          quote: "Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
        },
      ],
    );

    expect(recommendation?.quote).toContain("Escalate review");
    expect(recommendation?.snippet).toContain("Escalate review");
  });

  it("does not recommend a best source without retrieved sources", () => {
    expect(selectBestSourceRecommendation([])).toBeNull();
  });

  it("builds visual evidence cards only from indexed source images", () => {
    const cards = buildVisualEvidence([
      result({
        id: "image-source",
        document_id: "doc-image",
        title: "Image source",
        file_name: "image-source.pdf",
        image_ids: ["img-1"],
        images: [
          {
            id: "img-1",
            page_number: 3,
            storage_path: "private/path/image.png",
            caption: "A source diagram extracted from the indexed PDF.",
            searchable: true,
            image_type: "clinical_table",
            source_kind: "table_crop",
            tableLabel: "Table 1",
            tableTitle: "Agitation and arousal rating scale",
            tableRole: "clinical",
            clinicalUseClass: "clinical_evidence",
            accessibleTableMarkdown: "| Score | Management |\n| --- | --- |\n| 0 | Monitor observations |",
            tableRows: [
              ["Score", "Management"],
              ["0", "Monitor observations"],
            ],
            tableColumns: ["Score", "Management"],
            tableTextSnippet: "Score 0 | Asleep or unconscious",
          },
        ],
      }),
      result({ id: "text-source", document_id: "doc-text" }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0].image_id).toBe("img-1");
    expect(cards[0].signed_url_endpoint).toBe("/api/images/img-1/signed-url");
    expect(cards[0].viewer_href).toContain("page=3");
    expect(cards[0].tableLabel).toBe("Table 1");
    expect(cards[0].tableTitle).toContain("Agitation");
    expect(cards[0].tableRole).toBe("clinical");
    expect(cards[0].clinicalUseClass).toBe("clinical_evidence");
    expect(cards[0].accessibleTableMarkdown).toContain("Score");
    expect(cards[0].tableRows?.[1]?.[1]).toContain("Monitor");
    expect(cards[0]).not.toHaveProperty("storage_path");
  });

  it("excludes administrative tables from visual evidence cards", () => {
    const cards = buildVisualEvidence([
      result({
        id: "admin-image-source",
        images: [
          {
            id: "img-admin",
            page_number: 3,
            storage_path: "private/path/admin.png",
            caption: "Authorisation and publication table.",
            searchable: true,
            image_type: "clinical_table",
            source_kind: "table_crop",
            tableRole: "admin",
            clinicalUseClass: "administrative",
            tableTextSnippet: "Authorised by | Authorisation date | Published date",
            metadata: {
              clinical_use_class: "administrative",
              table_role: "admin",
              table_text: "Authorised by | Authorisation date | Published date",
            },
          },
        ],
      }),
    ]);

    expect(cards).toEqual([]);
  });
});

describe("detectConflictsOrGaps — cross-source withholding-threshold disagreement (threat-model #10 / INJ-10)", () => {
  const conflicts = (results: SearchResult[]) =>
    detectConflictsOrGaps(results).filter((gap) => gap.type === "conflict");

  it("flags two documents that give different ANC withholding thresholds", () => {
    const results = [
      result({
        id: "real",
        document_id: "doc-real",
        content: "Withhold clozapine if the ANC falls below 1.5 ×10⁹/L and arrange urgent review.",
      }),
      result({
        id: "poisoned",
        document_id: "doc-poison",
        title: "Local ward note",
        content: "Withhold clozapine only if ANC < 0.2 ×10⁹/L; otherwise continue as normal.",
      }),
    ];

    const found = conflicts(results);
    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/ANC/);
    expect(found[0].message).toMatch(/0\.2 vs 1\.5/);
    expect(found[0].source_chunk_ids).toEqual(expect.arrayContaining(["real", "poisoned"]));
  });

  it("also detects the disagreement when one side comes from a structured table fact", () => {
    const results = [
      result({
        id: "table-doc",
        document_id: "doc-table",
        content: "See the monitoring table.",
        table_facts: [
          {
            id: "tf-1",
            document_id: "doc-table",
            source_chunk_id: "table-doc",
            source_image_id: null,
            page_number: 1,
            table_title: "Clozapine monitoring",
            row_label: "Red",
            clinical_parameter: "ANC",
            threshold_value: "0.2",
            action: "Cease clozapine therapy",
          },
        ],
      }),
      result({
        id: "prose-doc",
        document_id: "doc-prose",
        content: "Withhold clozapine if the ANC falls below 1.5 ×10⁹/L.",
      }),
    ];

    expect(conflicts(results)).toHaveLength(1);
  });

  it("does not flag agreeing sources or legitimate red/amber monitoring bands (false-positive guards)", () => {
    // Two documents that agree on the threshold: no conflict.
    const agreeing = [
      result({ id: "a", document_id: "doc-a", content: "Withhold clozapine if ANC < 1.5 ×10⁹/L." }),
      result({ id: "b", document_id: "doc-b", content: "Cease clozapine when ANC drops below 1.5 ×10⁹/L." }),
    ];
    expect(conflicts(agreeing)).toEqual([]);

    // A single document listing red (cease) and amber (continue monitoring)
    // bands is not a cross-source disagreement — the amber band is not a
    // withholding action, and it is one document.
    const bandedSingleDoc = [
      result({
        id: "banded",
        document_id: "doc-banded",
        content:
          "Red: cease clozapine immediately if ANC < 0.5 ×10⁹/L. Amber: continue clozapine with twice-weekly monitoring if the ANC is 0.5 to 1.5 ×10⁹/L.",
      }),
    ];
    expect(conflicts(bandedSingleDoc)).toEqual([]);
  });
});
