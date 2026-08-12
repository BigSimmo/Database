import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clinicalContentAliases, clinicalDocumentAliases } from "../scripts/lib/clinical-aliases";

// Tiering contract for the alias tables (scripts/lib/clinical-aliases.ts header, mirrored in
// docs/rag-behaviour/safeguards.md): the STRICT tier feeds the zero-tolerance golden gates and
// the tuner's relevance grades, while src/lib/eval-document-matching.ts keeps a deliberately
// WIDER table for captured-case coverage reporting. Until this test existed the split was
// enforced only by comment — a bulk merge of the wide tier into the strict one would have
// passed CI while silently loosening clinical ground truth.
//
// Every key added to the strict tier is a clinical-governance change needing its own evidence
// trail. Updating the pinned key lists below is the conscious act that records that decision —
// never sync them from the wide tier.

const STRICT_DOCUMENT_ALIAS_KEYS = [
  "AgitationArousalPharmaMgt",
  "AdmissionCommunityPts",
  "ActiveCommunityPtED",
  "ClozapinePresAdminMonitor",
  "PtSafetyPlan",
];

const STRICT_CONTENT_ALIAS_KEYS = [
  "anc",
  "ciwa",
  "fbc",
  "im",
  "mg",
  "microgram",
  "po",
  "prn",
  "red",
  "route",
  "threshold",
  "withhold",
];

describe("clinical alias tiering (strict vs wide)", () => {
  it("pins the strict document-alias key set — additions need their own evidence trail", () => {
    expect(Object.keys(clinicalDocumentAliases).sort()).toEqual([...STRICT_DOCUMENT_ALIAS_KEYS].sort());
  });

  it("pins the strict content-alias key set — additions need their own evidence trail", () => {
    expect(Object.keys(clinicalContentAliases).sort()).toEqual([...STRICT_CONTENT_ALIAS_KEYS].sort());
  });

  it("keeps wide-tier-only coverage keys out of the strict tier", () => {
    // "Clozapine GP Shared Care" is the wide tier's marker example (named in the strict file's
    // TIERING comment): topically adjacent, correct for coverage reporting, wrong as golden
    // ground truth. Its appearance here is the signature of a bulk merge.
    expect(Object.keys(clinicalDocumentAliases)).not.toContain("Clozapine GP Shared Care");
  });

  it("retains the TIERING contract comment in the strict module", () => {
    const source = readFileSync(new URL("../scripts/lib/clinical-aliases.ts", import.meta.url), "utf8");
    expect(source).toContain("do not merge with src/lib/eval-document-matching.ts");
    expect(source).toContain("not a bulk merge");
  });
});
