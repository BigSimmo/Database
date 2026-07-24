import { describe, expect, it } from "vitest";
import {
  assessClinicalImageUse,
  cheapImageSkipReason,
  classifiedImageSkipReason,
  isClinicalImageEvidence,
  imagePlacementDedupeKey,
  lightweightPerceptualHash,
  normalizeImageBbox,
  partitionViewerImages,
} from "../src/lib/image-filtering";

describe("smart image filtering", () => {
  it("skips repeated exact image hashes before captioning", () => {
    const image = {
      sourceKind: "embedded" as const,
      width: 600,
      height: 400,
      pageNumber: 1,
      bbox: [10, 20, 610, 420] as [number, number, number, number],
    };
    const placementKey = imagePlacementDedupeKey({ imageHash: "abc", image });
    expect(placementKey).toBeTruthy();
    const seenHashes = new Set([placementKey!]);
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "abc",
        seenHashes,
        image,
      }),
    ).toBe("duplicate image");
  });

  it("does not drop an exact-byte clinical image from a different page placement", () => {
    const firstImage = {
      sourceKind: "table_crop" as const,
      width: 600,
      height: 400,
      pageNumber: 1,
      bbox: [10, 20, 610, 420] as [number, number, number, number],
    };
    const secondImage = { ...firstImage, pageNumber: 2 };
    const placementKey = imagePlacementDedupeKey({ imageHash: "same-bytes", image: firstImage });
    expect(placementKey).toBeTruthy();
    const seenHashes = new Set([placementKey!]);

    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "same-bytes",
        seenHashes,
        image: secondImage,
      }),
    ).toBeNull();
  });

  it("does not collapse missing or malformed bboxes into one shared de-dupe key", () => {
    const base = {
      sourceKind: "embedded" as const,
      width: 600,
      height: 400,
      pageNumber: 1,
    };
    const missingBbox = { ...base, bbox: null as unknown as [number, number, number, number] };
    const malformedBbox = {
      ...base,
      bbox: { x0: 10, y0: 20, x1: 610, y1: 420 } as unknown as [number, number, number, number],
    };

    expect(imagePlacementDedupeKey({ imageHash: "same-bytes", image: missingBbox })).toBeNull();
    expect(imagePlacementDedupeKey({ imageHash: "same-bytes", image: malformedBbox })).toBeNull();

    const seenHashes = new Set<string>();
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "same-bytes",
        seenHashes,
        image: missingBbox,
      }),
    ).toBeNull();
    // Even if a caller mistakenly records a sentinel, unknown placements must not de-dupe.
    seenHashes.add("same-bytes|embedded|1|bbox:null");
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "same-bytes",
        seenHashes,
        image: malformedBbox,
      }),
    ).toBeNull();
  });

  it("still de-dupes true identical placements when bbox coordinates match", () => {
    const image = {
      sourceKind: "table_crop" as const,
      width: 600,
      height: 400,
      pageNumber: 3,
      bbox: [12.345, 20.001, 610.004, 420.009] as [number, number, number, number],
    };
    const samePlacement = {
      ...image,
      // Rounding-equivalent coords must share the placement key.
      bbox: [12.35, 20, 610, 420.01] as [number, number, number, number],
    };
    const placementKey = imagePlacementDedupeKey({ imageHash: "table-bytes", image });
    expect(placementKey).toBe(imagePlacementDedupeKey({ imageHash: "table-bytes", image: samePlacement }));
    expect(
      cheapImageSkipReason({
        bytesLength: 80_000,
        imageHash: "table-bytes",
        seenHashes: new Set([placementKey!]),
        image: samePlacement,
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

  it("ignores object-shaped bbox jsonb instead of crashing", () => {
    expect(
      cheapImageSkipReason({
        bytesLength: 20_000,
        imageHash: "obj",
        seenHashes: new Set(),
        image: {
          sourceKind: "embedded",
          width: 600,
          height: 400,
          bbox: { x0: 20, y0: 20, x1: 180, y1: 80 } as unknown as [number, number, number, number],
        },
      }),
    ).toBeNull();
  });

  it("normalizes bbox jsonb to a four-number tuple or null", () => {
    expect(normalizeImageBbox([20, 20, 180, 80])).toEqual([20, 20, 180, 80]);
    expect(normalizeImageBbox(["20", "20", "180", "80"])).toEqual([20, 20, 180, 80]);
    expect(normalizeImageBbox({ x0: 20, y0: 20, x1: 180, y1: 80 })).toBeNull();
    expect(normalizeImageBbox([20, 20, 180])).toBeNull();
    expect(normalizeImageBbox([20, 20, 180, "wide"])).toBeNull();
    expect(normalizeImageBbox([20, 20, 180, Number.NaN])).toBeNull();
    expect(normalizeImageBbox("20,20,180,80")).toBeNull();
    expect(normalizeImageBbox(null)).toBeNull();
    // Values that Number(...) would silently coerce to 0 must not become coordinates.
    expect(normalizeImageBbox([null, 20, 180, 80])).toBeNull();
    expect(normalizeImageBbox(["", 20, 180, 80])).toBeNull();
    expect(normalizeImageBbox([false, 20, 180, 80])).toBeNull();
    expect(normalizeImageBbox([true, 20, 180, 80])).toBeNull();
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
        tableText:
          "| Version | Effective from | Effective to | Amendment(s) |\n| V5.0 | 13/11/2024 | 13/11/2027 | Link added |",
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

  it("uses dimensions in clinical-use assessment for small low-signal visuals", () => {
    const assessment = assessClinicalImageUse({
      imageType: "unclear",
      searchable: true,
      clinicalRelevanceScore: 0.7,
      sourceKind: "embedded",
      caption: "Small divider graphic",
      width: 80,
      height: 64,
    });

    expect(assessment.clinical_use_class).toBe("decorative_or_empty");
    expect(assessment.searchable).toBe(false);
    expect(assessment.clinical_use_reason).toBe("small low-signal visual");
  });

  it("treats role tables as clinical only when responsibilities affect patient care", () => {
    expect(
      assessClinicalImageUse({
        imageType: "clinical_table",
        sourceKind: "table_crop",
        tableText:
          "| Role | Responsibility |\n| Service Director | Overall responsibility for policy governance and compliance |",
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
    // M12 (audit 2026-07-01): ph2 digest — 16 hex threshold bits + 32 hex
    // quantized-level bits; ph1's 4-hex space collided across distinct
    // same-dimension clinical tables.
    expect(lightweightPerceptualHash("1234567890abcdef", 100, 200)).toMatch(/^ph2:100x200:[0-9a-f]{48}$/);
  });

  it("groups identical sampled image bytes but separates different bytes", () => {
    const bytes = new Uint8Array([1, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(lightweightPerceptualHash(bytes, 100, 200)).toBe(lightweightPerceptualHash(bytes, 100, 200));
    expect(lightweightPerceptualHash(bytes, 100, 200)).not.toBe(
      lightweightPerceptualHash(new Uint8Array([80, 70, 60, 50, 40, 30, 20, 10, 1]), 100, 200),
    );
  });
});

describe("document viewer image partitioning", () => {
  it("renders a searchable diagram whose stored clinical_use_class has drifted", () => {
    // Regression: the viewer used to require clinicalUseClass === "clinical_evidence", so a
    // searchable non-table image whose class drifted (e.g. to "ambiguous"/"administrative")
    // rendered nowhere — not in the clinical list and not in the audit group.
    const { clinicalImages, auditImages } = partitionViewerImages([
      { searchable: true, source_kind: "diagram_crop", clinicalUseClass: "ambiguous" },
      { searchable: true, source_kind: "embedded", clinicalUseClass: "administrative" },
      { searchable: true, source_kind: "table_crop", clinicalUseClass: "clinical_evidence" },
    ]);
    expect(clinicalImages).toHaveLength(3);
    expect(auditImages).toHaveLength(0);
  });

  it("routes administrative/reference table crops to the audit group", () => {
    const { clinicalImages, auditImages } = partitionViewerImages([
      { searchable: true, source_kind: "table_crop", clinicalUseClass: "administrative" },
      { searchable: false, source_kind: "table_crop", clinicalUseClass: "reference" },
      { searchable: true, source_kind: "table_crop", tableRole: "reference", clinicalUseClass: null },
    ]);
    expect(clinicalImages).toHaveLength(0);
    expect(auditImages).toHaveLength(3);
  });

  it("routes retained non-table viewer crops to the audit group", () => {
    const { clinicalImages, auditImages } = partitionViewerImages([
      { searchable: false, source_kind: "diagram_crop", retainedForDocumentView: true },
      { searchable: false, source_kind: "page_region", retainedForDocumentView: true },
      { searchable: false, source_kind: "embedded", clinicalUseClass: "clinical_evidence" },
    ]);
    expect(clinicalImages).toHaveLength(0);
    expect(auditImages).toHaveLength(2);
    expect(auditImages.map((image) => image.source_kind)).toEqual(["diagram_crop", "page_region"]);
  });

  it("keeps clinical table crops in the main list and non-searchable rows out of it", () => {
    const { clinicalImages, auditImages } = partitionViewerImages([
      { searchable: true, source_kind: "table_crop", clinicalUseClass: "clinical_evidence" },
      { searchable: false, source_kind: "embedded", clinicalUseClass: "clinical_evidence" },
    ]);
    expect(clinicalImages).toHaveLength(1);
    expect(clinicalImages[0].source_kind).toBe("table_crop");
    expect(auditImages).toHaveLength(0);
  });
});
