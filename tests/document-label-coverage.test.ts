import { describe, expect, it } from "vitest";

import {
  buildDocumentLabelCoverageReport,
  type DocumentLabelCoverageDocument,
  type DocumentLabelCoverageLabel,
} from "../scripts/check-document-label-coverage";

function document(
  overrides: Partial<DocumentLabelCoverageDocument> & Pick<DocumentLabelCoverageDocument, "id">,
): DocumentLabelCoverageDocument {
  return {
    title: overrides.id,
    file_name: `${overrides.id}.pdf`,
    file_type: "application/pdf",
    source_path: null,
    metadata: {},
    ...overrides,
  };
}

function label(
  documentId: string,
  labelValue: string,
  labelType: DocumentLabelCoverageLabel["label_type"],
  overrides: Partial<DocumentLabelCoverageLabel> = {},
): DocumentLabelCoverageLabel {
  return {
    id: `${documentId}-${labelType}-${labelValue}`,
    document_id: documentId,
    label: labelValue,
    label_type: labelType,
    source: "generated",
    confidence: 1,
    ...overrides,
  };
}

function registryMetadata(kind: "service" | "form" | "medication" | "differential") {
  return {
    source_kind: "registry_record",
    registry_record_kind: kind,
    registry_record_id: `${kind}-1`,
    registry_record_slug: `${kind}-slug`,
    publisher: "Clinical KB registry",
    document_status: "current",
    clinical_validation_status: "locally_reviewed",
    clinical_validation_evidence: { status: "locally_reviewed", evidence_type: "registry_governance_record" },
    extraction_quality: "good",
  };
}

describe("document label coverage contracts", () => {
  it("requires site and document type only for physical documents", () => {
    const documents = [
      document({ id: "physical" }),
      document({
        id: "registry",
        file_name: "service-crisis.registry.json",
        file_type: "application/vnd.clinical-kb.registry+json",
        source_path: "registry://service/crisis",
        metadata: registryMetadata("service"),
      }),
    ];
    const labels = [
      label("physical", "fsh", "site"),
      label("physical", "guideline", "document_type"),
      label("registry", "operational-process", "document_intent"),
    ];

    const report = buildDocumentLabelCoverageReport({ documents, labels });
    expect(report.passed).toBe(true);
    expect(report.physical_contract).toMatchObject({ indexed_documents: 1, passed: true });
    expect(report.registry_contract).toMatchObject({ indexed_documents: 1, documents_with_gaps: 0, passed: true });
    expect(report.indexed_without_site).toBe(0);
  });

  it("fails registry identity, governance, smart-v2, and generated-site contract gaps", () => {
    const documents = [
      document({
        id: "registry",
        file_type: "application/vnd.clinical-kb.registry+json",
        source_path: "registry://medication/lithium",
        metadata: {
          ...registryMetadata("medication"),
          clinical_validation_evidence: null,
        },
      }),
    ];
    const labels = [label("registry", "staff-guidance", "document_intent"), label("registry", "fsh", "site")];

    const report = buildDocumentLabelCoverageReport({ documents, labels });
    expect(report.passed).toBe(false);
    expect(report.indexed_without_site).toBe(0);
    expect(report.registry_contract.sample_gaps[0]?.missing_keys).toEqual(
      expect.arrayContaining(["clinical_validation_evidence", "smart_v2_document_intent", "generated_site_label"]),
    );
  });

  it("still fails a physical document without its required labels", () => {
    const report = buildDocumentLabelCoverageReport({ documents: [document({ id: "physical" })], labels: [] });
    expect(report.passed).toBe(false);
    expect(report.physical_contract).toMatchObject({ without_site: 1, without_document_type: 1, passed: false });
  });
});
