import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { calculatorRecordHref } from "@/components/calculators/calculator-routes";
import {
  allSiteContentRecords,
  dynamicSiteContentRecords,
  staticSiteContentRecords,
} from "@/lib/site-content/adapters";
import {
  adoptCanonicalRegistryProjection,
  buildRegistryReconciliationReport,
  canCarryForwardRegistryEmbedding,
  canonicalRegistrySiteContentProjection,
  registryEntryToSiteContentRecord,
} from "@/lib/site-content/adapters/registry";
import {
  buildStaticSiteContentManifest,
  createSiteContentRecord,
  validateSiteContentRecords,
} from "@/lib/site-content/site-content-manifest";
import { SITE_CONTENT_REGISTRY_VERSION } from "@/lib/site-content/site-content-registry";
import { publicKnowledgeToolCatalogRecords } from "@/lib/tools-catalog";
import type { RegistryCorpusEntry } from "@/lib/registry-corpus";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import type { SiteContentDomain } from "@/lib/types";

const metadata = {
  gitSha: "1111111111111111111111111111111111111111",
  registryVersion: SITE_CONTENT_REGISTRY_VERSION,
  generatedAt: "2026-08-23T00:00:00.000Z",
};

function record(logicalId: string, overrides: Partial<Omit<SiteContentRecord, "contentHash">> = {}): SiteContentRecord {
  const domain = logicalId.split(":")[0] as SiteContentDomain;
  const suffix = logicalId.split(":").slice(1).join(":");
  const routeByDomain: Partial<Record<SiteContentDomain, string>> = {
    dsm: `/dsm/diagnoses/${suffix}`,
    factsheets: `/factsheets/${suffix}`,
    services: `/services/${suffix}`,
  };
  const roleByDomain: Partial<Record<SiteContentDomain, SiteContentRecord["sourceRole"]>> = {
    services: "service_directory",
    forms: "form_reference",
    calculators: "tool_reference",
    tools: "tool_reference",
  };
  return createSiteContentRecord({
    version: "site-content-record-v1",
    logicalId,
    producerClass: "static_repository",
    domain,
    route: routeByDomain[domain] ?? `/${domain}/${suffix}`,
    title: logicalId,
    body: "First line\nSecond line",
    sourceRole: roleByDomain[domain] ?? "clinical_reference",
    access: "public",
    validationStatus: "locally_reviewed",
    sourceStatus: "current",
    publicationVersion: "fixture-v1",
    sourceLineage: [],
    ...overrides,
  });
}

