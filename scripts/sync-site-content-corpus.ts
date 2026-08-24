import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { allSiteContentRecords } from "../src/lib/site-content/adapters";
import {
  planSiteContentSync,
  type ExistingSiteContentReleaseRecord,
  type SiteContentSyncSourceRecord,
} from "../src/lib/site-content/site-content-sync";
import {
  compareCanonicalSiteContentIdentifiers,
  siteContentValueHash,
  validateStaticSiteContentManifest,
} from "../src/lib/site-content/site-content-manifest";
import { SITE_CONTENT_REGISTRY_VERSION } from "../src/lib/site-content/site-content-registry";

type Options = {
  manifest?: string;
  dynamic?: string;
  reconciliation?: string;
  out?: string;
  dryRun: boolean;
  write: boolean;
  projectRef?: string;
  expectedStateDigest?: string;
  recoveryEvidence?: string;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = { dryRun: false, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") options.dryRun = true;
    else if (token === "--write") options.write = true;
    else if (
      [
        "--manifest",
        "--dynamic",
        "--reconciliation",
        "--out",
        "--project-ref",
        "--expected-state-digest",
        "--recovery-evidence",
      ].includes(token ?? "")
    ) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      const key = {
        "--manifest": "manifest",
        "--dynamic": "dynamic",
        "--reconciliation": "reconciliation",
        "--out": "out",
        "--project-ref": "projectRef",
        "--expected-state-digest": "expectedStateDigest",
        "--recovery-evidence": "recoveryEvidence",
      }[token!] as keyof Options;
      (options as Record<string, unknown>)[key] = value;
    } else throw new Error(`Unknown argument: ${token}`);
  }
  if (!options.manifest || !options.dynamic) throw new Error("--manifest and --dynamic are required.");
  if (!options.write) options.dryRun = true;
  if (options.write && (!options.projectRef || !options.expectedStateDigest || !options.recoveryEvidence)) {
    throw new Error("--write requires --project-ref, --expected-state-digest, and --recovery-evidence.");
  }
  return options;
}

function json(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function deterministicUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function sourceRecord(record: (typeof allSiteContentRecords)[number]): SiteContentSyncSourceRecord {
  return {
    record,
    documentId: deterministicUuid(`site-content-document:${record.logicalId}`),
    chunkId: deterministicUuid(`site-content-chunk:${record.logicalId}`),
    publicMetadataFingerprint: siteContentValueHash({
      route: record.route,
      title: record.title,
      sourceRole: record.sourceRole,
    }),
    governanceFingerprint: siteContentValueHash({
      access: record.access,
      validationStatus: record.validationStatus,
      sourceStatus: record.sourceStatus,
    }),
    lineageFingerprint: siteContentValueHash(record.sourceLineage),
  };
}

type DynamicInput = {
  version: "site-content-dynamic-input-v1";
  initialAdoption: boolean;
  targetChangeEpoch: string;
  generationId: string;
  embedding: { model: string; dimensions: number; fingerprint: string };
  records: SiteContentSyncSourceRecord[];
  existingReleaseRecords: ExistingSiteContentReleaseRecord[];
};

function assertDynamicInput(value: unknown): asserts value is DynamicInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dynamic input must be an object.");
  const input = value as Record<string, unknown>;
  if (
    input.version !== "site-content-dynamic-input-v1" ||
    !Array.isArray(input.records) ||
    !Array.isArray(input.existingReleaseRecords)
  ) {
    throw new Error("Dynamic input has an invalid version or population shape.");
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = validateStaticSiteContentManifest(json(options.manifest!), {
    expectedRegistryVersion: SITE_CONTENT_REGISTRY_VERSION,
  });
  const dynamic = json(options.dynamic!);
  assertDynamicInput(dynamic);
  if (dynamic.initialAdoption && !options.reconciliation) {
    throw new Error("Initial adoption requires --reconciliation <reviewed-plan.json>.");
  }
  if (options.reconciliation) {
    const reconciliation = json(options.reconciliation);
    if (!reconciliation || typeof reconciliation !== "object" || !("planDigest" in reconciliation)) {
      throw new Error("Reviewed reconciliation plan is invalid.");
    }
  }
  const staticRecords = allSiteContentRecords
    .filter((record) => record.producerClass === "static_repository")
    .map(sourceRecord)
    .sort((left, right) => compareCanonicalSiteContentIdentifiers(left.record.logicalId, right.record.logicalId));
  const plan = planSiteContentSync({
    manifest,
    staticRecords,
    dynamicRecords: dynamic.records,
    existingReleaseRecords: dynamic.existingReleaseRecords,
    registryVersion: SITE_CONTENT_REGISTRY_VERSION,
    targetChangeEpoch: dynamic.targetChangeEpoch,
    generationId: dynamic.generationId,
    embedding: dynamic.embedding,
  });
  if (options.expectedStateDigest && options.expectedStateDigest !== plan.dynamicStateDigest) {
    throw new Error("Expected state digest does not match the deterministic plan.");
  }
  const summary = {
    version: plan.version,
    dryRun: true,
    planDigest: plan.planDigest,
    releaseDigest: plan.releaseDigest,
    dynamicStateDigest: plan.dynamicStateDigest,
    targetChangeEpoch: plan.targetChangeEpoch,
    counts: plan.counts,
  };
  if (options.out) writeFileSync(resolve(options.out), `${JSON.stringify({ summary, plan }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (options.write) {
    throw new Error("Source-only Task 3 does not execute the provider-gated write path.");
  }
}

main();
