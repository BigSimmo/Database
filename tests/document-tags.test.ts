import { describe, expect, it } from "vitest";
import {
  buildSmartDocumentTagFacets,
  buildSmartDocumentTags,
  filterDocumentsBySmartTagFacets,
  formatDocumentLabelDisplay,
  normalizeDocumentLabelForStorage,
  reviewDocumentTagQuality,
  tagSearchText,
} from "@/lib/document-tags";
import type { DocumentLabel } from "@/lib/types";

function label(overrides: Partial<DocumentLabel>): DocumentLabel {
  return {
    id: overrides.id ?? `${overrides.label ?? "label"}-id`,
    document_id: overrides.document_id ?? "doc-1",
    label: overrides.label ?? "monitoring",
    label_type: overrides.label_type ?? "topic",
    source: overrides.source ?? "generated",
    confidence: overrides.confidence ?? 0.8,
    ...overrides,
  };
}

describe("smart document tags", () => {
  it("cleans generated labels before storage", () => {
    expect(
      normalizeDocumentLabelForStorage({
        label: "Clozapine Monitoring!!",
        label_type: "topic",
        confidence: 0.91,
        source: "generated",
      }),
    ).toMatchObject({ label: "clozapine monitoring", label_type: "topic", confidence: 0.91 });

    expect(
      normalizeDocumentLabelForStorage({
        label: "Document control",
        label_type: "topic",
        confidence: 0.95,
        source: "generated",
      }),
    ).toBeNull();

    expect(
      normalizeDocumentLabelForStorage({
        label: "Policy",
        label_type: "document_type",
        confidence: 0.91,
        source: "generated",
      }),
    ).toMatchObject({ label: "policy", label_type: "document_type" });
  });

  it("deduplicates near-equivalent tags and preserves useful manual tags", () => {
    const tags = buildSmartDocumentTags(
      [
        label({ label: "risk and safety", label_type: "risk", confidence: 0.72 }),
        label({ label: "Risk & Safety", label_type: "risk", confidence: 0.7 }),
        label({ label: "Document", label_type: "document_type", confidence: 0.9 }),
        label({ label: "local service term", label_type: "custom", source: "manual", confidence: 0.2 }),
      ],
      { includeManualGroup: true },
    );

    expect(tags.map((tag) => tag.label)).toEqual(["Risk Escalation", "Local Service Term"]);
    expect(tags.at(-1)).toMatchObject({ group: "Manual", source: "manual" });
  });

  it("prioritizes tags that match the query", () => {
    const tags = buildSmartDocumentTags(
      [
        label({ label: "metabolic monitoring", label_type: "topic", confidence: 0.8 }),
        label({ label: "clozapine", label_type: "medication", confidence: 0.86 }),
      ],
      { query: "monitoring requirements" },
    );

    expect(tags[0]).toMatchObject({ label: "Metabolic Monitoring", queryMatched: true });
  });

  it("produces searchable text for dashboard document filtering", () => {
    expect(
      tagSearchText({
        labels: [label({ label: "long-acting injectables", label_type: "medication", confidence: 0.88 })],
      }).toLowerCase(),
    ).toContain("long acting injectable medication");
  });

  it("canonicalizes local clinical aliases and common misspellings", () => {
    expect(
      normalizeDocumentLabelForStorage({
        label: "FSH",
        label_type: "site",
        confidence: 0.9,
        source: "generated",
      }),
    ).toMatchObject({ label: "fiona stanley hospital", label_type: "site" });
    expect(
      normalizeDocumentLabelForStorage({
        label: "LAI",
        label_type: "medication",
        confidence: 0.9,
        source: "generated",
      }),
    ).toMatchObject({ label: "long acting injectable medication" });
    expect(
      normalizeDocumentLabelForStorage({
        label: "clozapine monitering",
        label_type: "workflow",
        confidence: 0.9,
        source: "generated",
      }),
    ).toMatchObject({ label: "clozapine monitoring" });
    expect(buildSmartDocumentTags([label({ label: "HoNOS", label_type: "topic" })])[0].label).toBe(
      "HoNOS Rating Scale",
    );
    expect(
      buildSmartDocumentTags([label({ label: "electroconvulsive therapy", label_type: "topic" })])[0],
    ).toMatchObject({
      searchText: "electroconvulsive-therapy",
      label: "Electroconvulsive therapy",
    });
    expect(
      buildSmartDocumentTags([label({ label: "substance-use-alcohol-and-drugs", label_type: "topic" })])[0].label,
    ).toBe("Substance use, alcohol and drugs");
  });

  it("separates stable machine labels from polished display labels and visibility tiers", () => {
    expect(formatDocumentLabelDisplay("contains_quick-reference", "content_feature")).toBe(
      "Contains quick reference",
    );
    expect(formatDocumentLabelDisplay("post-discharge-follow-up", "care_phase")).toBe("Post-discharge follow-up");
    expect(formatDocumentLabelDisplay("fiona stanley hospital", "site")).toBe("FSH");

    const tags = buildSmartDocumentTags([
      label({ label: "clinical-risk", label_type: "risk", confidence: 0.9 }),
      label({ label: "lithium", label_type: "medication", confidence: 0.9 }),
    ]);
    expect(tags.find((tag) => tag.searchText === "clinical risk")).toMatchObject({ tier: "ranking" });
    expect(tags.find((tag) => tag.searchText === "lithium")).toMatchObject({ tier: "primary" });

    const facets = buildSmartDocumentTagFacets([{ labels: tags }]);
    expect(facets.flatMap((group) => group.facets).map((facet) => facet.searchText)).not.toContain("clinical risk");
  });

  it("builds grouped tag facets with document counts", () => {
    const facets = buildSmartDocumentTagFacets([
      {
        labels: [
          label({ label: "clozapine", label_type: "medication", confidence: 0.9 }),
          label({ label: "metabolic monitoring", label_type: "workflow", confidence: 0.8 }),
        ],
      },
      {
        labels: [
          label({ document_id: "doc-2", label: "Fiona Stanley Hospital", label_type: "site", confidence: 0.9 }),
          label({ document_id: "doc-2", label: "clozapine", label_type: "medication", confidence: 0.85 }),
          label({ document_id: "doc-2", label: "inpatient", label_type: "setting", confidence: 0.75 }),
        ],
      },
    ]);

    expect(facets.find((group) => group.group === "Medication")?.facets[0]).toMatchObject({
      label: "Clozapine",
      count: 2,
    });
    expect(facets.map((group) => group.group)).toContain("Workflow");
    expect(facets.map((group) => group.group)).toContain("Site");
    expect(facets.map((group) => group.group)).not.toContain("Topic");
  });

  it("filters documents by selected smart tag facet keys", () => {
    const clozapine = label({ label: "clozapine", label_type: "medication", confidence: 0.9 });
    const risk = label({ label: "risk escalation", label_type: "risk", confidence: 0.9 });
    const documents = [
      { id: "doc-1", labels: [clozapine, risk] },
      { id: "doc-2", labels: [label({ document_id: "doc-2", label: "lithium", label_type: "medication" })] },
    ];
    const selectedKey = buildSmartDocumentTags([clozapine], { includeManualGroup: false })[0].key;

    expect(filterDocumentsBySmartTagFacets(documents, [selectedKey]).map((document) => document.id)).toEqual(["doc-1"]);
  });

  it("reviews noisy, duplicate, low-confidence, and overused tag quality issues", () => {
    const documents = [
      {
        id: "doc-1",
        title: "Clozapine guideline",
        labels: [
          label({ id: "a", label: "clinical guideline", label_type: "document_type", confidence: 0.9 }),
          label({ id: "b", label: "LAI", label_type: "medication", confidence: 0.9 }),
          label({ id: "c", label: "long acting injectables", label_type: "medication", confidence: 0.8 }),
          label({ id: "d", label: "lithium", label_type: "medication", confidence: 0.3 }),
        ],
      },
      {
        id: "doc-2",
        title: "Depot procedure",
        labels: [label({ document_id: "doc-2", label: "LAI", label_type: "medication", confidence: 0.9 })],
      },
    ];

    const issues = reviewDocumentTagQuality(documents, { overusedThreshold: 2 });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "noisy", label: "clinical guideline" }),
        expect.objectContaining({ kind: "duplicate", canonicalLabel: "long acting injectable medication" }),
        expect.objectContaining({ kind: "low_confidence", canonicalLabel: "lithium" }),
        expect.objectContaining({ kind: "overused", canonicalLabel: "long acting injectable medication" }),
      ]),
    );
  });
});