describe("static site-content manifest", () => {
  it("uses canonical whitespace and stable logical-id order", () => {
    const first = buildStaticSiteContentManifest(
      [record("factsheets:z"), record("dsm:a", { body: "  First   line\r\n\r\n Second\tline  " })],
      metadata,
    );
    const second = buildStaticSiteContentManifest(
      [record("dsm:a", { body: "First line\nSecond line" }), record("factsheets:z")],
      { ...metadata, gitSha: "2222222222222222222222222222222222222222", generatedAt: "2030-01-01T00:00:00Z" },
    );

    expect(first.records.map((entry) => entry.logicalId)).toEqual(["dsm:a", "factsheets:z"]);
    expect(first.records.map((entry) => entry.contentHash)).toEqual(second.records.map((entry) => entry.contentHash));
    expect(first.staticManifestDigest).toBe(second.staticManifestDigest);
  });

  it("changes only the edited record hash and the static digest", () => {
    const before = buildStaticSiteContentManifest([record("dsm:a"), record("factsheets:b")], metadata);
    const after = buildStaticSiteContentManifest(
      [record("dsm:a", { body: "A changed clinical field" }), record("factsheets:b")],
      metadata,
    );

    expect(after.records[0]?.contentHash).not.toBe(before.records[0]?.contentHash);
    expect(after.records[1]?.contentHash).toBe(before.records[1]?.contentHash);
    expect(after.staticManifestDigest).not.toBe(before.staticManifestDigest);
  });

  it("keeps lineage separate from content and collapses derived evidence families", () => {
    const base = record("factsheets:a", {
      sourceLineage: [{ sourceId: "uploaded:guideline", sourceHash: "a".repeat(64), relationship: "derived_from" }],
    });
    const changedLineage = record("factsheets:a", {
      sourceLineage: [{ sourceId: "uploaded:guideline", sourceHash: "b".repeat(64), relationship: "derived_from" }],
    });
    const first = buildStaticSiteContentManifest([base], metadata);
    const second = buildStaticSiteContentManifest([changedLineage], metadata);

    expect(first.records[0]?.contentHash).toBe(second.records[0]?.contentHash);
    expect(first.records[0]?.lineageDigest).not.toBe(second.records[0]?.lineageDigest);
    expect(first.staticManifestDigest).not.toBe(second.staticManifestDigest);
  });

  it("validates dynamic records without folding them into the static digest", () => {
    const dynamic = record("services:a", { producerClass: "dynamic_registry", domain: "services" });
    const staticRecord = record("factsheets:b");
    const withoutDynamic = buildStaticSiteContentManifest([staticRecord], metadata);
    const withDynamic = buildStaticSiteContentManifest([dynamic, staticRecord], metadata);

    expect(withDynamic.staticManifestDigest).toBe(withoutDynamic.staticManifestDigest);
    expect(withDynamic.records.map((entry) => entry.logicalId)).toEqual(["factsheets:b"]);
    expect(validateSiteContentRecords([dynamic])).toEqual([dynamic]);
  });

  it("fails closed on duplicate IDs, invalid routes/public state, audit IDs, and protected derived content", () => {
    const valid = record("factsheets:a");
    expect(() => buildStaticSiteContentManifest([valid, valid], metadata)).toThrow(/duplicate logicalId/i);
    expect(() => validateSiteContentRecords([{ ...valid, route: "https://example.test/tools/a" }])).toThrow(/route/i);
    expect(() => validateSiteContentRecords([{ ...valid, access: "private" as "public" }])).toThrow(/public/i);
    expect(() => validateSiteContentRecords([{ ...valid, editorId: "actor-1" } as SiteContentRecord])).toThrow(
      /audit|editor/i,
    );
    expect(() =>
      createSiteContentRecord({
        ...valid,
        contentHash: undefined as never,
        sourceLineage: [
          { sourceId: "healthdirect:copied-page", sourceHash: "c".repeat(64), relationship: "derived_from" },
        ],
      }),
    ).toThrow(/protected|link-only/i);
  });
});

describe("canonical producer adapters", () => {
  it("covers every static owner and retains truthful pending dispositions", () => {
    const domains = new Set(staticSiteContentRecords.map((entry) => entry.domain));
    expect(domains).toEqual(
      new Set(["specifiers", "dsm", "formulation", "therapies", "dictionary", "factsheets", "calculators", "tools"]),
    );
    for (const domain of ["dsm", "formulation", "therapies"] as const) {
      const records = staticSiteContentRecords.filter((entry) => entry.domain === domain);
      expect(records.length).toBeGreaterThan(0);
      const manifest = buildStaticSiteContentManifest(records, metadata);
      expect(manifest.records.every((entry) => !entry.eligible && entry.exclusionReason)).toBe(true);
    }
  });

  it("uses curated-first specifiers, exact calculator routes, and the Tools allowlist hrefs", () => {
    expect(
      staticSiteContentRecords.find((entry) => entry.logicalId === "specifiers:with-anxious-distress")?.title,
    ).toBe("With anxious distress");
    for (const calculator of staticSiteContentRecords.filter((entry) => entry.domain === "calculators")) {
      expect(calculator.route).toBe(calculatorRecordHref(calculator.logicalId.slice("calculators:".length)));
      expect(calculator.body).not.toMatch(/answer selected|calculation result|item responses:/i);
    }
    expect(
      staticSiteContentRecords
        .filter((entry) => entry.domain === "tools")
        .map((entry) => [entry.logicalId.slice("tools:".length), entry.route]),
    ).toEqual(publicKnowledgeToolCatalogRecords.map((entry) => [entry.id, entry.href]));
  });

  it("registers services, forms, medications, and differentials as dynamic canonical public projections", () => {
    expect(new Set(dynamicSiteContentRecords.map((entry) => entry.domain))).toEqual(
      new Set(["services", "forms", "medications", "differentials"]),
    );
    expect(dynamicSiteContentRecords.every((entry) => entry.producerClass === "dynamic_registry")).toBe(true);
    expect(allSiteContentRecords.length).toBe(staticSiteContentRecords.length + dynamicSiteContentRecords.length);
  });

  it("keeps the CLI provider-free and bounded to metadata/hash outputs", () => {
    const cli = readFileSync("scripts/build-site-content-manifest.ts", "utf8");
    expect(cli).not.toMatch(/supabase|openai|embedTexts|body\s*:/i);
    expect(cli).toContain("--check");
    expect(cli).toContain("--baseline");
    expect(cli).toContain("--diff");
  });
});

