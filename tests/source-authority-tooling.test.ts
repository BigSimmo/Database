import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import {
  analyzeSourceLocality,
  assertLocalityMetadataPatch,
  auditSourceAuthorityDocuments,
  inferSourceAuthorityFromIdentity,
  isRegistryRecordSource,
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

  it("prefers the document identity over parent health-service path segments", () => {
    expect(
      inferSourceAuthorityFromIdentity(
        document({
          file_name: "RPBG-lithium-guideline.pdf",
          source_path: "WA Health/EMHS/Clinical resources/RPBG/RPBG-lithium-guideline.pdf",
        }),
      ),
    ).toMatchObject({
      code: "RPBG",
      authority: { key: "royal-perth-bentley-group" },
      conflict: false,
    });

    expect(
      inferSourceAuthorityFromIdentity(
        document({
          file_name: "lithium-guideline.pdf",
          title: "FSH lithium guideline",
          source_path: "WA Health/SMHS/Clinical resources/FSH/lithium-guideline.pdf",
        }),
      ),
    ).toMatchObject({
      code: "FSH",
      authority: { key: "fiona-stanley-fremantle-hospitals-group" },
      conflict: false,
    });
  });

  it("treats a trailing parenthetical code as publisher identity rather than subject acronyms", () => {
    expect(
      inferSourceAuthorityFromIdentity(
        document({ file_name: "MDU Booking Process Pharmacy PBS and IPA Process (RPBG).pdf" }),
      ),
    ).toMatchObject({ code: "RPBG", authority: { key: "royal-perth-bentley-group" }, conflict: false });
    expect(
      inferSourceAuthorityFromIdentity(
        document({ file_name: "Governance of ACSQHC Clinical Care Standards (PHC).pdf" }),
      ),
    ).toMatchObject({ code: "PHC", authority: { key: "peel-health-campus" }, conflict: false });
  });

  it("does not infer WHO from ordinary lowercase prose", () => {
    expect(
      inferSourceAuthorityFromIdentity(
        document({
          file_name: "people-who-care.pdf",
          title: "People who care for patients",
        }),
      ),
    ).toEqual({ code: null, authority: null, codes: [], authorityKeys: [], conflict: false });
  });

  it("does not require locality metadata for unknown or international documents", () => {
    const report = auditSourceAuthorityDocuments([
      document({ file_name: "unknown-clinical-reference.pdf" }),
      document({ file_name: "BMJ-lithium.pdf", metadata: { publisher_code: "BMJ" } }),
    ]);

    expect(report.missing_australian_locality_count).toBe(0);
    expect(report.passed).toBe(true);
  });

  it("excludes registry projections from document locality governance", () => {
    const registryRecord = document({
      file_name: "emhs-crisis-service.json",
      source_path: "WA Health/EMHS/Registry/emhs-crisis-service.json",
      metadata: {
        source_kind: "registry_record",
        publisher: "Clinical KB registry",
        jurisdiction: "WA/local clinical workspace",
      },
    });
    const analysis = analyzeSourceLocality(registryRecord);
    const report = auditSourceAuthorityDocuments([registryRecord]);

    expect(isRegistryRecordSource(registryRecord)).toBe(true);
    expect(analysis).toMatchObject({
      authority: null,
      matchedBy: "none",
      excludedReason: "registry_record",
      missingLocalityKeys: [],
      changes: {},
      unresolvedConflict: false,
    });
    expect(report).toMatchObject({
      excluded_registry_record_count: 1,
      authority_conflict_count: 0,
      missing_australian_locality_count: 0,
      proposed_locality_correction_count: 0,
      passed: true,
    });
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
    expect(auditScript).toContain("documents.filter((document) => !isRegistryRecordSource(document))");
    expect(backfillScript).toContain('from "@/lib/source-authority-metadata"');
    expect(backfillScript).not.toContain("const publisherByCode");
  });
});
