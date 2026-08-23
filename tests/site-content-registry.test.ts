import { describe, expect, expectTypeOf, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import { registryCorpusMetadata, type RegistryCorpusEntry } from "@/lib/registry-corpus";
import {
  canMutateSiteContent,
  evaluateSiteContentRegistration,
  evidenceFamilyKey,
  reconcileCanonicalPublicSiteContent,
  resolveSiteContentReadTarget,
  siteContentClaimPolicy,
  siteContentModeCoverage,
  siteContentModeExclusions,
  siteContentProducerForMode,
  siteContentProducerRegistry,
} from "@/lib/site-content/site-content-registry";
import type {
  ActiveSiteContentRelease,
  RagContextSnapshot,
  SiteContentPartitionSnapshot,
  SiteContentRecord,
} from "@/lib/site-content/site-content-contracts";

const activeRelease: ActiveSiteContentRelease = {
  version: "clinical-kb-site-release-v1",
  releaseId: "release-2026-08-23",
  registryVersion: "site-content-registry-v1",
  staticManifestDigest: "static-digest",
  dynamicStateDigest: "dynamic-digest",
  releaseDigest: "release-digest",
  state: "active",
  activatedAt: "2026-08-23T10:00:00.000Z",
};

describe("site content contracts", () => {
  it("consumes the evaluation-owned source and snapshot vocabularies", () => {
    const record: SiteContentRecord = {
      version: "site-content-record-v1",
      logicalId: "specifiers:with-anxious-distress",
      producerClass: "static_repository",
      domain: "specifiers",
      route: "/specifiers/with-anxious-distress",
      title: "With anxious distress",
      body: "Clinical KB catalogue summary.",
      sourceRole: "clinical_reference",
      access: "public",
      validationStatus: "locally_reviewed",
      sourceStatus: "current",
      publicationVersion: "specifier-catalogue-v1",
      sourceLineage: [],
      contentHash: "content-hash",
    };
    const partition: SiteContentPartitionSnapshot = {
      releaseId: activeRelease.releaseId,
      staticManifestDigest: activeRelease.staticManifestDigest,
      dynamicStateDigest: activeRelease.dynamicStateDigest,
      releaseDigest: activeRelease.releaseDigest,
      changeEpoch: "change-1",
      state: "current",
    };
    const snapshot: RagContextSnapshot = {
      version: "rag-context-snapshot-v1",
      resolvedAt: "2026-08-23T10:00:01.000Z",
      documentIndexGeneration: "generation-1",
      sourcePolicyVersion: "source-policy-v1",
      publicSiteContent: partition,
    };

    expect(record).toMatchObject({ domain: "specifiers", sourceRole: "clinical_reference", access: "public" });
    expect(snapshot.publicSiteContent).toEqual(partition);
    expectTypeOf(record.domain).toMatchTypeOf<
      | "services"
      | "forms"
      | "medications"
      | "differentials"
      | "specifiers"
      | "dsm"
      | "formulation"
      | "therapies"
      | "dictionary"
      | "factsheets"
      | "calculators"
      | "tools"
    >();
  });
});

describe("site content producer registry", () => {
  it("maps every public knowledge mode to its canonical site domain and role", () => {
    expect(
      Object.fromEntries(siteContentProducerRegistry.map((producer) => [producer.modeId, producer.domain])),
    ).toEqual({
      services: "services",
      forms: "forms",
      differentials: "differentials",
      dsm: "dsm",
      specifiers: "specifiers",
      formulation: "formulation",
      prescribing: "medications",
      tools: "tools",
      calculators: "calculators",
      "therapy-compass": "therapies",
      factsheets: "factsheets",
      dictionary: "dictionary",
    });

    expect(siteContentProducerForMode("specifiers")).toMatchObject({
      corpusScope: "clinical_kb_site",
      domain: "specifiers",
      producerClass: "static_repository",
      allowedRoles: ["clinical_reference"],
    });
    expect(siteContentProducerForMode("differentials")).toMatchObject({
      corpusScope: "clinical_kb_site",
      domain: "differentials",
      producerClass: "dynamic_registry",
      allowedRoles: ["clinical_reference"],
    });
    expect(siteContentProducerForMode("prescribing")).toMatchObject({
      corpusScope: "clinical_kb_site",
      domain: "medications",
      producerClass: "dynamic_registry",
      allowedRoles: ["clinical_reference"],
    });
    expect(siteContentProducerForMode("services")?.allowedRoles).toEqual(["service_directory"]);
    expect(siteContentProducerForMode("forms")?.allowedRoles).toEqual(["form_reference"]);
  });

  it("uses explicit producer contracts rather than paths or arbitrary globs", () => {
    for (const producer of siteContentProducerRegistry) {
      expect(producer).toMatchObject({
        version: "site-content-producer-v1",
        canonicalOwner: expect.stringMatching(/^(src|clinical_)/),
        dataSource: expect.any(String),
        publicationVersionField: expect.any(String),
        adapter: expect.any(String),
        allowedRoles: expect.any(Array),
        readPolicy: "public_active_release",
        reviewOwner: "clinical_content_governance",
        activationState: "active",
      });
      expect(producer.canonicalOwner).not.toMatch(/[*!?[\]{}]/);
      expect(producer.dataSource).not.toMatch(/[*!?[\]{}]/);
      expect(producer.adapter).not.toMatch(/[*!?[\]{}]/);
      expect(producer.routeBuilder("record slug")).toMatch(/^\//);
      expect(producer.allowedRoles).not.toHaveLength(0);
    }

    expect(siteContentProducerForMode("services")?.producerClass).toBe("dynamic_registry");
    expect(siteContentProducerForMode("specifiers")?.producerClass).toBe("static_repository");
    expect(siteContentProducerForMode("services")?.mutationPolicy).toBe("administrator_only");
    expect(siteContentProducerForMode("specifiers")?.mutationPolicy).toBe("repository_release_only");
  });

  it("covers every current mode with a registered producer or permanent reviewed exclusion", () => {
    expect(siteContentModeCoverage(appModeIds)).toEqual({ complete: true, missing: [], pendingReview: [] });
    expect(siteContentModeExclusions).toEqual([
      expect.objectContaining({ modeId: "answer", reason: "corpus_consumer", permanent: true, reviewed: true }),
      expect.objectContaining({
        modeId: "documents",
        reason: "managed_uploaded_local",
        permanent: true,
        reviewed: true,
      }),
      expect.objectContaining({ modeId: "favourites", reason: "private_user_state", permanent: true, reviewed: true }),
    ]);
    expect(siteContentModeCoverage([...appModeIds, "future-mode"])).toEqual({
      complete: false,
      missing: ["future-mode"],
      pendingReview: [],
    });
    expect(
      siteContentModeCoverage([...appModeIds, "future-mode"], [{ modeId: "future-mode", status: "pending_review" }]),
    ).toEqual({
      complete: false,
      missing: [],
      pendingReview: ["future-mode"],
    });
    expect(
      siteContentModeCoverage(
        [...appModeIds, "future-operational-mode"],
        [
          {
            modeId: "future-operational-mode",
            status: "permanently_excluded",
            reason: "operational_chrome",
            reviewed: true,
          },
        ],
      ),
    ).toEqual({ complete: true, missing: [], pendingReview: [] });
  });

  it("resolves the same public release for anonymous and authenticated readers", () => {
    expect(resolveSiteContentReadTarget("anonymous", activeRelease)).toEqual(
      resolveSiteContentReadTarget("authenticated", activeRelease),
    );
    expect(resolveSiteContentReadTarget("anonymous", activeRelease)).toEqual({
      audience: "public",
      corpusScope: "clinical_kb_site",
      readPolicy: "public_active_release",
      releaseId: activeRelease.releaseId,
      releaseDigest: activeRelease.releaseDigest,
    });
  });

  it("allows only administrator-authorized dynamic mutations and publication", () => {
    const services = siteContentProducerForMode("services")!;
    const specifiers = siteContentProducerForMode("specifiers")!;

    for (const operation of ["create", "edit", "publish", "retire"] as const) {
      expect(canMutateSiteContent(services, operation, { isAdministrator: false })).toBe(false);
      expect(canMutateSiteContent(services, operation, { isAdministrator: true })).toBe(true);
      expect(canMutateSiteContent(specifiers, operation, { isAdministrator: true })).toBe(false);
    }
  });

  it("keeps legacy owner and publication actors out of retrieval metadata", () => {
    const entry: RegistryCorpusEntry = {
      kind: "service",
      subkind: "service",
      ownerId: "audit-owner-id",
      recordId: "service-record-id",
      slug: "crisis-service",
      title: "Crisis service",
      subtitle: null,
      content: "Public service summary",
      searchText: "crisis service",
      sourceStatus: "current",
      validationStatus: "approved",
      metadata: {
        owner_id: "audit-owner-id",
        actor_id: "audit-actor-id",
        created_by: "audit-creator-id",
        updated_by: "audit-updater-id",
        published_by: "audit-publisher-id",
        reviewed_by: "audit-reviewer-id",
        editorId: "audit-editor-id",
        catalogue_label: "Service",
      },
    };

    expect(registryCorpusMetadata(entry)).toMatchObject({
      corpus_scope: "clinical_kb_site",
      source_role: "service_directory",
      catalogue_label: "Service",
    });
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("owner_id");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("actor_id");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("created_by");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("updated_by");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("published_by");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("reviewed_by");
    expect(registryCorpusMetadata(entry)).not.toHaveProperty("editorId");
  });
});

describe("site content eligibility and authority", () => {
  const eligibleCandidate = {
    modeId: "specifiers",
    access: "public",
    publicationState: "published",
    renderedByPublicSite: true,
    contentClass: "public_knowledge",
    authoritySource: "clinical_kb",
  } as const;

  it("rejects private, synthetic, repository-internal, unpublished, and forbidden authority sources", () => {
    expect(evaluateSiteContentRegistration(eligibleCandidate)).toMatchObject({ eligible: true });

    for (const contentClass of [
      "application_code",
      "test_fixture",
      "prompt",
      "developer_documentation",
      "mockup",
      "synthetic_ward_data",
      "private_user_state",
    ] as const) {
      expect(evaluateSiteContentRegistration({ ...eligibleCandidate, contentClass })).toEqual({
        eligible: false,
        reason: "forbidden_content_class",
      });
    }
    expect(evaluateSiteContentRegistration({ ...eligibleCandidate, access: "private" })).toEqual({
      eligible: false,
      reason: "not_public",
    });
    for (const publicationState of ["draft", "preview"] as const) {
      expect(evaluateSiteContentRegistration({ ...eligibleCandidate, publicationState })).toEqual({
        eligible: false,
        reason: "not_published",
      });
    }
    expect(evaluateSiteContentRegistration({ ...eligibleCandidate, renderedByPublicSite: false })).toEqual({
      eligible: false,
      reason: "not_publicly_rendered_version",
    });
    for (const authoritySource of ["etg_link", "amh_link", "healthdirect"] as const) {
      expect(evaluateSiteContentRegistration({ ...eligibleCandidate, authoritySource })).toEqual({
        eligible: false,
        reason: "forbidden_authority_source",
      });
    }
    for (const modeId of ["documents", "favourites", "answer"] as const) {
      expect(evaluateSiteContentRegistration({ ...eligibleCandidate, modeId })).toEqual({
        eligible: false,
        reason: "mode_excluded",
      });
    }
  });

  it("keeps product evidence separate from clinical authority and uploaded guidance primary", () => {
    expect(
      siteContentClaimPolicy({
        claimKind: "product_catalogue",
        siteSourceRole: "clinical_reference",
        directlyRelevantUploadedGuideline: false,
      }),
    ).toEqual({
      primaryCorpus: "clinical_kb_site",
      siteUse: "primary_product_evidence",
      requiresEligibleClinicalEvidence: false,
    });

    expect(
      siteContentClaimPolicy({
        claimKind: "patient_diagnosis",
        siteSourceRole: "clinical_reference",
        directlyRelevantUploadedGuideline: false,
      }),
    ).toEqual({
      primaryCorpus: null,
      siteUse: "ineligible_for_clinical_claim",
      requiresEligibleClinicalEvidence: true,
    });

    expect(
      siteContentClaimPolicy({
        claimKind: "clinical_guidance",
        siteSourceRole: "clinical_reference",
        directlyRelevantUploadedGuideline: true,
      }),
    ).toEqual({
      primaryCorpus: "uploaded_local",
      siteUse: "attributed_navigation_context",
      requiresEligibleClinicalEvidence: false,
    });
  });

  it("collapses lineage-derived summaries into the same evidence family", () => {
    const uploaded = evidenceFamilyKey({
      sourceId: "uploaded:lithium-guideline",
      sourceHash: "guideline-hash",
      sourceLineage: [],
    });
    const siteSummary = evidenceFamilyKey({
      sourceId: "site:medications:lithium",
      sourceHash: "summary-hash",
      sourceLineage: [
        { sourceId: "uploaded:lithium-guideline", sourceHash: "guideline-hash", relationship: "derived_from" },
      ],
    });

    expect(siteSummary).toBe(uploaded);
  });

  it("selects only one explicitly reconciled public publication for duplicate legacy rows", () => {
    const candidates = [
      {
        recordId: "editor-row-a",
        logicalId: "medications:lithium",
        publicationState: "published",
        renderedByPublicSite: true,
        explicitlyReconciled: false,
      },
      {
        recordId: "canonical-publication",
        logicalId: "medications:lithium",
        publicationState: "published",
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
      {
        recordId: "editor-row-draft",
        logicalId: "medications:lithium",
        publicationState: "draft",
        renderedByPublicSite: false,
        explicitlyReconciled: false,
      },
    ] as const;

    expect(reconcileCanonicalPublicSiteContent(candidates)).toMatchObject({ recordId: "canonical-publication" });
    expect(
      reconcileCanonicalPublicSiteContent([
        ...candidates,
        { ...candidates[1], recordId: "second-reconciled-publication" },
      ]),
    ).toBeNull();
  });
});
