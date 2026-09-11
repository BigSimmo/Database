import {
  publicSpecifierRecords,
  type PublicSpecifierRecord,
  type SpecifierCatalogItem,
} from "@/lib/specifiers-content";
import type { SpecifierRecord } from "@/lib/specifiers";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import { siteContentProducerForMode } from "@/lib/site-content/site-content-registry";
import { createSiteContentRecord, siteContentValueHash } from "@/lib/site-content/site-content-manifest";

function curatedBody(record: SpecifierRecord) {
  return [
    record.summary,
    `Clinical signal: ${record.clinicalSignal}`,
    `Decision question: ${record.decisionQuestion}`,
    `Applies to: ${record.appliesTo.join(", ")}`,
    `Fit: ${record.fit.join(" ")}`,
    `Not fit: ${record.notFit.join(" ")}`,
    `Checks: ${record.checks.join(" ")}`,
    `Treatment lens: ${record.treatmentLens}`,
  ].join("\n");
}

function catalogueBody(item: SpecifierCatalogItem) {
  return [
    `Disorder: ${item.disorderName}`,
    `Group: ${item.groupLabel}`,
    item.icd11Context && `Context: ${item.icd11Context}`,
    item.definition?.meaning,
    item.definition?.clinicalNote,
  ]
    .filter(Boolean)
    .join("\n");
}

function catalogueValidation(item: SpecifierCatalogItem): SiteContentRecord["validationStatus"] {
  const status = item.review.clinicianReviewStatus.toLowerCase();
  return !item.review.changedSinceReview && /(^|[-_ ])(approved|reviewed)($|[-_ ])/.test(status)
    ? "locally_reviewed"
    : "unverified";
}

function catalogueSourceStatus(item: SpecifierCatalogItem): SiteContentRecord["sourceStatus"] {
  return item.review.sourceVerificationStatus === "source-verified" && !item.review.changedSinceReview
    ? "current"
    : "review_due";
}

function sourceHash(item: SpecifierCatalogItem) {
  return /^[0-9a-f]{64}$/i.test(item.review.contentHash)
    ? item.review.contentHash.toLowerCase()
    : siteContentValueHash(item);
}

export function specifierSiteContentRecord(source: PublicSpecifierRecord): SiteContentRecord {
  const producer = siteContentProducerForMode("specifiers");
  if (!producer) throw new Error("Specifiers site-content producer is not registered.");
  if (source.source === "curated") {
    return createSiteContentRecord({
      version: "site-content-record-v1",
      logicalId: `specifiers:${source.slug}`,
      producerClass: "static_repository",
      domain: "specifiers",
      route: producer.routeBuilder(source.slug),
      title: source.record.name,
      body: curatedBody(source.record),
      sourceRole: "clinical_reference",
      access: "public",
      validationStatus: "unverified",
      sourceStatus: "review_due",
      sourceLineage: [
        {
          sourceId: `repository:src/lib/specifiers.ts#${source.slug}`,
          sourceHash: siteContentValueHash(source.record),
          relationship: "derived_from",
        },
      ],
    });
  }
  return createSiteContentRecord({
    version: "site-content-record-v1",
    logicalId: `specifiers:${source.slug}`,
    producerClass: "static_repository",
    domain: "specifiers",
    route: producer.routeBuilder(source.slug),
    title: source.item.label,
    body: catalogueBody(source.item),
    sourceRole: "clinical_reference",
    access: "public",
    validationStatus: catalogueValidation(source.item),
    sourceStatus: catalogueSourceStatus(source.item),
    sourceLineage: [
      {
        sourceId: source.item.review.rowKey,
        sourceHash: sourceHash(source.item),
        relationship: "derived_from",
      },
    ],
  });
}

export function buildSpecifierSiteContentRecords(): SiteContentRecord[] {
  return publicSpecifierRecords().map(specifierSiteContentRecord);
}
