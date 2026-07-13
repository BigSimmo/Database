import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import {
  analyzeSourceLocality,
  assertLocalityMetadataPatch,
  auditSourceAuthorityDocuments,
  inferSourceAuthorityFromIdentity,
  type SourceAuthorityDocument,
} from "@/lib/source-authority-metadata";
import { parseBackfillSourceMetadataArgs } from "../scripts/backfill-source-metadata";

function document(
  overrides: Partial<SourceAuthorityDocument> & Pick<SourceAuthorityDocument, "file_name">,
): SourceAuthorityDocument {
  return {
    id: overrides.id ?? "document-id",
    title: overrides.title ?? overrides.file_name,
    file_name: overrides.file_name,
    source_path: overrides.source_path ?? null,
    metadata: overrides.metadata ?? {},
  };
}

describe("source authority metadata tooling", () => {
  it("infers WA and national authorities from exact registry code tokens", () => {
    expect(inferSourceAuthorityFromIdentity(document({ file_name: "WACHS-lithium-guideline.pdf" }))).toMatchObject({
      code: "WACHS",
      authority: { key: "wa-country-health-service", scope: "wa" },
      conflict: false,
    });
    expect(
      inferSourceAuthorityFromIdentity(document({ file_name: "TGA/lithium-product-information.pdf" })),
    ).toMatchObject({
      code: "TGA",
      authority: { key: "tga", scope: "australian_national" },
      conflict: false,
    });
  });

  it("does not require locality metadata for unknown or international documents", () => {
    const report = auditSourceAuthorityDocuments([
      document({ file_name: "unknown-clinical-reference.pdf" }),
      document({ file_name: "BMJ-lithium.pdf", metadata: { publisher_code: "BMJ" } }),
    ]);

    expect(report.missing_australian_locality_count).toBe(0);
    expect(report.passed).toBe(true);
  });

  it("gates inferable Australian sources with missing locality and proposes only safe fields", () => {
    const candidate = document({ file_name: "WACHS-lithium-guideline.pdf" });
    const analysis = analyzeSourceLocality(candidate);
    const report = auditSourceAuthorityDocuments([candidate]);

    expect(analysis.missingLocalityKeys).toEqual(["publisher_code", "publisher", "jurisdiction"]);
    expect(analysis.changes).toEqual({
      publisher_code: "WACHS",
      publisher: "WA Country Health Service",
      jurisdiction: "Australia/WA",
    });
    expect(report.passed).toBe(false);
    expect(report.missing_australian_locality_count).toBe(1);
    expect(report.proposed_locality_corrections[0]?.changed_keys).toEqual([
      "publisher_code",
      "publisher",
      "jurisdiction",
    ]);
  });

  it("fails closed on cross-authority code and publisher claims", () => {
    const conflicted = document({
      file_name: "lithium-guideline.pdf",
      metadata: {
        publisher_code: "WACHS",
        publisher: "NPS MedicineWise",
        jurisdiction: "Australia/WA",
      },
    });
    const analysis = analyzeSourceLocality(conflicted);
    const report = auditSourceAuthorityDocuments([conflicted]);

    expect(analysis.unresolvedConflict).toBe(true);
    expect(analysis.conflicts).toContain(
      "publisher_code_publisher_conflict:wa-country-health-service/nps-medicinewise",
    );
    expect(analysis.changes).toEqual({});
    expect(report.authority_conflict_reason_counts).toMatchObject({
      publisher_mismatch: 1,
      "publisher_code_publisher_conflict:wa-country-health-service/nps-medicinewise": 1,
    });
  });

  it("canonicalizes compatible aliases without broad metadata changes", () => {
    const analysis = analyzeSourceLocality(
      document({
        file_name: "WACHS-lithium-guideline.pdf",
        metadata: {
          publisher_code: "WACHS",
          publisher: "WA Health",
          jurisdiction: "WA",
          clinical_validation_status: "approved",
        },
      }),
    );

    expect(analysis.unresolvedConflict).toBe(false);
    expect(analysis.changes).toEqual({
      publisher: "WA Country Health Service",
      jurisdiction: "Australia/WA",
    });
    expect(Object.keys(analysis.changes)).not.toContain("clinical_validation_status");
  });

  it("enforces the locality patch allowlist", () => {
    expect(() =>
      assertLocalityMetadataPatch({
        publisher_code: "WACHS",
        publisher: "WA Country Health Service",
        jurisdiction: "Australia/WA",
      }),
    ).not.toThrow();
    expect(() => assertLocalityMetadataPatch({ publisher_code: "WACHS", document_status: "current" })).toThrow(
      /disallowed keys: document_status/,
    );
  });

  it("refuses every write form except confirmed locality-only apply", () => {
    expect(() => parseBackfillSourceMetadataArgs(["--apply"])).toThrow(/requires both --locality-only and --confirm/);
    expect(() => parseBackfillSourceMetadataArgs(["--apply", "--confirm"])).toThrow(
      /requires both --locality-only and --confirm/,
    );
    expect(() => parseBackfillSourceMetadataArgs(["--confirm"])).toThrow(/only valid together with --apply/);
    expect(parseBackfillSourceMetadataArgs(["--locality-only", "--apply", "--confirm"])).toMatchObject({
      localityOnly: true,
      apply: true,
      confirm: true,
    });
  });

  it("makes both governance scripts consume the shared authority helper", () => {
    const auditScript = readFileSync("scripts/audit-source-governance.ts", "utf8");
    const backfillScript = readFileSync("scripts/backfill-source-metadata.ts", "utf8");

    expect(auditScript).toContain('from "@/lib/source-authority-metadata"');
    expect(backfillScript).toContain('from "@/lib/source-authority-metadata"');
    expect(backfillScript).not.toContain("const publisherByCode");
  });
});
