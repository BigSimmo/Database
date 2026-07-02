import { describe, expect, it } from "vitest";
import {
  buildDocumentLabelGovernanceReport,
  goldLabelsForDocument,
  missingGoldLabelsForDocument,
  runLabelRelevanceChecks,
} from "@/lib/document-label-governance";
import type { DocumentLabel } from "@/lib/types";

function label(overrides: Partial<DocumentLabel>): DocumentLabel {
  return {
    id: overrides.id ?? `${overrides.label ?? "label"}-id`,
    document_id: overrides.document_id ?? "doc-1",
    label: overrides.label ?? "monitoring",
    label_type: overrides.label_type ?? "topic",
    source: overrides.source ?? "generated",
    confidence: overrides.confidence ?? 0.8,
    metadata: overrides.metadata,
    ...overrides,
  };
}

describe("document label governance", () => {
  it("derives conservative gold labels for high-value clinical documents", () => {
    const labels = goldLabelsForDocument({
      id: "doc-1",
      title: "Lithium monitoring guideline",
      file_name: "lithium.pdf",
      metadata: {},
      labels: [],
      summary: { summary: "Baseline and ongoing lithium blood test monitoring." },
    });

    expect(labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "lithium", label_type: "medication" }),
        expect.objectContaining({ label: "monitor", label_type: "clinical_action" }),
        expect.objectContaining({ label: "contains-monitoring-schedule", label_type: "content_feature" }),
      ]),
    );
  });

  it("reports missing gold labels and label-driven relevance readiness", () => {
    const documents = [
      {
        id: "doc-1",
        title: "Lithium monitoring guideline",
        file_name: "lithium.pdf",
        metadata: {},
        labels: [
          label({ label: "lithium", label_type: "medication" }),
          label({ label: "monitor", label_type: "clinical_action" }),
        ],
      },
      {
        id: "doc-2",
        title: "ECT pathway",
        file_name: "ect.pdf",
        metadata: {},
        labels: [label({ document_id: "doc-2", label: "electroconvulsive therapy", label_type: "topic" })],
      },
    ];

    expect(missingGoldLabelsForDocument(documents[0]).map((item) => item.label)).toContain("medication-instruction");
    expect(runLabelRelevanceChecks(documents).find((check) => check.id === "lithium-monitoring")).toMatchObject({
      passed: true,
      matchingDocumentCount: 1,
    });
  });

  it("builds a combined governance report", () => {
    const report = buildDocumentLabelGovernanceReport(
      [
        {
          id: "doc-1",
          title: "Clozapine monitoring protocol",
          file_name: "clozapine.pdf",
          metadata: {},
          labels: [
            label({ label: "clozapine", label_type: "medication" }),
            label({ label: "monitor", label_type: "clinical_action" }),
            label({ label: "contains-monitoring-schedule", label_type: "content_feature" }),
          ],
        },
      ],
      1,
    );

    expect(report.analytics.documents).toBe(1);
    expect(report.qaSample).toHaveLength(1);
    expect(report.analytics.byTier).toHaveProperty("primary");
  });
});
