import { describe, expect, it } from "vitest";
import {
  assessClinicalImageUse,
  cheapImageSkipReason,
  classifiedImageSkipReason,
  isClinicalImageEvidence,
  lightweightPerceptualHash,
} from "../src/lib/image-filtering";

describe("smart image filtering", () => {
  it("skips repeated exact image hashes before captioning", () => {
    const seenHashes = new Set(["abc"]);
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "abc",
        seenHashes,
        image: { sourceKind: "embedded", width: 600, height: 400 },
      }),
    ).toBe("duplicate image");
  });

  it("skips likely header or footer logos", () => {
    expect(
      cheapImageSkipReason({
        bytesLength: 20_000,
        imageHash: "def",
        seenHashes: new Set(),
        image: { sourceKind: "embedded", width: 160, height: 60, bbox: [20, 20, 180, 80] },
      }),
    ).toBe("logo/header/footer placement");
  });

  it("does not skip table crops because they sit near a page header", () => {
    expect(
      cheapImageSkipReason({
        bytesLength: 20_000,
        imageHash: "table",
        seenHashes: new Set(),
        image: { sourceKind: "table_crop", width: 720, height: 180, bbox: [20, 20, 740, 200] },
      }),
    ).toBeNull();
  });

  it("keeps relevant clinical classifications searchable", () => {
    expect(
      classifiedImageSkipReason({
        image_type: "clinical_table",
        searchable: true,
        clinical_relevance_score: 0.9,
        skip_reason: null,
      }),
    ).toBeNull();
  });

  it("classifies authorisation and publication tables as administrative evidence", () => {
    const assessment = assessClinicalImageUse({
      imageType: "clinical_table",
      searchable: true,
      clinicalRelevanceScore: 0.8,
      sourceKind: "table_crop",
      tableText:
        "| Authorised by | Karen Elliott |\n| Authorisation date | 4/11/2024 |\n| Published date | 13/11/2024 |",
    });

    expect(assessment.clinical_use_class).toBe("administrative");
    expect(assessment.searchable).toBe(false);
    expect(assessment.clinical_relevance_score).toBe(0);
  });

  it("classifies version and amendment tables as administrative evidence", () => {
    expect(
      assessClinicalImageUse({
        imageType: "clinical_table",
        searchable: true,
        clinicalRelevanceScore: 0.7,
        sourceKind: "table_crop",
        tableText: "| Version | Effective from | Effective to | Amendment(s) |\n| V5.0 | 13/11/2024 | 13/11/2027 | Link added |",
      }).clinical_use_class,
    ).toBe("administrative");
  });

  it("keeps medication, monitoring, threshold, and workflow tables clinical", () => {
    const assessment = assessClinicalImageUse({
      imageType: "clinical_table",
      searchable: true,
      clinicalRelevanceScore: 0.6,
      sourceKind: "table_crop",
      tableText:
        "| Score | Patient state | Management |\n| 5 | Highly aroused | Oral lorazepam 1 mg and monitor observations for escalation risk |",
    });

    expect(assessment.clinical_use_class).toBe("clinical_evidence");
    expect(assessment.searchable).toBe(true);
  });

  it("treats role tables as clinical only when responsibilities affect patient care", () => {
    expect(
      assessClinicalImageUse({
        imageType: "clinical_table",
        sourceKind: "table_crop",
        tableText: "| Role | Responsibility |\n| Service Director | Overall responsibility for policy governance and compliance |",
      }).clinical_use_class,
    ).not.toBe("clinical_evidence");

    expect(
      assessClinicalImageUse({
        imageType: "clinical_table",
        sourceKind: "table_crop",
        tableText:
          "| Role | Responsibility |\n| Clozapine nurse | Monitor patient observations and escalate abnormal blood results |",
      }).clinical_use_class,
    ).toBe("clinical_evidence");
  });

  it("does not treat site and applicability cover tables as clinical evidence", () => {
    expect(
      isClinicalImageEvidence({
        image_type: "clinical_table",
        searchable: true,
        source_kind: "table_crop",
        metadata: {
          table_text: "| Site | Operational Area | Applicable to |\n| Armadale | Mental Health | Medical staff |",
        },
      }),
    ).toBe(false);
  });

  it("skips decorative classifications", () => {
    expect(
      classifiedImageSkipReason({
        image_type: "logo_decorative",
        searchable: false,
        clinical_relevance_score: 0,
        skip_reason: null,
      }),
    ).toBe("logo or decorative mark");
  });

  it("builds a stable lightweight perceptual hash key", () => {
    expect(lightweightPerceptualHash("1234567890abcdef", 100, 200)).toBe("1234567890abcdef:100:200");
  });
});