describe("registry adoption", () => {
  const entry: RegistryCorpusEntry = {
    kind: "service",
    subkind: "service",
    ownerId: "actor-a",
    recordId: "record-a",
    slug: "crisis-service",
    title: "Crisis service",
    subtitle: "Urgent access",
    content: "Service: Crisis service\nUrgent access",
    searchText: "crisis service urgent access",
    sourceStatus: "current",
    validationStatus: "locally_reviewed",
    metadata: {},
  };

  it("preserves registry text and IDs while assigning only the canonical public projection", () => {
    const projection = {
      entry,
      logicalId: "services:crisis-service",
      publicRecordId: "record-a",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    };
    const adopted = adoptCanonicalRegistryProjection([projection]);
    const direct = registryEntryToSiteContentRecord(entry, {
      logicalId: projection.logicalId,
      publicRecordId: projection.publicRecordId,
      rowOwnerId: null,
      publicationState: "published",
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    });

    expect(adopted).toEqual(direct);
    expect(adopted.body).toBe(entry.content);
    expect(adopted.publicationVersion).toBe(entry.recordId);
    const adoptedProjection = canonicalRegistrySiteContentProjection(entry, {
      logicalId: projection.logicalId,
      publicRecordId: projection.publicRecordId,
      rowOwnerId: null,
      publicationState: "published",
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    });
    expect(adoptedProjection.metadata).toMatchObject({
      corpus_scope: "clinical_kb_site",
      site_content_domain: "services",
      site_content_route: "/services/crisis-service",
      site_content_logical_id: "services:crisis-service",
    });
    expect(JSON.stringify(adoptedProjection.metadata)).not.toMatch(/actor-a|owner_id/i);
    expect(() =>
      canonicalRegistrySiteContentProjection(entry, {
        logicalId: projection.logicalId,
        publicRecordId: projection.publicRecordId,
        rowOwnerId: "actor-a" as never,
        publicationState: "published",
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      }),
    ).toThrow(/ownerless reconciled public projection/i);
  });

  it("carries an embedding only when text, model, and dimensions are identical", () => {
    const existing = { normalizedText: "A  summary", model: "embedding-v1", dimensions: 1536 };
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "A summary",
        model: "embedding-v1",
        dimensions: 1536,
      }),
    ).toBe(true);
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "Changed summary",
        model: "embedding-v1",
        dimensions: 1536,
      }),
    ).toBe(false);
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "A summary",
        model: "embedding-v2",
        dimensions: 1536,
      }),
    ).toBe(false);
  });

  it("reports identical owner duplicates and rejects divergent adoption", () => {
    const identical = buildRegistryReconciliationReport([
      { logicalId: "services:crisis-service", rowOwnerId: "actor-a", entry },
      { logicalId: "services:crisis-service", rowOwnerId: "actor-b", entry: { ...entry, ownerId: "actor-b" } },
    ]);
    expect(identical.groups[0]?.disposition).toBe("identical_duplicates");
    expect(JSON.stringify(identical)).not.toMatch(/actor-a|actor-b/);

    const divergent = [
      {
        entry,
        logicalId: "services:crisis-service",
        publicRecordId: "record-a",
        rowOwnerId: null,
        publicationState: "published" as const,
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
      {
        entry: { ...entry, recordId: "record-b", content: "Divergent content" },
        logicalId: "services:crisis-service",
        publicRecordId: "record-b",
        rowOwnerId: "actor-b",
        publicationState: "published" as const,
        renderedByPublicSite: false,
        explicitlyReconciled: false,
      },
    ];
    expect(buildRegistryReconciliationReport(divergent).groups[0]?.disposition).toBe(
      "divergent_requires_administrator_review",
    );
    expect(() => adoptCanonicalRegistryProjection(divergent)).toThrow(/divergent|administrator/i);
  });
});
