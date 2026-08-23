import { describe, expect, it } from "vitest";

import verificationManifest from "../data/australian-source-verification.v1.json";
import {
  assertIndexableCatalogueEntry,
  australianSourceByKey,
  australianSourceCatalogue,
  australianSourcePolicyVersion,
  isIndexableAustralianSource,
} from "@/lib/australian-source-catalogue";
import { sourceAuthorityIdentityForPublisherCode, sourceAuthorityRegistry } from "@/lib/source-authority-registry";

const expectedKeys = [
  "wa-health",
  "wa-chief-psychiatrist",
  "wa-legislation",
  "tga",
  "acsqhc",
  "australian-health-disability-ageing",
  "nhmrc",
  "ranzcp",
  "racgp",
  "pbs",
  "australian-prescriber",
  "etg-complete",
  "australian-medicines-handbook",
  "nps-medicinewise",
  "nsw-health",
  "queensland-health",
  "sa-health",
  "victoria-health",
  "tasmania-health",
  "nt-health",
  "act-health",
] as const;

describe("Australian source catalogue", () => {
  it("contains the explicit 21-entry policy and no generic publisher trust", () => {
    expect(australianSourceCatalogue.map((source) => source.key)).toEqual(expectedKeys);
    expect(australianSourceByKey("https://unreviewed.health.gov.au/")).toBeNull();
    expect(australianSourceByKey("unreviewed-gov-au")).toBeNull();
  });

  it("keeps Healthdirect completely outside the catalogue", () => {
    expect(
      australianSourceCatalogue.some((source) =>
        /healthdirect/i.test(`${source.key} ${source.publisher} ${source.canonicalUrl}`),
      ),
    ).toBe(false);
    expect(australianSourceByKey("healthdirect")).toBeNull();
  });

  it("makes eTG and AMH authenticated link-only references", () => {
    for (const key of ["etg-complete", "australian-medicines-handbook"]) {
      expect(australianSourceByKey(key)).toMatchObject({
        roles: ["reference_link"],
        contentMode: "link_only",
        licencePolicy: "metadata_link_only",
        lifecycle: "active",
      });
      expect(isIndexableAustralianSource(key, "public_index_permitted")).toBe(false);
    }
  });

  it("forbids link-only references from every content-bearing index projection", () => {
    for (const key of ["etg-complete", "australian-medicines-handbook"]) {
      expect(() => assertIndexableCatalogueEntry(australianSourceByKey(key))).toThrow(/link-only/i);
    }
  });

  it("marks NPS MedicineWise historical and index-forbidden rather than current", () => {
    expect(australianSourceByKey("nps-medicinewise")).toMatchObject({
      lifecycle: "historical",
      licencePolicy: "index_forbidden",
    });
    expect(isIndexableAustralianSource("nps-medicinewise", "public_index_permitted")).toBe(false);
    expect(() => assertIndexableCatalogueEntry(australianSourceByKey("nps-medicinewise"))).toThrow(/historical/i);
  });

  it("contains unique stable keys, codes, URLs, and a versioned policy", () => {
    expect(australianSourcePolicyVersion).toBe("australian-source-policy-v1");
    expect(new Set(australianSourceCatalogue.map((source) => source.key)).size).toBe(australianSourceCatalogue.length);
    expect(new Set(australianSourceCatalogue.map((source) => source.publisherCode)).size).toBe(
      australianSourceCatalogue.length,
    );
    expect(new Set(australianSourceCatalogue.map((source) => source.canonicalUrl)).size).toBe(
      australianSourceCatalogue.length,
    );
    expect(australianSourceCatalogue.every((source) => new URL(source.canonicalUrl).protocol === "https:")).toBe(true);
  });

  it("reuses exactly one authority publisher identity per indexed catalogue entry", () => {
    for (const source of australianSourceCatalogue.filter((entry) => entry.contentMode === "indexed_content")) {
      const matchingAuthorities = sourceAuthorityRegistry.filter((authority) =>
        authority.codes.includes(source.publisherCode),
      );
      expect(matchingAuthorities).toHaveLength(1);
      expect(sourceAuthorityIdentityForPublisherCode(source.publisherCode)).toMatchObject({
        publisher: source.publisher,
      });
    }
  });

  it("keeps new catalogue-only publisher identities inert until metadata policy binds them", () => {
    for (const publisherCode of ["OCPWA", "WALEG", "AUSPRES"]) {
      expect(sourceAuthorityIdentityForPublisherCode(publisherCode)).toMatchObject({ catalogueIdentityOnly: true });
    }
  });

  it("does not treat an official publisher root as document-level indexing permission", () => {
    expect(
      australianSourceCatalogue
        .filter((source) => source.lifecycle === "active" && source.contentMode === "indexed_content")
        .every((source) => source.licencePolicy === "review_required"),
    ).toBe(true);
    expect(australianSourceByKey("wa-health")?.licencePolicy).toBe("review_required");
    expect(isIndexableAustralianSource("wa-health", "review_required")).toBe(false);
    expect(isIndexableAustralianSource("wa-health", "public_index_permitted")).toBe(true);
    expect(isIndexableAustralianSource("missing", "public_index_permitted")).toBe(false);
  });

  it("keeps state and territory sources as labelled lower-priority fallbacks", () => {
    const stateFallbacks = australianSourceCatalogue.filter((source) =>
      [
        "nsw-health",
        "queensland-health",
        "sa-health",
        "victoria-health",
        "tasmania-health",
        "nt-health",
        "act-health",
      ].includes(source.key),
    );
    const primaryRanks = australianSourceCatalogue
      .filter((source) => !stateFallbacks.includes(source) && source.lifecycle === "active")
      .map((source) => source.fallbackRank);

    expect(stateFallbacks).toHaveLength(7);
    expect(stateFallbacks.every((source) => source.jurisdiction !== "Australia")).toBe(true);
    expect(Math.min(...stateFallbacks.map((source) => source.fallbackRank))).toBeGreaterThan(Math.max(...primaryRanks));
  });

  it("matches the content-free committed verification plan row for row", () => {
    expect(verificationManifest).toMatchObject({
      version: "australian-source-verification-v1",
      policyVersion: australianSourcePolicyVersion,
      verificationStatus: "plan_evidence_only_connected_verification_required",
    });
    expect(verificationManifest.sources).toHaveLength(australianSourceCatalogue.length);
    expect(
      verificationManifest.sources.map(
        ({ key, canonicalUrl, publisherCode, publisher, licencePolicy, contentMode }) => ({
          key,
          canonicalUrl,
          publisherCode,
          publisher,
          licencePolicy,
          contentMode,
        }),
      ),
    ).toEqual(
      australianSourceCatalogue.map(({ key, canonicalUrl, publisherCode, publisher, licencePolicy, contentMode }) => ({
        key,
        canonicalUrl,
        publisherCode,
        publisher,
        licencePolicy,
        contentMode,
      })),
    );
    expect(
      verificationManifest.sources.every(
        (source) =>
          source.checkedAt === "2026-08-20" &&
          source.reviewerRole === "source_governance_planner" &&
          source.evidenceReference === "docs/superpowers/plans/2026-08-20-rag-australian-source-governance.md#task-1",
      ),
    ).toBe(true);
    expect(JSON.stringify(verificationManifest)).not.toMatch(/excerpt|snippet|quote|clinicalContent|fetchedContent/i);
  });
});
