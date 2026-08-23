import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

import { australianSourceByKey } from "@/lib/australian-source-catalogue";
import {
  fetchApprovedPublicSource,
  parseFetchApprovedSourceArgs,
  parsePublicSourceAcquisitionPlan,
  type PublicSourceAcquisitionPlan,
} from "@/lib/public-source-acquisition";
import type { Json } from "@/lib/supabase/database.types";

export function parseAcquisitionBatch(raw: string) {
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 1) {
    throw new Error("Acquisition manifest version is invalid.");
  }
  const rawPlans = (input as { plans?: unknown }).plans;
  if (!Array.isArray(rawPlans) || rawPlans.length < 1 || rawPlans.length > 500) {
    throw new Error("Acquisition manifest plan count must be between 1 and 500.");
  }
  const plans = rawPlans.map(parsePublicSourceAcquisitionPlan);
  const identities = plans.map((plan) => `${plan.catalogueKey}\u0000${plan.exactUrl}`);
  if (new Set(identities).size !== identities.length)
    throw new Error("Acquisition manifest contains duplicate exact URLs.");
  return plans;
}

export async function stageFetchedPublicSource(
  plan: PublicSourceAcquisitionPlan,
  fetched: Awaited<ReturnType<typeof fetchApprovedPublicSource>>,
) {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  const [{ env }, { createAdminClient }] = await Promise.all([import("@/lib/env"), import("@/lib/supabase/admin")]);
  const supabase = createAdminClient();
  const definition = australianSourceByKey(plan.catalogueKey)!;
  const { data: duplicateVersion, error: duplicateError } = await supabase
    .from("public_source_versions")
    .select("id,lifecycle,content_hash")
    .eq("source_catalogue_key", plan.catalogueKey)
    .eq("content_hash", fetched.contentHash)
    .maybeSingle();
  if (duplicateError) throw new Error("Public source duplicate check failed.");
  if (duplicateVersion) return { disposition: "duplicate" as const, version: duplicateVersion };

  const documentId = randomUUID();
  const safeExtension = fetched.mime === "text/plain" ? ".txt" : extname(new URL(fetched.finalUrl).pathname) || ".bin";
  const storagePath = `${plan.stewardId}/public-source-staging/${documentId}/source${safeExtension.toLowerCase()}`;
  let uploaded = false;
  let documentCreated = false;
  try {
    const upload = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, fetched.content, {
      contentType: fetched.mime,
      upsert: false,
    });
    if (upload.error) throw new Error("Public source storage write failed.");
    uploaded = true;

    const metadata = {
      corpus_scope: "australian_public",
      source_kind: "document",
      source_catalogue_key: plan.catalogueKey,
      source_policy_version: plan.sourcePolicyVersion,
      public_source_activation_event_id: plan.activationEventId,
      public_source_steward_id: plan.stewardId,
      content_mode: "indexed_content",
      licence_policy: "public_index_permitted",
      publisher: definition.publisher,
      publisher_code: definition.publisherCode,
      jurisdiction: definition.jurisdiction,
      source_role: definition.roles[0] ?? "clinical_guideline",
      source_title: plan.exactVersion,
      canonical_url: definition.canonicalUrl,
      exact_version_url: fetched.finalUrl,
      version: plan.exactVersion,
      document_status: "current",
      change_state: "changed",
      clinical_validation_status: "unverified",
      content_hash: fetched.contentHash,
    };
    // The atomic owned-document RPC queues the job. claim_ingestion_jobs in the
    // same migration rejects this Australian row until stage_public_source_version
    // binds public_source_version_id under the document lock.
    const { error: createError } = await supabase.rpc("create_uploaded_document_with_ingestion_job", {
      p_document: {
        id: documentId,
        owner_id: plan.stewardId,
        title: `${definition.publisher} — ${plan.exactVersion}`,
        description: "Controlled public-source staging document.",
        file_name: `source${safeExtension.toLowerCase()}`,
        file_type: fetched.mime,
        file_size: fetched.byteCount,
        storage_path: storagePath,
        content_hash: fetched.contentHash,
        metadata,
      },
      p_max_attempts: env.WORKER_MAX_ATTEMPTS,
    });
    if (createError) throw new Error("Public source owned staging enqueue failed.");
    documentCreated = true;

    const { data: version, error: versionError } = await supabase.rpc("stage_public_source_version", {
      p_manifest: {
        catalogueKey: plan.catalogueKey,
        sourcePolicyVersion: plan.sourcePolicyVersion,
        sourcePolicyDigest: plan.sourcePolicyDigest,
        activationEventId: plan.activationEventId,
        exactCanonicalUrl: definition.canonicalUrl,
        exactVersionUrl: fetched.finalUrl,
        exactVersion: plan.exactVersion,
        contentHash: fetched.contentHash,
        retrievedAt: new Date().toISOString(),
        licenceEvidenceDigest: plan.licenceEvidenceDigest,
        stewardId: plan.stewardId,
        stagingDocumentId: documentId,
      } satisfies Json,
    });
    if (versionError || !version) throw new Error("Public source version staging failed.");
    return { disposition: fetched.disposition, version };
  } catch (error) {
    if (documentCreated) {
      await supabase.from("documents").delete().eq("id", documentId).eq("owner_id", plan.stewardId);
    }
    if (uploaded) await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([storagePath]);
    throw error;
  }
}

async function main() {
  const args = parseFetchApprovedSourceArgs(process.argv.slice(2));
  const raw = await readFile(args.manifestPath, "utf8");
  const plans = parseAcquisitionBatch(raw);
  const digest = createHash("sha256").update(raw, "utf8").digest("hex");
  console.log(`[public-sources:fetch] manifest SHA-256 ${digest}; exact count ${plans.length}`);
  if (!args.apply) {
    console.log("[public-sources:fetch] dry run only; no network, storage, database, enqueue, or activation occurred.");
    console.log(
      `[public-sources:fetch] apply with --expected-count ${plans.length} --confirm-sha256 ${digest} --apply`,
    );
    return;
  }
  if (args.expectedCount !== plans.length) throw new Error("Confirmed count does not match the acquisition manifest.");
  if (args.confirmSha256 !== digest) throw new Error("Confirmed SHA-256 does not match the acquisition manifest.");

  for (const plan of plans) {
    const fetched = await fetchApprovedPublicSource(plan);
    const result = await stageFetchedPublicSource(plan, fetched);
    console.log(
      `[public-sources:fetch] ${plan.catalogueKey} ${new URL(plan.exactUrl).hostname} ${fetched.contentHash} ${result.disposition}`,
    );
  }
  console.log("[public-sources:fetch] staged owned shadow versions only; no content was activated or published.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Public source fetch failed.");
    process.exit(1);
  });
}
